use chrono::Utc;
use sea_orm::{ActiveModelTrait, Set};
use serde_json::json;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::auto_reply_rules::service::{find_active_for_platform, match_keyword_rule};
use crate::modules::social_accounts::entity::Model as SocialAccountModel;
use crate::modules::whatsapp::entity::message::ActiveModel as MessageActiveModel;
use crate::modules::whatsapp::messaging::{credentials_from_account, normalize_phone, send_session_text};
use crate::services::ai_context::{load_brand_profile, reply_system_prompt};
use crate::services::mistral::{ChatMessage, MistralService};

pub struct TryReplyParams<'a> {
    pub state: &'a AppState,
    pub tenant_id: Uuid,
    pub phone: String,
    pub inbound_text: String,
    pub account: &'a SocialAccountModel,
    pub contact_id: Option<Uuid>,
    pub lead_id: Option<Uuid>,
}

pub async fn try_reply(params: TryReplyParams<'_>) -> ApiResult<bool> {
    let active_rules = find_active_for_platform(
        &params.state.db,
        params.tenant_id,
        "whatsapp",
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

    let Some(creds) = credentials_from_account(params.account) else {
        return Ok(false);
    };

    let result = send_session_text(&creds, &params.phone, reply_text.trim()).await;
    if !result.success {
        tracing::warn!(
            error = result.error.as_deref().unwrap_or("unknown"),
            "WhatsApp auto-reply failed"
        );
        return Ok(false);
    }

    MessageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(params.tenant_id),
        workspace_id: Set(params.account.workspace_id),
        contact_id: Set(params.contact_id),
        lead_id: Set(params.lead_id),
        phone: Set(normalize_phone(&params.phone)),
        direction: Set("outbound".into()),
        body: Set(reply_text.trim().to_string()),
        wa_message_id: Set(result.wa_message_id),
        status: Set("auto_reply".into()),
        attachments: Set(json!([])),
        reactions: Set(json!([])),
        created_at: Set(Utc::now().fixed_offset()),
        ..Default::default()
    }
    .insert(&params.state.db)
    .await?;

    tracing::info!(
        tenant_id = %params.tenant_id,
        phone = %params.phone,
        rule = %rule.name,
        "WhatsApp auto-reply sent"
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
                        "Customer WhatsApp message:\n{inbound_text}\n\nWrite a helpful reply."
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
