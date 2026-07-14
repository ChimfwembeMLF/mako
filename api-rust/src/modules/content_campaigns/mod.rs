#[allow(dead_code)]
pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{NaiveDate, Utc};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::ai_usage::entity::ActiveModel as AiUsageActiveModel;
use crate::modules::brand_profiles::entity::{
    Column as BrandProfileColumn, Entity as BrandProfileEntity,
};
use crate::modules::content_campaigns::dto::GenerateCampaignDto;
use crate::modules::content_items::schedule::parse_scheduled_time_str;
use crate::modules::content_campaigns::entity::{
    ActiveModel as CampaignActiveModel, Column as CampaignColumn, Entity as CampaignEntity,
    Model as CampaignModel,
};
use crate::modules::content_items::{
    self,
    entity::{
        ActiveModel as ContentItemActiveModel, Column as ContentItemColumn,
        Entity as ContentItemEntity,
    },
};
use crate::services::mistral::{ChatMessage, MistralService};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/generate", post(generate))
        .route("/", get(find_all))
        .route("/{id}", get(find_one).delete(remove))
}

#[derive(Deserialize)]
struct CampaignListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct CampaignScopedQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
}

async fn generate(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<GenerateCampaignDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let theme = payload.theme.trim();
    if theme.is_empty() {
        return Err(ApiError::BadRequest("theme is required".into()));
    }

    let post_count = payload.post_count.unwrap_or(7).clamp(3, 14) as usize;
    let platforms = payload
        .platforms
        .clone()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| vec!["linkedin".into(), "facebook".into(), "instagram".into()]);

    let brand = BrandProfileEntity::find()
        .filter(BrandProfileColumn::TenantId.eq(payload.tenant_id))
        .filter(BrandProfileColumn::WorkspaceId.eq(payload.workspace_id))
        .one(&state.db)
        .await?;
    let brand = brand.ok_or_else(|| {
        ApiError::BadRequest("Set up Brand Brain before generating a campaign".into())
    })?;

    let system = format!(
        "You are a senior social media strategist. Plan a {post_count}-post content campaign.
Return ONLY valid JSON:
{{
  \"name\": \"Campaign title\",
  \"summary\": \"2-3 sentence strategy overview\",
  \"posts\": [
    {{
      \"dayOffset\": 0,
      \"scheduledTime\": \"09:00\",
      \"platform\": \"linkedin\",
      \"title\": \"Post headline\",
      \"content\": \"<p>HTML body</p>\",
      \"theme\": \"Specific angle\"
    }}
  ]
}}
Rules:
- Exactly {post_count} posts.
- dayOffset from 0 to {}.
- platform must be one of: {}.",
        post_count - 1,
        platforms.join(", ")
    );
    let user_prompt = format!(
        "Brand profile:\ncompanyName: {}\ndescription: {}\nkeywords: {}\n\nCampaign theme: {}\n{}\n{}\nTarget platforms: {}",
        brand.company_name.clone().unwrap_or_default(),
        brand.description.clone().unwrap_or_default(),
        brand.keywords.clone().unwrap_or_default(),
        theme,
        payload
            .goal
            .clone()
            .map(|g| format!("Campaign goal: {g}"))
            .unwrap_or_default(),
        payload
            .name
            .clone()
            .map(|n| format!("Suggested name: {n}"))
            .unwrap_or_default(),
        platforms.join(", ")
    );

    let mistral = &state.config.mistral;
    let (ai_data, tokens_used, _model) = MistralService::complete_json(
        mistral,
        vec![
            ChatMessage {
                role: "system".into(),
                content: system,
            },
            ChatMessage {
                role: "user".into(),
                content: user_prompt,
            },
        ],
        Some(MistralService::premium_model(mistral)),
    )
    .await?;

    let raw_posts = ai_data
        .get("posts")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    if raw_posts.is_empty() {
        return Err(ApiError::BadRequest(
            "AI did not return campaign posts — try again".into(),
        ));
    }

    let start_date = payload
        .start_date
        .as_deref()
        .and_then(parse_start_date)
        .unwrap_or_else(|| Utc::now().date_naive());
    let now = Utc::now().fixed_offset();

    let campaign = CampaignActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        workspace_id: Set(payload.workspace_id),
        user_id: Set(user_id),
        name: Set(payload
            .name
            .clone()
            .or_else(|| {
                ai_data
                    .get("name")
                    .and_then(|v| v.as_str())
                    .map(str::to_string)
            })
            .unwrap_or_else(|| theme.to_string())
            .chars()
            .take(200)
            .collect()),
        goal: Set(payload.goal.clone()),
        theme: Set(Some(theme.to_string())),
        platforms: Set(Some(platforms.clone())),
        post_count: Set(post_count as i32),
        start_date: Set(Some(start_date)),
        status: Set("active".into()),
        summary: Set(ai_data
            .get("summary")
            .and_then(|v| v.as_str())
            .map(str::to_string)),
        created_at: Set(now),
        updated_at: Set(now),
    }
    .insert(&state.db)
    .await?;

    let mut saved_items = Vec::new();
    for (i, post) in raw_posts.into_iter().take(post_count).enumerate() {
        let day_offset = post
            .get("dayOffset")
            .and_then(|v| v.as_i64())
            .unwrap_or(i as i64) as i32;
        let scheduled_date = start_date + chrono::Days::new(day_offset.max(0) as u64);
        let platform = post
            .get("platform")
            .and_then(|v| v.as_str())
            .filter(|p| platforms.contains(&p.to_string()))
            .map(str::to_string)
            .unwrap_or_else(|| platforms[i % platforms.len()].clone());
        let title = post
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Post")
            .chars()
            .take(200)
            .collect::<String>();
        let content = post
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("<p>Campaign post</p>")
            .to_string();
        let post_theme = post
            .get("theme")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .unwrap_or_else(|| theme.to_string());
        let scheduled_time = post
            .get("scheduledTime")
            .and_then(|v| v.as_str())
            .unwrap_or("09:00")
            .to_string();

        let item = ContentItemActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(payload.tenant_id),
            workspace_id: Set(payload.workspace_id),
            user_id: Set(user_id),
            brand_profile_id: Set(Some(brand.id)),
            campaign_id: Set(Some(campaign.id)),
            content_type: Set("content".into()),
            title: Set(title),
            content: Set(content),
            campaign_theme: Set(Some(post_theme)),
            status: Set(Some("scheduled".into())),
            platforms: Set(Some(vec![platform])),
            scheduled_date: Set(Some(scheduled_date)),
            scheduled_time: Set(parse_scheduled_time_str(Some(scheduled_time))),
            publish_attempts: Set(0),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&state.db)
        .await?;
        saved_items.push(item);
    }

    let _ = AiUsageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        user_id: Set(user_id),
        function_name: Set("generate-campaign".into()),
        tokens_used: Set(tokens_used.to_string()),
        created_at: Set(now),
    }
    .insert(&state.db)
    .await;

    Ok(Json(json!({
        "campaign": campaign_json(&campaign),
        "posts": saved_items.iter().map(content_items::content_item_json).collect::<Vec<_>>(),
        "tokensUsed": tokens_used,
    })))
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<CampaignListQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = CampaignEntity::find()
        .filter(CampaignColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(CampaignColumn::CreatedAt);

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(CampaignColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(campaign_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<CampaignScopedQuery>,
) -> ApiResult<Json<Value>> {
    let campaign = CampaignEntity::find()
        .filter(CampaignColumn::Id.eq(id))
        .filter(CampaignColumn::TenantId.eq(query.tenant_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Campaign not found".into()))?;

    let posts = ContentItemEntity::find()
        .filter(ContentItemColumn::CampaignId.eq(id))
        .filter(ContentItemColumn::TenantId.eq(query.tenant_id))
        .order_by_asc(ContentItemColumn::ScheduledDate)
        .order_by_asc(ContentItemColumn::CreatedAt)
        .all(&state.db)
        .await?;

    Ok(Json(json!({
        "campaign": campaign_json(&campaign),
        "posts": posts.iter().map(content_items::content_item_json).collect::<Vec<_>>(),
    })))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<CampaignScopedQuery>,
) -> ApiResult<Json<Value>> {
    let campaign = CampaignEntity::find()
        .filter(CampaignColumn::Id.eq(id))
        .filter(CampaignColumn::TenantId.eq(query.tenant_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Campaign not found".into()))?;

    let posts = ContentItemEntity::find()
        .filter(ContentItemColumn::CampaignId.eq(campaign.id))
        .filter(ContentItemColumn::TenantId.eq(query.tenant_id))
        .all(&state.db)
        .await?;

    for post in posts {
        let mut active: ContentItemActiveModel = post.into();
        active.status = Set(Some("draft".into()));
        active.update(&state.db).await?;
    }

    CampaignEntity::delete_by_id(campaign.id)
        .exec(&state.db)
        .await?;

    Ok(Json(json!({ "deleted": true })))
}

fn campaign_json(campaign: &CampaignModel) -> Value {
    json!({
        "id": campaign.id,
        "tenantId": campaign.tenant_id,
        "workspaceId": campaign.workspace_id,
        "userId": campaign.user_id,
        "name": campaign.name,
        "goal": campaign.goal,
        "theme": campaign.theme,
        "platforms": campaign.platforms,
        "postCount": campaign.post_count,
        "startDate": campaign.start_date,
        "status": campaign.status,
        "summary": campaign.summary,
        "created_at": campaign.created_at,
        "updated_at": campaign.updated_at,
    })
}

fn parse_start_date(value: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d").ok()
}
