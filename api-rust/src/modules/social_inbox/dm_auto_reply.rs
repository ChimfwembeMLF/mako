use chrono::Utc;
use reqwest::Client;
use sea_orm::{ActiveModelTrait, Set};
use serde_json::json;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::auto_reply_rules::service::{find_active_for_platform, match_keyword_rule};
use crate::modules::social_accounts::entity::Model as SocialAccountModel;
use crate::modules::social_inbox::entity::ActiveModel as SocialMessageActiveModel;
use crate::services::ai_context::{load_brand_profile, reply_system_prompt};
use crate::services::mistral::{ChatMessage, MistralService};

pub struct TryDmReplyParams<'a> {
    pub state: &'a AppState,
    pub tenant_id: Uuid,
    pub platform: String,
    pub thread_id: String,
    pub participant_id: String,
    pub participant_name: Option<String>,
    pub inbound_text: String,
    pub account: &'a SocialAccountModel,
}

pub async fn try_reply(params: TryDmReplyParams<'_>) -> ApiResult<bool> {
    let active_rules = find_active_for_platform(
        &params.state.db,
        params.tenant_id,
        &params.platform,
        params.account.workspace_id,
    )
    .await?;

    let Some(rule) = match_keyword_rule(&active_rules, &params.inbound_text) else {
        return Ok(false);
    };

    let reply_text = build_reply_text(
        params.state,
        params.tenant_id,
        rule,
        &params.inbound_text,
        params.account.workspace_id,
    )
    .await?;
    if reply_text.trim().is_empty() {
        return Ok(false);
    }

    if !send_dm(params.account, &params.participant_id, reply_text.trim(), &params.platform).await {
        return Ok(false);
    }

    SocialMessageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(params.tenant_id),
        workspace_id: Set(params.account.workspace_id),
        platform: Set(params.platform.clone()),
        thread_id: Set(params.thread_id),
        external_message_id: Set(None),
        participant_id: Set(params.participant_id),
        participant_name: Set(params.participant_name),
        participant_avatar_url: Set(None),
        direction: Set("outbound".into()),
        body: Set(reply_text.trim().to_string()),
        attachments: Set(json!([])),
        reactions: Set(json!([])),
        status: Set("auto_reply".into()),
        created_at: Set(Utc::now().fixed_offset()),
    }
    .insert(&params.state.db)
    .await?;

    tracing::info!(
        tenant_id = %params.tenant_id,
        platform = %params.platform,
        rule = %rule.name,
        "Social DM auto-reply sent"
    );
    Ok(true)
}

async fn build_reply_text(
    state: &AppState,
    tenant_id: Uuid,
    rule: &crate::modules::auto_reply_rules::entity::Model,
    inbound_text: &str,
    workspace_id: Option<Uuid>,
) -> ApiResult<String> {
    if rule.ai_generate {
        let brand = load_brand_profile(state, tenant_id, workspace_id).await?;
        let (data, _, _) = MistralService::complete_json(
            &state.config.mistral,
            vec![
                ChatMessage {
                    role: "system".into(),
                    content: reply_system_prompt(brand.as_ref()),
                },
                ChatMessage {
                    role: "user".into(),
                    content: format!(
                        "Customer direct message:\n{inbound_text}\n\nWrite a helpful reply."
                    ),
                },
            ],
            Some(MistralService::default_model(&state.config.mistral)),
        )
        .await?;
        return Ok(data
            .get("content")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or("")
            .to_string());
    }

    let template = rule.response_template.as_deref().unwrap_or("").trim();
    if template.is_empty() {
        return Ok(String::new());
    }
    Ok(template
        .replace("{message}", inbound_text)
        .replace("{MESSAGE}", inbound_text)
        .replace("{customer_message}", inbound_text)
        .replace("{CUSTOMER_MESSAGE}", inbound_text))
}

async fn send_dm(
    account: &SocialAccountModel,
    recipient_id: &str,
    message: &str,
    platform: &str,
) -> bool {
    let token = account
        .metadata
        .as_ref()
        .and_then(|m| m.get("page_token"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| account.access_token.clone());
    let Some(token) = token.filter(|v| !v.trim().is_empty()) else {
        tracing::warn!(platform, "DM auto-reply skipped: missing page token");
        return false;
    };

    let page_id = account
        .metadata
        .as_ref()
        .and_then(|m| m.get("page_id"))
        .and_then(|v| v.as_str());
    let endpoint = if let Some(page_id) = page_id {
        format!("https://graph.facebook.com/v20.0/{page_id}/messages")
    } else {
        "https://graph.facebook.com/v20.0/me/messages".into()
    };

    let client = Client::new();
    match client
        .post(endpoint)
        .query(&[("access_token", token.as_str())])
        .json(&json!({
            "recipient": { "id": recipient_id },
            "message": { "text": message }
        }))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => true,
        Ok(resp) => {
            let body = resp.text().await.unwrap_or_default();
            tracing::warn!(platform, error = %body, "DM auto-reply send failed");
            false
        }
        Err(err) => {
            tracing::warn!(platform, error = %err, "DM auto-reply send failed");
            false
        }
    }
}
