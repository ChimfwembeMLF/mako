use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde_json::json;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::social_accounts::entity::{
    Column as SocialAccountColumn, Entity as SocialAccountEntity, Model as SocialAccountModel,
};
use crate::modules::social_inbox::entity::{
    ActiveModel as MessageActiveModel, Column as MessageColumn, Entity as MessageEntity,
};
use crate::modules::social_inbox::dm_auto_reply::{try_reply as try_dm_auto_reply, TryDmReplyParams};

pub async fn handle_meta_webhook(state: &AppState, body: &serde_json::Value) -> ApiResult<()> {
    let object = body.get("object").and_then(|v| v.as_str()).unwrap_or("");
    if object != "page" && object != "instagram" {
        return Ok(());
    }

    let platform = if object == "instagram" {
        "instagram"
    } else {
        "facebook"
    };

    let entries = body
        .get("entry")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    for entry in entries {
        let page_id = entry.get("id").and_then(|v| v.as_str()).map(str::to_string);
        let messaging = entry
            .get("messaging")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        for event in messaging {
            if let Err(err) =
                process_messaging_event(state, platform, page_id.as_deref(), &event).await
            {
                tracing::warn!(error = %err, platform, "Failed to process social inbox event");
            }
        }
    }

    Ok(())
}

async fn process_messaging_event(
    state: &AppState,
    platform: &str,
    page_id: Option<&str>,
    event: &serde_json::Value,
) -> ApiResult<()> {
    let message = event.get("message");
    let Some(message) = message else {
        return Ok(());
    };

    let sender_id = event
        .get("sender")
        .and_then(|s| s.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let Some(sender_id) = sender_id else {
        return Ok(());
    };

    let account = resolve_account(state, platform, page_id).await?;
    let Some(account) = account else {
        return Ok(());
    };

    let external_id = message
        .get("mid")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    if let Some(ref mid) = external_id {
        let exists = MessageEntity::find()
            .filter(MessageColumn::TenantId.eq(account.tenant_id))
            .filter(MessageColumn::ExternalMessageId.eq(mid))
            .one(&state.db)
            .await?
            .is_some();
        if exists {
            return Ok(());
        }
    }

    let body = message
        .get("text")
        .and_then(|t| t.get("body"))
        .and_then(|v| v.as_str())
        .unwrap_or("[attachment]")
        .to_string();

    let thread_id = format!("{platform}:{sender_id}");
    let now = Utc::now().fixed_offset();
    let inbound_text = body.clone();
    let participant_id = sender_id.clone();

    MessageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(account.tenant_id),
        workspace_id: Set(account.workspace_id),
        platform: Set(platform.into()),
        thread_id: Set(thread_id.clone()),
        external_message_id: Set(external_id),
        participant_id: Set(sender_id),
        participant_name: Set(None),
        participant_avatar_url: Set(None),
        direction: Set("inbound".into()),
        body: Set(body),
        attachments: Set(json!([])),
        reactions: Set(json!([])),
        status: Set("received".into()),
        created_at: Set(now),
    }
    .insert(&state.db)
    .await?;

    tracing::info!(
        tenant_id = %account.tenant_id,
        platform,
        "Social inbox inbound message stored"
    );

    let _ = try_dm_auto_reply(TryDmReplyParams {
        state,
        tenant_id: account.tenant_id,
        platform: platform.to_string(),
        thread_id,
        participant_id,
        participant_name: None,
        inbound_text,
        account: &account,
    })
    .await?;

    Ok(())
}

async fn resolve_account(
    state: &AppState,
    platform: &str,
    page_id: Option<&str>,
) -> ApiResult<Option<SocialAccountModel>> {
    if let Some(page_id) = page_id {
        let accounts = SocialAccountEntity::find()
            .filter(SocialAccountColumn::Platform.eq(platform))
            .filter(SocialAccountColumn::Connected.eq(true))
            .all(&state.db)
            .await?;

        for account in accounts {
            let meta_page = account
                .metadata
                .as_ref()
                .and_then(|m| m.get("page_id"))
                .and_then(|v| v.as_str());
            if meta_page == Some(page_id) || account.external_id.as_deref() == Some(page_id) {
                return Ok(Some(account));
            }
        }
    }

    Ok(SocialAccountEntity::find()
        .filter(SocialAccountColumn::Platform.eq(platform))
        .filter(SocialAccountColumn::Connected.eq(true))
        .one(&state.db)
        .await?)
}
