use std::env;

use chrono::Utc;
use reqwest::Client;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde_json::{json, Value};
use uuid::Uuid;

use super::social_account::SocialPublishAccountService;
use super::types::{ContentToPublish, PlatformPayloadStored, PublishResult};
use super::util::strip_html;
use crate::app_state::AppState;
use crate::modules::social_accounts::entity::Model as SocialModel;
use crate::modules::whatsapp::entity::message::ActiveModel as MessageActiveModel;
use crate::modules::whatsapp_contacts::entity::{
    Column as ContactColumn, Entity as ContactEntity, Model as ContactModel,
};

struct WhatsappCredentials {
    phone_number_id: String,
    access_token: String,
}

struct SendResult {
    success: bool,
    wa_message_id: Option<String>,
    error: Option<String>,
}

pub struct WhatsappPublishingService;

impl WhatsappPublishingService {
    pub async fn publish_post(
        state: &AppState,
        account: &SocialModel,
        content: &ContentToPublish,
        platform_payload: Option<&PlatformPayloadStored>,
    ) -> PublishResult {
        let creds = match credentials_from_account(account) {
            Some(v) => v,
            None => {
                return PublishResult {
                    published: false,
                    message:
                        "WhatsApp phone_number_id or access_token missing — reconnect WhatsApp"
                            .into(),
                    external_post_id: None,
                };
            }
        };

        let contacts = ContactEntity::find()
            .filter(ContactColumn::TenantId.eq(content.tenant_id))
            .filter(ContactColumn::OptedIn.eq(true))
            .all(&state.db)
            .await;

        let contacts = match contacts {
            Ok(rows) => rows,
            Err(err) => {
                return PublishResult {
                    published: false,
                    message: format!("Failed to load WhatsApp contacts: {err}"),
                    external_post_id: None,
                };
            }
        };

        if contacts.is_empty() {
            return PublishResult {
                published: false,
                message:
                    "No opted-in WhatsApp contacts — add contacts in Lead Agent and mark them opted in"
                        .into(),
                external_post_id: None,
            };
        }

        let plain_text = [content.title.as_deref(), Some(strip_html(&content.content).as_str())]
            .into_iter()
            .flatten()
            .filter(|s| !s.trim().is_empty())
            .collect::<Vec<_>>()
            .join("\n\n");

        let use_template = platform_payload
            .and_then(|p| p.whatsapp_use_template)
            .unwrap_or_else(|| env_flag_default_true("WHATSAPP_USE_TEMPLATE_BROADCAST"));
        let template_name = platform_payload
            .and_then(|p| p.whatsapp_template.clone())
            .or_else(|| env::var("WHATSAPP_BROADCAST_TEMPLATE").ok())
            .filter(|v| !v.trim().is_empty());
        let template_language = platform_payload
            .and_then(|p| p.whatsapp_template_language.clone())
            .unwrap_or_else(|| "en".into());

        let mut sent = 0usize;
        let mut failed = 0usize;
        let mut errors: Vec<String> = Vec::new();

        for contact in contacts {
            let mut result = if use_template && template_name.is_some() {
                send_template_text(
                    &creds,
                    &contact.phone,
                    &plain_text,
                    template_name.as_deref().unwrap(),
                    &template_language,
                )
                .await
            } else {
                send_session_text(&creds, &contact.phone, &plain_text).await
            };

            if !result.success && use_template {
                result = send_session_text(&creds, &contact.phone, &plain_text).await;
            }

            if result.success {
                let _ = persist_outbound(
                    state,
                    content.tenant_id,
                    account.workspace_id,
                    &contact,
                    &plain_text,
                    result.wa_message_id.as_deref(),
                )
                .await;
                sent += 1;
            } else {
                failed += 1;
                if let Some(err) = result.error.as_ref() {
                    if errors.len() < 3 {
                        errors.push(format!("{}: {err}", contact.phone));
                    }
                    if err.contains("133010") || err.contains("131026") {
                        let mut active: crate::modules::whatsapp_contacts::entity::ActiveModel =
                            contact.clone().into();
                        active.opted_in = Set(false);
                        let _ = active.update(&state.db).await;
                    }
                }
            }
        }

        if sent == 0 {
            let has_auth_error = errors
                .iter()
                .any(|e| e.contains("190") || e.to_lowercase().contains("oauth"));
            return PublishResult {
                published: !has_auth_error,
                message: format!(
                    "WhatsApp broadcast processed but 0 sent. {}",
                    errors.join("; ")
                ),
                external_post_id: Some(format!("wa-broadcast-{}", Utc::now().timestamp_millis())),
            };
        }

        PublishResult {
            published: true,
            message: format!(
                "WhatsApp: sent to {sent}/{} opted-in contact(s){}",
                sent + failed,
                if failed > 0 {
                    format!(" ({failed} failed)")
                } else {
                    String::new()
                }
            ),
            external_post_id: Some(format!("wa-broadcast-{}", Utc::now().timestamp_millis())),
        }
    }
}

fn credentials_from_account(account: &SocialModel) -> Option<WhatsappCredentials> {
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

async fn send_session_text(
    creds: &WhatsappCredentials,
    to_phone: &str,
    body: &str,
) -> SendResult {
    let to = normalize_phone(to_phone);
    let text = body.trim().chars().take(4096).collect::<String>();
    if text.is_empty() {
        return SendResult {
            success: false,
            wa_message_id: None,
            error: Some("Empty message body".into()),
        };
    }

    let payload = json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": { "preview_url": false, "body": text }
    });

    post_message(creds, &payload).await
}

async fn send_template_text(
    creds: &WhatsappCredentials,
    to_phone: &str,
    body: &str,
    template_name: &str,
    template_language: &str,
) -> SendResult {
    let to = normalize_phone(to_phone);
    let text = body.trim().chars().take(1024).collect::<String>();
    let payload = json!({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": { "code": template_language },
            "components": [{
                "type": "body",
                "parameters": [{ "type": "text", "text": text }]
            }]
        }
    });
    post_message(creds, &payload).await
}

async fn post_message(creds: &WhatsappCredentials, payload: &Value) -> SendResult {
    let url = format!(
        "https://graph.facebook.com/v19.0/{}/messages",
        urlencoding::encode(&creds.phone_number_id)
    );
    let client = Client::new();
    match client
        .post(url)
        .bearer_auth(&creds.access_token)
        .json(payload)
        .send()
        .await
    {
        Ok(resp) => {
            let data: Value = resp.json().await.unwrap_or(json!({}));
            if let Some(err) = data.get("error") {
                let message = err
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Graph API error");
                return SendResult {
                    success: false,
                    wa_message_id: None,
                    error: Some(message.to_string()),
                };
            }
            let wa_message_id = data
                .get("messages")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|v| v.get("id"))
                .and_then(|v| v.as_str())
                .map(str::to_string);
            SendResult {
                success: true,
                wa_message_id,
                error: None,
            }
        }
        Err(err) => SendResult {
            success: false,
            wa_message_id: None,
            error: Some(err.to_string()),
        },
    }
}

async fn persist_outbound(
    state: &AppState,
    tenant_id: Uuid,
    workspace_id: Option<Uuid>,
    contact: &ContactModel,
    body: &str,
    wa_message_id: Option<&str>,
) -> Result<(), sea_orm::DbErr> {
    MessageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        workspace_id: Set(workspace_id),
        contact_id: Set(Some(contact.id)),
        lead_id: Set(contact.lead_id),
        wa_message_id: Set(wa_message_id.map(str::to_string)),
        phone: Set(contact.phone.clone()),
        direction: Set("outbound".into()),
        body: Set(body.to_string()),
        status: Set("sent".into()),
        attachments: Set(json!([])),
        reactions: Set(json!([])),
        created_at: Set(Utc::now().fixed_offset()),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;
    Ok(())
}

fn normalize_phone(phone: &str) -> String {
    phone
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '+')
        .collect()
}

fn env_flag_default_true(key: &str) -> bool {
    match env::var(key) {
        Ok(value) => !matches!(value.to_lowercase().as_str(), "false" | "0" | "no"),
        Err(_) => true,
    }
}
