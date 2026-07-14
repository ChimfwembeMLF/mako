use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::auto_reply_rules::service::{find_active_for_platform, match_keyword_rule};
use crate::modules::comment_replies::ai::build_reply_text;
use crate::modules::comment_replies::entity::{
    ActiveModel as ReplyActiveModel, Column as ReplyColumn, Entity as ReplyEntity,
    Model as ReplyModel,
};
use crate::modules::content_items::entity::{
    Column as ContentColumn, Entity as ContentEntity,
};

pub async fn process_new_comments(
    state: &AppState,
    comment_ids: &[Uuid],
    user_id: Uuid,
) -> ApiResult<(usize, usize)> {
    if comment_ids.is_empty() {
        return Ok((0, 0));
    }

    let mut sent = 0usize;
    let mut skipped = 0usize;
    for id in comment_ids {
        let Some(comment) = ReplyEntity::find_by_id(*id)
            .one(&state.db)
            .await?
        else {
            continue;
        };
        if comment.status.as_deref() != Some("pending") {
            skipped += 1;
            continue;
        }
        if try_auto_reply(state, &comment, user_id).await? {
            sent += 1;
        } else {
            skipped += 1;
        }
    }
    Ok((sent, skipped))
}

pub async fn process_pending_for_tenant(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<(usize, usize)> {
    let mut pending = ReplyEntity::find()
        .filter(ReplyColumn::TenantId.eq(tenant_id))
        .filter(ReplyColumn::Status.eq("pending"))
        .order_by_asc(ReplyColumn::CreatedAt)
        .all(&state.db)
        .await?;

    if let Some(ws) = workspace_id {
        let content_ids: Vec<Uuid> = ContentEntity::find()
            .filter(ContentColumn::TenantId.eq(tenant_id))
            .filter(ContentColumn::WorkspaceId.eq(ws))
            .all(&state.db)
            .await?
            .into_iter()
            .map(|c| c.id)
            .collect();
        if content_ids.is_empty() {
            return Ok((0, 0));
        }
        pending.retain(|c| content_ids.contains(&c.content_id));
    }

    let mut sent = 0usize;
    let mut skipped = 0usize;
    for comment in pending.into_iter().take(50) {
        if try_auto_reply(state, &comment, user_id).await? {
            sent += 1;
        } else {
            skipped += 1;
        }
    }
    Ok((sent, skipped))
}

async fn try_auto_reply(
    state: &AppState,
    comment: &ReplyModel,
    user_id: Uuid,
) -> ApiResult<bool> {
    if comment.is_from_brand {
        return Ok(false);
    }
    if comment.status.as_deref() != Some("pending") {
        return Ok(false);
    }
    if comment.reply_text.as_ref().is_some_and(|t| !t.trim().is_empty()) {
        return Ok(false);
    }

    let workspace_id = ContentEntity::find_by_id(comment.content_id)
        .one(&state.db)
        .await?
        .map(|c| c.workspace_id);

    let rules = find_active_for_platform(
        &state.db,
        comment.tenant_id,
        &comment.platform,
        workspace_id,
    )
    .await?;
    let Some(rule) = match_keyword_rule(&rules, &comment.comment_text) else {
        return Ok(false);
    };

    let reply_text = build_reply_text(state, comment, rule, user_id).await?;
    if reply_text.trim().is_empty() {
        return Ok(false);
    }

    match super::send_comment_reply(
        state,
        comment.id,
        user_id,
        reply_text.trim(),
        Some("auto_reply"),
        Some(rule.id),
    )
    .await
    {
        Ok(true) => {
            tracing::info!(
                comment_id = %comment.id,
                platform = %comment.platform,
                rule = %rule.name,
                "Comment auto-reply sent"
            );
            Ok(true)
        }
        Ok(false) | Err(_) => Ok(false),
    }
}

pub async fn mark_sent(
    state: &AppState,
    comment_id: Uuid,
    message: &str,
    reply_type: Option<&str>,
    rule_id: Option<Uuid>,
) -> ApiResult<()> {
    let existing = ReplyEntity::find_by_id(comment_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| crate::common::ApiError::NotFound("Comment not found".into()))?;
    let mut active: ReplyActiveModel = existing.into();
    active.reply_text = Set(Some(message.to_string()));
    active.sent_at = Set(Some(Utc::now().fixed_offset()));
    active.status = Set(Some("sent".into()));
    active.reply_type = Set(reply_type.map(str::to_string));
    active.rule_id = Set(rule_id);
    active.update(&state.db).await?;
    Ok(())
}
