use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::ai_usage::entity::ActiveModel as AiUsageActiveModel;
use crate::modules::comment_replies::entity::{
    Entity as ReplyEntity, Model as ReplyModel,
};
use crate::modules::content_items::entity::Entity as ContentEntity;
use crate::modules::content_publications::entity::{
    Column as PublicationColumn, Entity as PublicationEntity,
};
use crate::services::ai_context::{load_brand_profile, brand_prompt_suffix};
use crate::services::mistral::{ChatMessage, MistralService};

pub struct CommentReplyContext {
    pub post_title: Option<String>,
    pub post_content: String,
    pub commenter_name: String,
    pub comment_text: String,
    pub platform: String,
}

pub async fn suggest_reply(
    state: &AppState,
    comment_reply_id: Uuid,
    user_id: Uuid,
) -> ApiResult<String> {
    let comment = ReplyEntity::find_by_id(comment_reply_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Comment not found".into()))?;

    generate_ai_reply(state, &comment, user_id).await
}

pub async fn build_reply_text(
    state: &AppState,
    comment: &ReplyModel,
    rule: &crate::modules::auto_reply_rules::entity::Model,
    user_id: Uuid,
) -> ApiResult<String> {
    if rule.ai_generate {
        return generate_ai_reply(state, comment, user_id).await;
    }

    let ctx = load_context(state, comment).await?;
    let template = rule.response_template.as_deref().unwrap_or("").trim();
    if template.is_empty() {
        return Ok(String::new());
    }

    let post_content_plain = strip_html(&ctx.post_content);
    Ok(template
        .replace("{message}", &ctx.comment_text)
        .replace("{MESSAGE}", &ctx.comment_text)
        .replace("{customer_message}", &ctx.comment_text)
        .replace("{CUSTOMER_MESSAGE}", &ctx.comment_text)
        .replace("{customer_name}", &ctx.commenter_name)
        .replace("{CUSTOMER_NAME}", &ctx.commenter_name)
        .replace("{post_title}", ctx.post_title.as_deref().unwrap_or(""))
        .replace("{POST_TITLE}", ctx.post_title.as_deref().unwrap_or(""))
        .replace("{post_content}", &post_content_plain)
        .replace("{POST_CONTENT}", &post_content_plain))
}

async fn generate_ai_reply(
    state: &AppState,
    comment: &ReplyModel,
    user_id: Uuid,
) -> ApiResult<String> {
    let ctx = load_context(state, comment).await?;
    let workspace_id = ContentEntity::find_by_id(comment.content_id)
        .one(&state.db)
        .await?
        .map(|c| c.workspace_id);
    let brand = load_brand_profile(state, comment.tenant_id, workspace_id).await?;

    let system = format!(
        "You write helpful, concise public social media comment replies. Return ONLY JSON {{\"content\":\"...\"}}. Platform: {}. {}",
        ctx.platform,
        brand_prompt_suffix(brand.as_ref())
    );
    let user = format!(
        "Post title: {}\nPost content: {}\nCommenter: {}\nComment: {}\n\nWrite a short helpful public reply.",
        ctx.post_title.as_deref().unwrap_or(""),
        strip_html(&ctx.post_content),
        ctx.commenter_name,
        ctx.comment_text
    );

    let (data, tokens_used, _) = MistralService::complete_json(
        &state.config.mistral,
        vec![
            ChatMessage {
                role: "system".into(),
                content: system,
            },
            ChatMessage {
                role: "user".into(),
                content: user,
            },
        ],
        Some(MistralService::default_model(&state.config.mistral)),
    )
    .await?;

    record_ai_usage(
        state,
        comment.tenant_id,
        user_id,
        "comment-reply-suggest",
        tokens_used,
    )
    .await;

    Ok(data
        .get("content")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .unwrap_or("")
        .to_string())
}

pub async fn load_context(state: &AppState, comment: &ReplyModel) -> ApiResult<CommentReplyContext> {
    let item = ContentEntity::find_by_id(comment.content_id)
        .one(&state.db)
        .await?;

    let publication = PublicationEntity::find()
        .filter(PublicationColumn::ContentId.eq(comment.content_id))
        .filter(PublicationColumn::Platform.eq(&comment.platform))
        .filter(PublicationColumn::Status.eq("published"))
        .order_by_desc(PublicationColumn::PublishedAt)
        .one(&state.db)
        .await?;

    let post_content = publication
        .as_ref()
        .map(|p| p.published_content.clone())
        .or_else(|| item.as_ref().map(|i| i.content.clone()))
        .unwrap_or_default();
    let post_title = publication
        .as_ref()
        .and_then(|p| p.published_title.clone())
        .or_else(|| item.as_ref().map(|i| i.title.clone()));

    Ok(CommentReplyContext {
        post_title,
        post_content,
        commenter_name: comment.commenter_name.clone(),
        comment_text: comment.comment_text.clone(),
        platform: comment.platform.clone(),
    })
}

fn strip_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_tag = false;
    for ch in input.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out.trim().to_string()
}

async fn record_ai_usage(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    function_name: &str,
    tokens_used: i32,
) {
    let _ = AiUsageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        user_id: Set(user_id),
        function_name: Set(function_name.to_string()),
        tokens_used: Set(tokens_used.to_string()),
        created_at: Set(Utc::now().fixed_offset()),
    }
    .insert(&state.db)
    .await;
}
