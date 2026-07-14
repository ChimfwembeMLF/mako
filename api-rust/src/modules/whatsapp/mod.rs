#[allow(dead_code)]
pub mod dto;
pub mod auto_reply;
pub mod entity;
pub mod flow_ai;
pub mod flow_engine;
pub mod flow_session;
pub mod flow_types;
pub mod flows;
pub mod inbound;
pub mod lead;
pub mod menu;
pub mod messaging;

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use reqwest::Client;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder, Set,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::content_publishing::social_account::SocialPublishAccountService;
use crate::modules::social_accounts::entity::{
    Column as SocialAccountColumn, Entity as SocialAccountEntity, Model as SocialAccountModel,
};
use crate::modules::whatsapp::dto::{ReplyMessageDto, UpdateWhatsappFlowConfigDto};
use crate::modules::whatsapp::entity::flow_config::{
    ActiveModel as FlowConfigActiveModel, Column as FlowConfigColumn, Entity as FlowConfigEntity,
    Model as FlowConfigModel,
};
use crate::modules::whatsapp::entity::flow_session::{
    Column as FlowSessionColumn, Entity as FlowSessionEntity, Model as FlowSessionModel,
};
use crate::modules::whatsapp::entity::message::{
    ActiveModel as MessageActiveModel, Column as MessageColumn, Entity as MessageEntity,
    Model as MessageModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/flows/sessions",
            get(list_flow_sessions).delete(reset_flow_session),
        )
        .route(
            "/flows/config",
            get(get_flow_config).patch(update_flow_config),
        )
        .route("/messages", get(list_messages))
        .route("/messages/reply", post(reply_message))
        .route("/connection-status", get(connection_status))
        .route("/conversations", get(conversations))
}

#[derive(Deserialize)]
struct TenantQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct MessageListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    phone: Option<String>,
    #[serde(rename = "contactId")]
    contact_id: Option<Uuid>,
    take: Option<u64>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct ResetFlowQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    phone: String,
}

async fn list_flow_sessions(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let rows = FlowSessionEntity::find()
        .filter(FlowSessionColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(FlowSessionColumn::UpdatedAt)
        .all(&state.db)
        .await?;

    Ok(Json(json!(rows
        .iter()
        .map(flow_session_json)
        .collect::<Vec<_>>())))
}

async fn reset_flow_session(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ResetFlowQuery>,
) -> ApiResult<Json<Value>> {
    FlowSessionEntity::delete_many()
        .filter(FlowSessionColumn::TenantId.eq(query.tenant_id))
        .filter(FlowSessionColumn::Phone.eq(normalize_phone(&query.phone)))
        .exec(&state.db)
        .await?;

    Ok(Json(json!({ "cleared": true })))
}

async fn get_flow_config(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let config = get_or_create_flow_config(&state, query.tenant_id, query.workspace_id).await?;
    Ok(Json(flow_config_json(&config)))
}

async fn update_flow_config(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
    Json(dto): Json<UpdateWhatsappFlowConfigDto>,
) -> ApiResult<Json<Value>> {
    let existing = get_or_create_flow_config(&state, query.tenant_id, query.workspace_id).await?;
    let mut active: FlowConfigActiveModel = existing.into();

    if let Some(v) = dto.enabled {
        active.enabled = Set(v);
    }
    if let Some(v) = dto.service_name {
        active.service_name = Set(v);
    }
    if let Some(v) = dto.welcome_message {
        active.welcome_message = Set(Some(v));
    }
    if let Some(v) = dto.welcome_triggers {
        active.welcome_triggers = Set(v);
    }
    if let Some(v) = dto.ai_fallback_enabled {
        active.ai_fallback_enabled = Set(v);
    }
    if let Some(v) = dto.menu_items {
        active.menu_items = Set(v);
    }
    active.updated_at = Set(Utc::now().fixed_offset());

    let updated = active.update(&state.db).await?;
    Ok(Json(flow_config_json(&updated)))
}

async fn list_messages(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<MessageListQuery>,
) -> ApiResult<Json<Value>> {
    let limit = query.take.unwrap_or(100).min(500);
    let mut db_query = MessageEntity::find()
        .filter(MessageColumn::TenantId.eq(query.tenant_id))
        .order_by_asc(MessageColumn::CreatedAt);

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(MessageColumn::WorkspaceId.eq(workspace_id));
    }
    if let Some(contact_id) = query.contact_id {
        db_query = db_query.filter(MessageColumn::ContactId.eq(contact_id));
    } else if let Some(phone) = query.phone.as_ref().filter(|p| !p.trim().is_empty()) {
        db_query = db_query.filter(MessageColumn::Phone.eq(normalize_phone(phone)));
    }

    let rows = db_query.paginate(&state.db, limit).fetch_page(0).await?;
    Ok(Json(json!(rows
        .iter()
        .map(message_json)
        .collect::<Vec<_>>())))
}

async fn connection_status(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let account =
        find_whatsapp_account(&state, query.tenant_id, user_id, query.workspace_id).await?;
    let Some(account) = account else {
        return Ok(Json(json!({
            "connected": false,
            "message": "WhatsApp not connected",
        })));
    };

    let Some(creds) = whatsapp_credentials_from_account(&account) else {
        return Ok(Json(json!({
            "connected": false,
            "platformManaged": SocialPublishAccountService::is_platform_managed_whatsapp(&account),
            "message": "WhatsApp credentials missing — reconnect in Publisher Connect.",
        })));
    };

    let client = Client::new();
    let url = format!(
        "https://graph.facebook.com/v19.0/{}",
        urlencoding::encode(&creds.phone_number_id)
    );
    let response = client
        .get(&url)
        .query(&[
            ("fields", "id,display_phone_number"),
            ("access_token", creds.access_token.as_str()),
        ])
        .send()
        .await;

    match response {
        Ok(resp) => {
            let data = resp.json::<Value>().await.unwrap_or(json!({}));
            if data.get("error").is_some() {
                let graph_error = graph_error_summary(&data);
                return Ok(Json(json!({
                    "connected": false,
                    "platformManaged": SocialPublishAccountService::is_platform_managed_whatsapp(&account),
                    "tokenValid": false,
                    "phoneNumberId": creds.phone_number_id,
                    "graphError": graph_error,
                    "message": "WhatsApp credentials are invalid. Reconnect WhatsApp in Publisher Connect, then try again.",
                })));
            }
            Ok(Json(json!({
                "connected": true,
                "tokenValid": true,
                "phoneNumberId": creds.phone_number_id,
                "displayPhoneNumber": data.get("display_phone_number").and_then(|v| v.as_str()),
                "accountName": account.account_name,
                "platformManaged": SocialPublishAccountService::is_platform_managed_whatsapp(&account),
            })))
        }
        Err(err) => Ok(Json(json!({
            "connected": false,
            "platformManaged": SocialPublishAccountService::is_platform_managed_whatsapp(&account),
            "tokenValid": false,
            "phoneNumberId": creds.phone_number_id,
            "message": format!("WhatsApp connection check failed: {err}"),
        }))),
    }
}

async fn reply_message(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<ReplyMessageDto>,
) -> ApiResult<Json<Value>> {
    if body.phone.trim().is_empty() || body.message.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "phone and message are required".into(),
        ));
    }

    let account = find_whatsapp_account(&state, body.tenant_id, user_id, body.workspace_id).await?;
    let Some(account) = account else {
        return Ok(Json(json!({
            "sent": false,
            "message": "WhatsApp not connected",
        })));
    };
    let Some(creds) = whatsapp_credentials_from_account(&account) else {
        return Ok(Json(json!({
            "sent": false,
            "message": "WhatsApp credentials missing — reconnect in Publisher Connect.",
        })));
    };

    let normalized_phone = normalize_phone(&body.phone);
    let used_template = body.use_template.unwrap_or(false);
    let message_text = body.message.trim().to_string();

    let payload = if used_template {
        json!({
            "messaging_product": "whatsapp",
            "to": normalized_phone,
            "type": "template",
            "template": {
                "name": body.template_name.clone().unwrap_or_else(|| "hello_world".into()),
                "language": { "code": body.template_language.clone().unwrap_or_else(|| "en".into()) },
                "components": [{
                    "type": "body",
                    "parameters": [{ "type": "text", "text": message_text.chars().take(1024).collect::<String>() }]
                }]
            }
        })
    } else {
        json!({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": normalized_phone,
            "type": "text",
            "text": {
                "preview_url": false,
                "body": message_text.chars().take(4096).collect::<String>()
            }
        })
    };

    let url = format!(
        "https://graph.facebook.com/v19.0/{}/messages",
        urlencoding::encode(&creds.phone_number_id)
    );
    let client = Client::new();
    let response = client
        .post(url)
        .bearer_auth(&creds.access_token)
        .json(&payload)
        .send()
        .await;

    match response {
        Ok(resp) => {
            let data = resp.json::<Value>().await.unwrap_or(json!({}));
            if data.get("error").is_some() {
                let error_message = graph_error_summary(&data);
                save_outbound_message(
                    &state,
                    &body,
                    &normalized_phone,
                    Some("failed".into()),
                    None,
                    Some(error_message.clone()),
                )
                .await?;
                return Ok(Json(json!({
                    "sent": false,
                    "usedTemplate": used_template,
                    "message": error_message,
                })));
            }

            let wa_message_id = data
                .get("messages")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|v| v.get("id"))
                .and_then(|v| v.as_str())
                .map(str::to_string);

            let status = if used_template { "template" } else { "sent" };
            save_outbound_message(
                &state,
                &body,
                &normalized_phone,
                Some(status.into()),
                wa_message_id.clone(),
                None,
            )
            .await?;

            Ok(Json(json!({
                "sent": true,
                "waMessageId": wa_message_id,
                "usedTemplate": used_template,
            })))
        }
        Err(err) => {
            save_outbound_message(
                &state,
                &body,
                &normalized_phone,
                Some("failed".into()),
                None,
                Some(err.to_string()),
            )
            .await?;
            Ok(Json(json!({
                "sent": false,
                "usedTemplate": used_template,
                "message": format!("WhatsApp send failed: {err}"),
            })))
        }
    }
}

async fn conversations(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = MessageEntity::find()
        .filter(MessageColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(MessageColumn::CreatedAt);

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(MessageColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    let mut by_phone: HashMap<String, Value> = HashMap::new();

    for m in &rows {
        by_phone.entry(m.phone.clone()).or_insert_with(|| {
            json!({
                "phone": m.phone,
                "lastMessage": m.body,
                "lastAt": m.created_at,
                "inboundCount": if m.direction == "inbound" { 1 } else { 0 },
            })
        });
    }

    let mut conversations: Vec<Value> = by_phone.into_values().collect();
    conversations.sort_by(|a, b| {
        let a_ts = a.get("lastAt").and_then(|v| v.as_str()).unwrap_or("");
        let b_ts = b.get("lastAt").and_then(|v| v.as_str()).unwrap_or("");
        b_ts.cmp(a_ts)
    });

    Ok(Json(json!(conversations)))
}

async fn get_or_create_flow_config(
    state: &AppState,
    tenant_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<FlowConfigModel> {
    let mut query = FlowConfigEntity::find().filter(FlowConfigColumn::TenantId.eq(tenant_id));
    if let Some(ws) = workspace_id {
        query = query.filter(FlowConfigColumn::WorkspaceId.eq(ws));
    }

    if let Some(config) = query.one(&state.db).await? {
        return Ok(config);
    }

    let now = Utc::now().fixed_offset();
    FlowConfigActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        workspace_id: Set(workspace_id),
        enabled: Set(false),
        service_name: Set("MyService".into()),
        flow_type: Set("configurable_menu".into()),
        menu_items: Set(json!([])),
        ai_fallback_enabled: Set(true),
        welcome_triggers: Set(vec![
            "hi".into(),
            "hello".into(),
            "menu".into(),
            "start".into(),
            "0".into(),
        ]),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await
    .map_err(Into::into)
}

fn normalize_phone(phone: &str) -> String {
    phone
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '+')
        .collect()
}

async fn find_whatsapp_account(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<Option<SocialAccountModel>> {
    let mut user_query = SocialAccountEntity::find()
        .filter(SocialAccountColumn::TenantId.eq(tenant_id))
        .filter(SocialAccountColumn::Platform.eq("whatsapp"))
        .filter(SocialAccountColumn::Connected.eq(true))
        .filter(SocialAccountColumn::UserId.eq(user_id));
    if let Some(workspace_id) = workspace_id {
        user_query = user_query.filter(SocialAccountColumn::WorkspaceId.eq(workspace_id));
    }
    if let Some(account) = user_query.one(&state.db).await? {
        return Ok(Some(account));
    }

    let mut tenant_query = SocialAccountEntity::find()
        .filter(SocialAccountColumn::TenantId.eq(tenant_id))
        .filter(SocialAccountColumn::Platform.eq("whatsapp"))
        .filter(SocialAccountColumn::Connected.eq(true));
    if let Some(workspace_id) = workspace_id {
        tenant_query = tenant_query.filter(SocialAccountColumn::WorkspaceId.eq(workspace_id));
    }
    Ok(tenant_query.one(&state.db).await?)
}

struct WhatsappCredentials {
    phone_number_id: String,
    access_token: String,
}

fn whatsapp_credentials_from_account(account: &SocialAccountModel) -> Option<WhatsappCredentials> {
    let phone_number_id = SocialPublishAccountService::whatsapp_phone_number_id(account)?;

    let access_token = account
        .access_token
        .as_ref()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())?;

    Some(WhatsappCredentials {
        phone_number_id,
        access_token,
    })
}

fn graph_error_summary(data: &Value) -> String {
    let code = data
        .get("error")
        .and_then(|e| e.get("code"))
        .and_then(|v| v.as_i64())
        .map(|v| format!("#{v} "))
        .unwrap_or_default();
    let message = data
        .get("error")
        .and_then(|e| e.get("message"))
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown Graph API error");
    format!("{code}{message}")
}

async fn save_outbound_message(
    state: &AppState,
    body: &ReplyMessageDto,
    normalized_phone: &str,
    status: Option<String>,
    wa_message_id: Option<String>,
    error_message: Option<String>,
) -> ApiResult<()> {
    MessageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(body.tenant_id),
        workspace_id: Set(body.workspace_id),
        contact_id: Set(body.contact_id),
        lead_id: Set(body.lead_id),
        phone: Set(normalized_phone.to_string()),
        direction: Set("outbound".into()),
        body: Set(body.message.trim().to_string()),
        wa_message_id: Set(wa_message_id),
        status: Set(status.unwrap_or_else(|| "sent".into())),
        error_message: Set(error_message),
        attachments: Set(json!([])),
        reactions: Set(json!([])),
        created_at: Set(Utc::now().fixed_offset()),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;
    Ok(())
}

fn flow_session_json(s: &FlowSessionModel) -> Value {
    json!({
        "id": s.id,
        "phone": s.phone,
        "currentState": s.current_state,
        "expiresAt": s.expires_at,
        "updatedAt": s.updated_at,
    })
}

fn flow_config_json(c: &FlowConfigModel) -> Value {
    json!({
        "id": c.id,
        "tenantId": c.tenant_id,
        "workspaceId": c.workspace_id,
        "enabled": c.enabled,
        "serviceName": c.service_name,
        "welcomeMessage": c.welcome_message,
        "flowType": c.flow_type,
        "menuItems": c.menu_items,
        "aiFallbackEnabled": c.ai_fallback_enabled,
        "welcomeTriggers": c.welcome_triggers,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    })
}

fn message_json(m: &MessageModel) -> Value {
    json!({
        "id": m.id,
        "tenantId": m.tenant_id,
        "contactId": m.contact_id,
        "leadId": m.lead_id,
        "phone": m.phone,
        "direction": m.direction,
        "body": m.body,
        "status": m.status,
        "error_message": m.error_message,
        "attachments": m.attachments,
        "reactions": m.reactions,
        "created_at": m.created_at,
    })
}
