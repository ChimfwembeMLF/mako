pub mod dto;
pub mod entity;
pub mod inbound;
pub mod dm_auto_reply;

use std::collections::HashMap;

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use reqwest::Client;
use sea_orm::{ActiveModelTrait, Set};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::ApiError;
use crate::common::ApiResult;
use crate::modules::social_accounts::entity::{
    Column as SocialAccountColumn, Entity as SocialAccountEntity, Model as SocialAccountModel,
};
use crate::modules::social_inbox::dto::{ReplyMessageDto, SyncInboxDto};
use crate::modules::social_inbox::entity::{
    ActiveModel as InboxMessageActiveModel, Column as MessageColumn, Entity as MessageEntity,
    Model as MessageModel,
};
use crate::modules::whatsapp::entity::message::{
    ActiveModel as WhatsappMessageActiveModel, Column as WhatsappMessageColumn,
    Entity as WhatsappMessageEntity,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/conversations", get(list_conversations))
        .route("/messages", get(list_messages))
        .route("/sync", post(sync_inbox))
        .route("/messages/reply", post(reply_message))
}

#[derive(Deserialize)]
struct ConversationsQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    channel: Option<String>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct MessagesQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "conversationId")]
    conversation_id: String,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

async fn list_conversations(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ConversationsQuery>,
) -> ApiResult<Json<Value>> {
    let channel = query.channel.as_deref().unwrap_or("all");

    let mut db_query = MessageEntity::find()
        .filter(MessageColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(MessageColumn::CreatedAt);

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(MessageColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    let conversations = build_conversations(&rows, channel);
    Ok(Json(json!(conversations)))
}

async fn list_messages(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<MessagesQuery>,
) -> ApiResult<Json<Value>> {
    if let Some(phone) = query.conversation_id.strip_prefix("wa:") {
        let normalized_phone = normalize_phone(phone);
        let mut wa_query = WhatsappMessageEntity::find()
            .filter(WhatsappMessageColumn::TenantId.eq(query.tenant_id))
            .filter(WhatsappMessageColumn::Phone.eq(normalized_phone))
            .order_by_asc(WhatsappMessageColumn::CreatedAt);
        if let Some(workspace_id) = query.workspace_id {
            wa_query = wa_query.filter(WhatsappMessageColumn::WorkspaceId.eq(workspace_id));
        }
        let rows = wa_query.all(&state.db).await?;
        return Ok(Json(json!(rows
            .into_iter()
            .map(|m| {
                json!({
                    "id": m.id,
                    "channel": "whatsapp",
                    "platform": "whatsapp",
                    "direction": m.direction,
                    "body": m.body,
                    "attachments": m.attachments,
                    "reactions": m.reactions,
                    "status": m.status,
                    "created_at": m.created_at,
                })
            })
            .collect::<Vec<_>>())));
    }

    let (platform, thread_id) = parse_conversation_id(&query.conversation_id);

    let mut db_query = MessageEntity::find()
        .filter(MessageColumn::TenantId.eq(query.tenant_id))
        .filter(MessageColumn::ThreadId.eq(thread_id))
        .order_by_asc(MessageColumn::CreatedAt);

    if let Some(platform) = platform {
        db_query = db_query.filter(MessageColumn::Platform.eq(platform));
    }

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(MessageColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(message_json)
        .collect::<Vec<_>>())))
}

async fn sync_inbox(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<SyncInboxDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| crate::common::ApiError::BadRequest(e.to_string()))?;

    let synced = sync_social_inbox(&state, payload.tenant_id, payload.workspace_id).await?;

    Ok(Json(json!({
        "synced": synced > 0,
        "syncedCount": synced,
        "tenantId": payload.tenant_id,
        "userId": user_id,
        "workspaceId": payload.workspace_id,
        "message": format!("Inbox sync complete: {synced} new messages"),
    })))
}

async fn reply_message(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<ReplyMessageDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| crate::common::ApiError::BadRequest(e.to_string()))?;

    let trimmed_message = payload.message.trim();
    if trimmed_message.is_empty() {
        return Err(ApiError::BadRequest("message is required".into()));
    }

    if let Some(phone) = payload.conversation_id.strip_prefix("wa:") {
        let normalized_phone = normalize_phone(phone);
        let account =
            find_whatsapp_account(&state, payload.tenant_id, user_id, payload.workspace_id).await?;
        let Some(account) = account else {
            return Ok(Json(
                json!({ "sent": false, "message": "WhatsApp not connected" }),
            ));
        };
        let Some(creds) = whatsapp_credentials_from_account(&account) else {
            return Ok(Json(
                json!({ "sent": false, "message": "WhatsApp credentials missing" }),
            ));
        };

        let graph_payload = if payload.use_template.unwrap_or(false) {
            json!({
                "messaging_product": "whatsapp",
                "to": normalized_phone,
                "type": "template",
                "template": {
                    "name": payload.template_name.clone().unwrap_or_else(|| "hello_world".into()),
                    "language": { "code": payload.template_language.clone().unwrap_or_else(|| "en".into()) },
                    "components": [{
                        "type": "body",
                        "parameters": [{ "type": "text", "text": trimmed_message.chars().take(1024).collect::<String>() }]
                    }]
                }
            })
        } else {
            json!({
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": normalized_phone,
                "type": "text",
                "text": { "preview_url": false, "body": trimmed_message.chars().take(4096).collect::<String>() }
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
            .json(&graph_payload)
            .send()
            .await;

        return match response {
            Ok(resp) => {
                let data = resp.json::<Value>().await.unwrap_or(json!({}));
                if data.get("error").is_some() {
                    return Ok(Json(json!({
                        "sent": false,
                        "message": graph_error_summary(&data),
                    })));
                }

                let wa_message_id = data
                    .get("messages")
                    .and_then(|v| v.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|v| v.get("id"))
                    .and_then(|v| v.as_str())
                    .map(str::to_string);
                let status = if payload.use_template.unwrap_or(false) {
                    "template"
                } else {
                    "sent"
                };
                WhatsappMessageActiveModel {
                    id: Set(Uuid::new_v4()),
                    tenant_id: Set(payload.tenant_id),
                    workspace_id: Set(payload.workspace_id),
                    contact_id: Set(None),
                    lead_id: Set(None),
                    wa_message_id: Set(wa_message_id),
                    phone: Set(normalized_phone),
                    direction: Set("outbound".into()),
                    body: Set(trimmed_message.to_string()),
                    status: Set(status.into()),
                    error_message: Set(None),
                    attachments: Set(json!([])),
                    reactions: Set(json!([])),
                    created_at: Set(Utc::now().fixed_offset()),
                }
                .insert(&state.db)
                .await?;

                Ok(Json(json!({
                    "sent": true,
                    "tenantId": payload.tenant_id,
                    "userId": user_id,
                    "conversationId": payload.conversation_id,
                })))
            }
            Err(err) => Ok(Json(json!({
                "sent": false,
                "message": format!("WhatsApp send failed: {err}"),
            }))),
        };
    }

    if !payload.conversation_id.starts_with("dm:") {
        return Ok(Json(json!({
            "sent": false,
            "message": "Use comment reply endpoints for post threads",
        })));
    }

    let (platform, thread_id) = parse_conversation_id(&payload.conversation_id);
    let Some(platform) = platform else {
        return Err(ApiError::BadRequest("Invalid conversation ID".into()));
    };

    let account = find_social_account(
        &state,
        payload.tenant_id,
        user_id,
        payload.workspace_id,
        &platform,
    )
    .await?;
    let Some(account) = account else {
        return Ok(Json(json!({
            "sent": false,
            "message": format!("{platform} not connected"),
        })));
    };

    let last_inbound = MessageEntity::find()
        .filter(MessageColumn::TenantId.eq(payload.tenant_id))
        .filter(MessageColumn::Platform.eq(platform.clone()))
        .filter(MessageColumn::ThreadId.eq(thread_id.clone()))
        .filter(MessageColumn::Direction.eq("inbound"))
        .order_by_desc(MessageColumn::CreatedAt)
        .one(&state.db)
        .await?;
    let Some(last_inbound) = last_inbound else {
        return Ok(Json(
            json!({ "sent": false, "message": "No recipient found" }),
        ));
    };
    let token = page_token_from_account(&account).unwrap_or_default();
    if token.trim().is_empty() {
        return Ok(Json(
            json!({ "sent": false, "message": "Page token missing — reconnect account" }),
        ));
    }

    let client = Client::new();
    let send_response = client
        .post("https://graph.facebook.com/v19.0/me/messages")
        .query(&[("access_token", token.as_str())])
        .json(&json!({
            "recipient": { "id": last_inbound.participant_id },
            "message": { "text": trimmed_message },
        }))
        .send()
        .await;
    match send_response {
        Ok(resp) => {
            let data = resp.json::<Value>().await.unwrap_or(json!({}));
            if data.get("error").is_some() {
                return Ok(Json(json!({
                    "sent": false,
                    "message": graph_error_summary(&data),
                })));
            }
            InboxMessageActiveModel {
                id: Set(Uuid::new_v4()),
                tenant_id: Set(payload.tenant_id),
                workspace_id: Set(payload.workspace_id.or(account.workspace_id)),
                platform: Set(platform),
                thread_id: Set(thread_id),
                external_message_id: Set(data
                    .get("message_id")
                    .and_then(|v| v.as_str())
                    .map(str::to_string)),
                participant_id: Set(last_inbound.participant_id.clone()),
                participant_name: Set(last_inbound.participant_name.clone()),
                participant_avatar_url: Set(last_inbound.participant_avatar_url.clone()),
                direction: Set("outbound".into()),
                body: Set(trimmed_message.to_string()),
                attachments: Set(json!([])),
                reactions: Set(json!([])),
                status: Set("sent".into()),
                created_at: Set(Utc::now().fixed_offset()),
            }
            .insert(&state.db)
            .await?;

            Ok(Json(json!({
                "sent": true,
                "tenantId": payload.tenant_id,
                "userId": user_id,
                "conversationId": payload.conversation_id,
            })))
        }
        Err(err) => Ok(Json(json!({
            "sent": false,
            "message": format!("Reply failed: {err}"),
        }))),
    }
}

fn parse_conversation_id(conversation_id: &str) -> (Option<String>, String) {
    if let Some(rest) = conversation_id.strip_prefix("dm:") {
        let mut parts = rest.splitn(2, ':');
        let platform = parts.next().map(str::to_string);
        let thread_id = parts.next().unwrap_or(rest).to_string();
        (platform, thread_id)
    } else {
        (None, conversation_id.to_string())
    }
}

fn build_conversations(rows: &[MessageModel], channel: &str) -> Vec<Value> {
    if channel == "post_comment" {
        return vec![];
    }

    let mut threads: HashMap<(String, String), &MessageModel> = HashMap::new();
    for row in rows {
        let key = (row.platform.clone(), row.thread_id.clone());
        threads.entry(key).or_insert(row);
    }

    let mut conversations: Vec<Value> = threads
        .into_iter()
        .map(|((platform, thread_id), latest)| {
            json!({
                "id": format!("dm:{platform}:{thread_id}"),
                "channel": "dm",
                "platform": platform,
                "title": latest.participant_name.clone().unwrap_or_else(|| "Direct message".into()),
                "preview": latest.body.chars().take(120).collect::<String>(),
                "lastAt": latest.created_at,
                "unreadCount": if latest.direction == "inbound" && latest.status == "received" { 1 } else { 0 },
                "pendingCount": 0,
                "participantName": latest.participant_name,
                "participantAvatarUrl": latest.participant_avatar_url,
                "threadId": thread_id,
            })
        })
        .collect();

    conversations.sort_by(|a, b| {
        let a_ts = a.get("lastAt").and_then(|v| v.as_str()).unwrap_or("");
        let b_ts = b.get("lastAt").and_then(|v| v.as_str()).unwrap_or("");
        b_ts.cmp(a_ts)
    });

    conversations
}

fn message_json(row: &MessageModel) -> Value {
    json!({
        "id": row.id,
        "channel": "dm",
        "platform": row.platform,
        "direction": row.direction,
        "body": row.body,
        "attachments": row.attachments,
        "reactions": row.reactions,
        "status": row.status,
        "authorName": row.participant_name,
        "authorAvatarUrl": row.participant_avatar_url,
        "created_at": row.created_at,
    })
}

async fn sync_social_inbox(
    state: &AppState,
    tenant_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<usize> {
    let mut account_query = SocialAccountEntity::find()
        .filter(SocialAccountColumn::TenantId.eq(tenant_id))
        .filter(SocialAccountColumn::Connected.eq(true));
    if let Some(workspace_id) = workspace_id {
        account_query = account_query.filter(SocialAccountColumn::WorkspaceId.eq(workspace_id));
    }
    let accounts = account_query.all(&state.db).await?;

    let mut synced = 0usize;
    let client = Client::new();
    for account in accounts {
        if account.platform != "facebook" && account.platform != "instagram" {
            continue;
        }
        let token = page_token_from_account(&account).unwrap_or_default();
        let page_id = page_id_from_account(&account).unwrap_or_default();
        if token.trim().is_empty() || page_id.trim().is_empty() {
            continue;
        }

        let conversations_url = format!(
            "https://graph.facebook.com/v19.0/{}/conversations",
            urlencoding::encode(&page_id)
        );
        let response = client
            .get(conversations_url)
            .query(&[
                ("access_token", token.as_str()),
                ("fields", "id,participants,updated_time,messages.limit(25){id,message,from,created_time,attachments,reactions}"),
                ("limit", "25"),
            ])
            .send()
            .await;

        let Ok(response) = response else { continue };
        let data = response.json::<Value>().await.unwrap_or(json!({}));
        let Some(conversations) = data.get("data").and_then(|v| v.as_array()) else {
            continue;
        };

        for conv in conversations {
            let thread_id = conv
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            if thread_id.is_empty() {
                continue;
            }
            let participants = conv
                .get("participants")
                .and_then(|v| v.get("data"))
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            let customer = participants
                .iter()
                .find(|p| p.get("id").and_then(|v| v.as_str()) != Some(page_id.as_str()))
                .cloned()
                .or_else(|| participants.first().cloned())
                .unwrap_or_else(|| json!({}));

            let messages = conv
                .get("messages")
                .and_then(|v| v.get("data"))
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            for msg in messages {
                let external_id = msg
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string();
                if external_id.is_empty() {
                    continue;
                }
                let exists = MessageEntity::find()
                    .filter(MessageColumn::TenantId.eq(tenant_id))
                    .filter(MessageColumn::Platform.eq(account.platform.clone()))
                    .filter(MessageColumn::ExternalMessageId.eq(external_id.clone()))
                    .one(&state.db)
                    .await?;
                if exists.is_some() {
                    continue;
                }

                let from = msg.get("from").cloned().unwrap_or_else(|| json!({}));
                let from_id = from.get("id").and_then(|v| v.as_str()).unwrap_or_default();
                let is_outbound = from_id == page_id;
                let attachments = parse_attachments(msg.get("attachments"));
                let reactions = parse_reactions(msg.get("reactions"));
                let message_text = msg
                    .get("message")
                    .and_then(|v| v.as_str())
                    .map(str::to_string)
                    .filter(|v| !v.trim().is_empty())
                    .unwrap_or_else(|| attachment_preview(&attachments));

                InboxMessageActiveModel {
                    id: Set(Uuid::new_v4()),
                    tenant_id: Set(tenant_id),
                    workspace_id: Set(workspace_id.or(account.workspace_id)),
                    platform: Set(account.platform.clone()),
                    thread_id: Set(thread_id.clone()),
                    external_message_id: Set(Some(external_id)),
                    participant_id: Set(customer
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or(from_id)
                        .to_string()),
                    participant_name: Set(customer
                        .get("name")
                        .and_then(|v| v.as_str())
                        .map(str::to_string)
                        .or_else(|| {
                            from.get("name")
                                .and_then(|v| v.as_str())
                                .map(str::to_string)
                        })),
                    participant_avatar_url: Set(None),
                    direction: Set(if is_outbound {
                        "outbound".into()
                    } else {
                        "inbound".into()
                    }),
                    body: Set(message_text),
                    attachments: Set(json!(attachments)),
                    reactions: Set(json!(reactions)),
                    status: Set(if is_outbound {
                        "sent".into()
                    } else {
                        "received".into()
                    }),
                    created_at: Set(msg
                        .get("created_time")
                        .and_then(|v| v.as_str())
                        .and_then(|v| chrono::DateTime::parse_from_rfc3339(v).ok())
                        .map(|dt| dt.fixed_offset())
                        .unwrap_or_else(|| Utc::now().fixed_offset())),
                }
                .insert(&state.db)
                .await?;
                synced += 1;
            }
        }
    }
    Ok(synced)
}

async fn find_social_account(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
    platform: &str,
) -> ApiResult<Option<SocialAccountModel>> {
    let mut user_query = SocialAccountEntity::find()
        .filter(SocialAccountColumn::TenantId.eq(tenant_id))
        .filter(SocialAccountColumn::Platform.eq(platform))
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
        .filter(SocialAccountColumn::Platform.eq(platform))
        .filter(SocialAccountColumn::Connected.eq(true));
    if let Some(workspace_id) = workspace_id {
        tenant_query = tenant_query.filter(SocialAccountColumn::WorkspaceId.eq(workspace_id));
    }
    Ok(tenant_query.one(&state.db).await?)
}

async fn find_whatsapp_account(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<Option<SocialAccountModel>> {
    find_social_account(state, tenant_id, user_id, workspace_id, "whatsapp").await
}

struct WhatsappCredentials {
    phone_number_id: String,
    access_token: String,
}

fn whatsapp_credentials_from_account(account: &SocialAccountModel) -> Option<WhatsappCredentials> {
    let phone_number_id = account
        .metadata
        .as_ref()
        .and_then(|m| m.get("phone_number_id"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
        .or_else(|| account.external_id.clone())?;
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

fn page_token_from_account(account: &SocialAccountModel) -> Option<String> {
    account
        .metadata
        .as_ref()
        .and_then(|m| m.get("page_token"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| account.access_token.clone())
}

fn page_id_from_account(account: &SocialAccountModel) -> Option<String> {
    account
        .metadata
        .as_ref()
        .and_then(|m| m.get("page_id"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| account.external_id.clone())
}

fn parse_attachments(raw: Option<&Value>) -> Vec<Value> {
    let mut out = Vec::new();
    let data = raw
        .and_then(|v| v.get("data"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    for item in data {
        let mime = item.get("mime_type").and_then(|v| v.as_str());
        let url = item
            .get("file_url")
            .or_else(|| item.get("image_data").and_then(|v| v.get("url")))
            .or_else(|| item.get("video_data").and_then(|v| v.get("url")))
            .and_then(|v| v.as_str());
        if let Some(url) = url {
            let item_type = if mime.unwrap_or_default().starts_with("video") {
                "video"
            } else {
                "image"
            };
            out.push(json!({
                "url": url,
                "type": item_type,
                "name": item.get("name").and_then(|v| v.as_str()),
                "mimeType": mime,
            }));
        }
    }
    out
}

fn parse_reactions(raw: Option<&Value>) -> Vec<Value> {
    let data = raw
        .and_then(|v| v.get("data"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    data.into_iter()
        .map(|item| {
            json!({
                "type": item.get("reaction").and_then(|v| v.as_str()).unwrap_or("like"),
                "count": item.get("users").and_then(|v| v.as_array()).map(|arr| arr.len()).unwrap_or(1),
            })
        })
        .collect()
}

fn attachment_preview(attachments: &[Value]) -> String {
    if attachments.is_empty() {
        return String::new();
    }
    let item_type = attachments[0]
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("attachment");
    match item_type {
        "video" => "📹 Video attachment".into(),
        "image" => "📷 Photo attachment".into(),
        _ => "📎 Attachment".into(),
    }
}

fn normalize_phone(phone: &str) -> String {
    phone
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '+')
        .collect()
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
