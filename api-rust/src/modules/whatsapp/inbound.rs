use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde_json::json;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::content_publishing::social_account::SocialPublishAccountService;
use crate::modules::social_accounts::entity::{
    Column as SocialAccountColumn, Entity as SocialAccountEntity, Model as SocialAccountModel,
};
use crate::modules::whatsapp::auto_reply::{try_reply as try_auto_reply, TryReplyParams};
use crate::modules::whatsapp::entity::message::{
    ActiveModel as MessageActiveModel, Column as MessageColumn, Entity as MessageEntity,
};
use crate::modules::whatsapp::flow_engine::{try_handle_inbound, TryHandleInboundParams};
use crate::modules::whatsapp::lead::{capture_inbound, CaptureInboundParams};
use crate::modules::whatsapp::messaging::{credentials_from_account, normalize_phone};
use crate::modules::whatsapp_contacts::entity::{
    ActiveModel as ContactActiveModel, Column as ContactColumn, Entity as ContactEntity,
    Model as ContactModel,
};

pub async fn handle_meta_webhook(state: &AppState, body: &serde_json::Value) -> ApiResult<()> {
    let object = body.get("object").and_then(|v| v.as_str()).unwrap_or("");
    if object != "whatsapp_business_account" {
        return Ok(());
    }

    let entries = body
        .get("entry")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    for entry in entries {
        let changes = entry
            .get("changes")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        for change in changes {
            let value = change.get("value").cloned().unwrap_or_default();
            let phone_number_id = value
                .get("metadata")
                .and_then(|m| m.get("phone_number_id"))
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(str::to_string);

            if let Some(messages) = value.get("messages").and_then(|v| v.as_array()) {
                for msg in messages {
                    let from = msg
                        .get("from")
                        .and_then(|v| v.as_str())
                        .map(normalize_phone)
                        .filter(|v| !v.is_empty());
                    let Some(from) = from else {
                        continue;
                    };

                    let Some((tenant_id, account)) =
                        resolve_inbound_context(state, phone_number_id.as_deref(), &from).await?
                    else {
                        continue;
                    };

                    if let Err(err) =
                        process_inbound_message(state, tenant_id, &account, msg, &from).await
                    {
                        tracing::warn!(error = %err, "Failed to process WhatsApp inbound message");
                    }
                }
            }

            if let Some(statuses) = value.get("statuses").and_then(|v| v.as_array()) {
                for status in statuses {
                    if let Err(err) = process_delivery_status(state, status).await {
                        tracing::warn!(error = %err, "Failed to process WhatsApp delivery status");
                    }
                }
            }
        }
    }

    Ok(())
}

async fn resolve_inbound_context(
    state: &AppState,
    phone_number_id: Option<&str>,
    from_phone: &str,
) -> ApiResult<Option<(Uuid, SocialAccountModel)>> {
    if let Some(pid) = phone_number_id {
        if let Some(account) = resolve_account_by_phone_number_id(state, pid).await? {
            return Ok(Some((account.tenant_id, account)));
        }
    }

    resolve_platform_tenant_for_inbound(state, from_phone).await
}

async fn resolve_account_by_phone_number_id(
    state: &AppState,
    phone_number_id: &str,
) -> ApiResult<Option<SocialAccountModel>> {
    let accounts = SocialAccountEntity::find()
        .filter(SocialAccountColumn::Platform.eq("whatsapp"))
        .filter(SocialAccountColumn::Connected.eq(true))
        .all(&state.db)
        .await?;

    Ok(accounts.into_iter().find(|account| {
        account
            .metadata
            .as_ref()
            .and_then(|m| m.get("phone_number_id"))
            .and_then(|v| v.as_str())
            .map(|v| v.trim() == phone_number_id)
            .unwrap_or(false)
            || account.external_id.as_deref() == Some(phone_number_id)
    }))
}

async fn resolve_platform_tenant_for_inbound(
    state: &AppState,
    from_phone: &str,
) -> ApiResult<Option<(Uuid, SocialAccountModel)>> {
    let phone = normalize_phone(from_phone);
    let contacts = ContactEntity::find()
        .filter(ContactColumn::Phone.eq(&phone))
        .all(&state.db)
        .await?;

    let tenant_id = if contacts.len() == 1 {
        Some(contacts[0].tenant_id)
    } else if contacts.len() > 1 {
        MessageEntity::find()
            .filter(MessageColumn::Phone.eq(&phone))
            .order_by_desc(MessageColumn::CreatedAt)
            .one(&state.db)
            .await?
            .map(|m| m.tenant_id)
            .or_else(|| contacts.first().map(|c| c.tenant_id))
    } else {
        MessageEntity::find()
            .filter(MessageColumn::Phone.eq(&phone))
            .filter(MessageColumn::Direction.eq("outbound"))
            .order_by_desc(MessageColumn::CreatedAt)
            .one(&state.db)
            .await?
            .map(|m| m.tenant_id)
    };

    if let Some(tenant_id) = tenant_id {
        if let Some(account) = SocialAccountEntity::find()
            .filter(SocialAccountColumn::TenantId.eq(tenant_id))
            .filter(SocialAccountColumn::Platform.eq("whatsapp"))
            .filter(SocialAccountColumn::Connected.eq(true))
            .one(&state.db)
            .await?
        {
            return Ok(Some((tenant_id, account)));
        }
    }

    let platform_accounts = SocialAccountEntity::find()
        .filter(SocialAccountColumn::Platform.eq("whatsapp"))
        .filter(SocialAccountColumn::Connected.eq(true))
        .all(&state.db)
        .await?;
    let managed: Vec<_> = platform_accounts
        .into_iter()
        .filter(|a| SocialPublishAccountService::is_platform_managed_whatsapp(a))
        .collect();
    if managed.len() == 1 {
        let account = managed.into_iter().next().unwrap();
        return Ok(Some((account.tenant_id, account)));
    }

    Ok(None)
}

async fn process_inbound_message(
    state: &AppState,
    tenant_id: Uuid,
    account: &SocialAccountModel,
    msg: &serde_json::Value,
    from: &str,
) -> ApiResult<()> {
    let wa_message_id = msg.get("id").and_then(|v| v.as_str()).map(str::to_string);
    if let Some(ref mid) = wa_message_id {
        let exists = MessageEntity::find()
            .filter(MessageColumn::TenantId.eq(tenant_id))
            .filter(MessageColumn::WaMessageId.eq(mid))
            .one(&state.db)
            .await?
            .is_some();
        if exists {
            return Ok(());
        }
    }

    let parsed = parse_inbound_message(msg);
    let Some(parsed) = parsed else {
        return Ok(());
    };

    let now = Utc::now().fixed_offset();
    let contact = upsert_contact(state, tenant_id, account.workspace_id, from, now).await?;

    let saved = MessageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        workspace_id: Set(account.workspace_id),
        contact_id: Set(Some(contact.id)),
        lead_id: Set(contact.lead_id),
        wa_message_id: Set(wa_message_id),
        phone: Set(from.to_string()),
        direction: Set("inbound".into()),
        body: Set(parsed.text.clone()),
        status: Set("received".into()),
        attachments: Set(json!(parsed.attachments)),
        reactions: Set(json!([])),
        created_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    let lead_id = capture_inbound(
        state,
        CaptureInboundParams {
            tenant_id,
            contact: contact.clone(),
            message: parsed.text.clone(),
            message_row_id: saved.id,
        },
    )
    .await?;

    tracing::info!(tenant_id = %tenant_id, phone = %from, "WhatsApp inbound message stored");

    if credentials_from_account(account).is_some() {
        let inbound_text = saved.body.clone();
        let handled_by_flow = try_handle_inbound(TryHandleInboundParams {
            state,
            tenant_id,
            phone: from.to_string(),
            text: inbound_text.clone(),
            interactive_id: parsed.interactive_id,
            account,
            contact_id: Some(contact.id),
            lead_id,
        })
        .await?;
        if handled_by_flow {
            return Ok(());
        }

        let _ = try_auto_reply(TryReplyParams {
            state,
            tenant_id,
            phone: from.to_string(),
            inbound_text,
            account,
            contact_id: Some(contact.id),
            lead_id,
        })
        .await?;
    }

    Ok(())
}

struct ParsedInbound {
    text: String,
    interactive_id: Option<String>,
    attachments: Vec<serde_json::Value>,
}

fn parse_inbound_message(msg: &serde_json::Value) -> Option<ParsedInbound> {
    let msg_type = msg.get("type").and_then(|v| v.as_str()).unwrap_or("");
    match msg_type {
        "text" => msg
            .get("text")
            .and_then(|t| t.get("body"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(|text| ParsedInbound {
                text: text.to_string(),
                interactive_id: None,
                attachments: vec![],
            }),
        "interactive" => {
            let interactive = msg.get("interactive")?;
            let button = interactive.get("button_reply");
            let list = interactive.get("list_reply");
            let interactive_id = button
                .or(list)
                .and_then(|r| r.get("id"))
                .and_then(|v| v.as_str())
                .map(str::to_string);
            let label = button
                .or(list)
                .and_then(|r| r.get("title"))
                .and_then(|v| v.as_str())
                .or(interactive_id.as_deref())
                .unwrap_or("")
                .to_string();
            if label.is_empty() && interactive_id.is_none() {
                return None;
            }
            Some(ParsedInbound {
                text: label,
                interactive_id,
                attachments: vec![],
            })
        }
        "button" => {
            let button = msg.get("button")?;
            Some(ParsedInbound {
                text: button
                    .get("text")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                interactive_id: button
                    .get("payload")
                    .and_then(|v| v.as_str())
                    .map(str::to_string),
                attachments: vec![],
            })
        }
        "image" | "video" | "audio" | "document" | "sticker" => {
            let media = msg.get(msg_type)?;
            let media_id = media.get("id").and_then(|v| v.as_str())?;
            let text = if msg_type == "document" {
                format!(
                    "📎 {}",
                    media
                        .get("filename")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Document")
                )
            } else {
                format!("📷 {msg_type}")
            };
            Some(ParsedInbound {
                text,
                interactive_id: None,
                attachments: vec![json!({
                    "type": msg_type,
                    "mediaId": media_id,
                    "mimeType": media.get("mime_type").and_then(|v| v.as_str()),
                    "name": media.get("filename").and_then(|v| v.as_str()),
                })],
            })
        }
        _ => Some(ParsedInbound {
            text: format!("[{msg_type} message]"),
            interactive_id: None,
            attachments: vec![],
        }),
    }
}

async fn upsert_contact(
    state: &AppState,
    tenant_id: Uuid,
    workspace_id: Option<Uuid>,
    phone: &str,
    now: chrono::DateTime<chrono::FixedOffset>,
) -> ApiResult<ContactModel> {
    if let Some(existing) = ContactEntity::find()
        .filter(ContactColumn::TenantId.eq(tenant_id))
        .filter(ContactColumn::Phone.eq(phone))
        .one(&state.db)
        .await?
    {
        return Ok(existing);
    }

    Ok(ContactActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        workspace_id: Set(workspace_id),
        phone: Set(phone.to_string()),
        name: Set(None),
        opted_in: Set(true),
        opted_in_at: Set(Some(now)),
        tags: Set(Some(vec!["inbound".into()])),
        lead_id: Set(None),
        created_at: Set(now),
    }
    .insert(&state.db)
    .await?)
}

async fn process_delivery_status(
    state: &AppState,
    status: &serde_json::Value,
) -> ApiResult<()> {
    let wa_message_id = status.get("id").and_then(|v| v.as_str());
    let delivery_status = status
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    let Some(wa_message_id) = wa_message_id else {
        return Ok(());
    };

    let Some(row) = MessageEntity::find()
        .filter(MessageColumn::WaMessageId.eq(wa_message_id))
        .one(&state.db)
        .await?
    else {
        return Ok(());
    };

    let mapped = match delivery_status {
        "sent" => "sent",
        "delivered" => "delivered",
        "read" => "read",
        "failed" => "failed",
        _ => return Ok(()),
    };

    let error_message = if delivery_status == "failed" {
        status
            .get("errors")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .map(|err| {
                err.get("message")
                    .or_else(|| err.get("title"))
                    .and_then(|v| v.as_str())
                    .map(str::to_string)
                    .unwrap_or_else(|| {
                        format!(
                            "WhatsApp delivery failed (code {})",
                            err.get("code")
                                .and_then(|v| v.as_i64())
                                .map(|c| c.to_string())
                                .unwrap_or_else(|| "?".into())
                        )
                    })
            })
    } else {
        None
    };

    let mut active: crate::modules::whatsapp::entity::message::ActiveModel = row.into();
    active.status = Set(mapped.into());
    active.error_message = Set(error_message);
    active.update(&state.db).await?;
    Ok(())
}
