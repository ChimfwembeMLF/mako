use reqwest::Client;
use serde_json::{json, Value};

use crate::modules::content_publishing::social_account::SocialPublishAccountService;
use crate::modules::social_accounts::entity::Model as SocialAccountModel;

#[derive(Clone)]
pub struct WhatsappCredentials {
    pub phone_number_id: String,
    pub access_token: String,
}

pub struct SendMessageResult {
    pub success: bool,
    pub wa_message_id: Option<String>,
    pub error: Option<String>,
}

pub fn normalize_phone(phone: &str) -> String {
    phone
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '+')
        .collect()
}

pub fn credentials_from_account(account: &SocialAccountModel) -> Option<WhatsappCredentials> {
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

pub async fn send_session_text(
    creds: &WhatsappCredentials,
    to_phone: &str,
    body: &str,
) -> SendMessageResult {
    let to = normalize_phone(to_phone);
    let text = body.trim().chars().take(4096).collect::<String>();
    if text.is_empty() {
        return SendMessageResult {
            success: false,
            wa_message_id: None,
            error: Some("Empty message body".into()),
        };
    }
    post_message(
        creds,
        json!({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": { "preview_url": false, "body": text }
        }),
    )
    .await
}

pub async fn send_interactive_buttons(
    creds: &WhatsappCredentials,
    to_phone: &str,
    body: &str,
    buttons: &[FlowButton],
) -> SendMessageResult {
    let trimmed: Vec<Value> = buttons
        .iter()
        .take(3)
        .map(|b| {
            json!({
                "type": "reply",
                "reply": {
                    "id": b.id.chars().take(256).collect::<String>(),
                    "title": b.title.chars().take(20).collect::<String>()
                }
            })
        })
        .collect();

    if trimmed.is_empty() {
        return send_session_text(creds, to_phone, body).await;
    }

    let to = normalize_phone(to_phone);
    post_message(
        creds,
        json!({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": { "text": body.trim().chars().take(1024).collect::<String>() },
                "action": { "buttons": trimmed }
            }
        }),
    )
    .await
}

pub async fn send_interactive_list(
    creds: &WhatsappCredentials,
    to_phone: &str,
    body: &str,
    button_label: &str,
    sections: &[FlowListSection],
) -> SendMessageResult {
    let to = normalize_phone(to_phone);
    let sections_json: Vec<Value> = sections
        .iter()
        .take(10)
        .map(|section| {
            json!({
                "title": section.title.as_deref().unwrap_or("Options").chars().take(24).collect::<String>(),
                "rows": section.rows.iter().take(10).map(|row| {
                    json!({
                        "id": row.id.chars().take(200).collect::<String>(),
                        "title": row.title.chars().take(24).collect::<String>(),
                        "description": row.description.as_deref().unwrap_or("").chars().take(72).collect::<String>()
                    })
                }).collect::<Vec<_>>()
            })
        })
        .collect();

    post_message(
        creds,
        json!({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "list",
                "body": { "text": body.trim().chars().take(1024).collect::<String>() },
                "action": {
                    "button": button_label.chars().take(20).collect::<String>(),
                    "sections": sections_json
                }
            }
        }),
    )
    .await
}

async fn post_message(creds: &WhatsappCredentials, payload: Value) -> SendMessageResult {
    let url = format!(
        "https://graph.facebook.com/v19.0/{}/messages",
        urlencoding::encode(&creds.phone_number_id)
    );
    let client = Client::new();
    match client
        .post(url)
        .bearer_auth(&creds.access_token)
        .json(&payload)
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
                return SendMessageResult {
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
            SendMessageResult {
                success: true,
                wa_message_id,
                error: None,
            }
        }
        Err(err) => SendMessageResult {
            success: false,
            wa_message_id: None,
            error: Some(err.to_string()),
        },
    }
}

#[derive(Clone, Debug)]
pub struct FlowButton {
    pub id: String,
    pub title: String,
}

#[derive(Clone, Debug)]
pub struct FlowListSection {
    pub title: Option<String>,
    pub rows: Vec<FlowListRow>,
}

#[derive(Clone, Debug)]
pub struct FlowListRow {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
}
