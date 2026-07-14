use std::env;

use chrono::Utc;
use sea_orm::{ActiveModelTrait, Set};
use serde_json::json;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::social_accounts::entity::Model as SocialAccountModel;
use crate::modules::whatsapp::entity::message::ActiveModel as MessageActiveModel;
use crate::modules::whatsapp::flow_ai::{
    generate_free_text_reply, generate_menu_item_reply,
};
use crate::modules::whatsapp::flow_session::{
    clear_session, flow_config_context, get_flow_config, get_session, save_session,
};
use crate::modules::whatsapp::flow_types::{
    FlowInboundInput, FlowOutboundMessage, FlowStepResult, FLOW_STATE_MAIN_MENU,
};
use crate::modules::whatsapp::flows::configurable_menu::ConfigurableMenuFlow;
use crate::modules::whatsapp::menu::normalize_menu_items;
use crate::modules::whatsapp::messaging::{
    credentials_from_account, send_interactive_buttons, send_interactive_list, send_session_text,
    WhatsappCredentials,
};

pub struct TryHandleInboundParams<'a> {
    pub state: &'a AppState,
    pub tenant_id: Uuid,
    pub phone: String,
    pub text: String,
    pub interactive_id: Option<String>,
    pub account: &'a SocialAccountModel,
    pub contact_id: Option<Uuid>,
    pub lead_id: Option<Uuid>,
}

pub async fn try_handle_inbound(params: TryHandleInboundParams<'_>) -> ApiResult<bool> {
    let Some(creds) = credentials_from_account(params.account) else {
        return Ok(false);
    };

    let config = get_flow_config(
        params.state,
        params.tenant_id,
        params.account.workspace_id,
    )
    .await?;
    let globally_enabled = env::var("WHATSAPP_FLOW_ENABLED")
        .map(|v| v == "true")
        .unwrap_or(false);
    if !config.enabled && !globally_enabled {
        return Ok(false);
    }

    let normalized_text = params.text.trim().to_lowercase();
    let triggers: Vec<String> = config
        .welcome_triggers
        .iter()
        .map(|t| t.to_lowercase())
        .collect();
    let session = get_session(params.state, params.tenant_id, &params.phone).await?;

    let is_welcome = triggers.contains(&normalized_text)
        || normalized_text == "menu"
        || normalized_text == "0";
    if session.is_none()
        && !is_welcome
        && params.interactive_id.as_deref().unwrap_or("").is_empty()
    {
        return Ok(false);
    }

    let state_name = session
        .as_ref()
        .map(|s| s.current_state.clone())
        .unwrap_or_else(|| FLOW_STATE_MAIN_MENU.into());
    let mut flow_context = session
        .as_ref()
        .map(|s| s.context.clone())
        .unwrap_or_else(|| flow_config_context(&config));
    if flow_context.get("menuItems").is_none() {
        flow_context = flow_config_context(&config);
    }

    let input = FlowInboundInput {
        tenant_id: params.tenant_id,
        phone: params.phone.clone(),
        text: params.text.clone(),
        interactive_id: params.interactive_id.clone(),
        service_name: config.service_name.clone(),
        ai_fallback_enabled: config.ai_fallback_enabled,
    };

    let mut result = ConfigurableMenuFlow::handle(&state_name, &input, &flow_context);
    result = apply_ai_if_needed(params.state, &config, &params, &mut result).await?;

    if result.end_session {
        clear_session(params.state, params.tenant_id, &params.phone).await?;
    } else {
        save_session(
            params.state,
            params.tenant_id,
            &params.phone,
            &result.next_state,
            result.context.clone(),
        )
        .await?;
    }

    for msg in &result.messages {
        let sent = dispatch_message(&creds, &params.phone, msg).await;
        if sent.success {
            persist_flow_outbound(
                params.state,
                params.tenant_id,
                params.account.workspace_id,
                &params.phone,
                params.contact_id,
                params.lead_id,
                describe_outbound(msg),
                sent.wa_message_id,
            )
            .await?;
        }
    }

    tracing::info!(
        tenant_id = %params.tenant_id,
        phone = %params.phone,
        state = %result.next_state,
        "WhatsApp menu flow handled inbound"
    );
    Ok(true)
}

async fn apply_ai_if_needed(
    state: &AppState,
    config: &crate::modules::whatsapp::entity::flow_config::Model,
    params: &TryHandleInboundParams<'_>,
    result: &mut FlowStepResult,
) -> ApiResult<FlowStepResult> {
    if let Some(item) = result.ai_menu_item.take() {
        let body = generate_menu_item_reply(
            state,
            params.tenant_id,
            params.account.workspace_id,
            &config.service_name,
            &item,
        )
        .await?;
        result.messages = vec![
            FlowOutboundMessage::Text { body },
            FlowOutboundMessage::Buttons {
                body: "Anything else?".into(),
                buttons: vec![crate::modules::whatsapp::messaging::FlowButton {
                    id: "main_menu".into(),
                    title: "Main menu".into(),
                }],
            },
        ];
    } else if let Some(text) = result.ai_free_text.take() {
        let menu_titles: Vec<String> = normalize_menu_items(&config.menu_items)
            .into_iter()
            .map(|i| i.title)
            .collect();
        let body = generate_free_text_reply(
            state,
            params.tenant_id,
            params.account.workspace_id,
            &config.service_name,
            &text,
            &menu_titles,
        )
        .await?;
        result.messages = vec![
            FlowOutboundMessage::Text { body },
            FlowOutboundMessage::Buttons {
                body: "Need the menu?".into(),
                buttons: vec![crate::modules::whatsapp::messaging::FlowButton {
                    id: "main_menu".into(),
                    title: "Main menu".into(),
                }],
            },
        ];
    }
    Ok(result.clone())
}

async fn dispatch_message(
    creds: &WhatsappCredentials,
    phone: &str,
    msg: &FlowOutboundMessage,
) -> super::messaging::SendMessageResult {
    match msg {
        FlowOutboundMessage::Text { body } => send_session_text(creds, phone, body).await,
        FlowOutboundMessage::Buttons { body, buttons } => {
            send_interactive_buttons(creds, phone, body, buttons).await
        }
        FlowOutboundMessage::List {
            body,
            button_label,
            sections,
        } => send_interactive_list(creds, phone, body, button_label, sections).await,
    }
}

fn describe_outbound(msg: &FlowOutboundMessage) -> String {
    match msg {
        FlowOutboundMessage::Text { body } => body.clone(),
        FlowOutboundMessage::Buttons { body, buttons } => {
            format!(
                "{}\n[{}]",
                body,
                buttons
                    .iter()
                    .map(|b| b.title.as_str())
                    .collect::<Vec<_>>()
                    .join(" | ")
            )
        }
        FlowOutboundMessage::List { body, sections, .. } => {
            let rows: Vec<String> = sections
                .iter()
                .flat_map(|s| s.rows.iter().map(|r| r.title.clone()))
                .collect();
            format!("{}\n[{}]", body, rows.join(", "))
        }
    }
}

async fn persist_flow_outbound(
    state: &AppState,
    tenant_id: Uuid,
    workspace_id: Option<Uuid>,
    phone: &str,
    contact_id: Option<Uuid>,
    lead_id: Option<Uuid>,
    body: String,
    wa_message_id: Option<String>,
) -> ApiResult<()> {
    MessageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        workspace_id: Set(workspace_id),
        contact_id: Set(contact_id),
        lead_id: Set(lead_id),
        phone: Set(phone.to_string()),
        direction: Set("outbound".into()),
        body: Set(body),
        wa_message_id: Set(wa_message_id),
        status: Set("flow_reply".into()),
        attachments: Set(json!([])),
        reactions: Set(json!([])),
        created_at: Set(Utc::now().fixed_offset()),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;
    Ok(())
}
