use reqwest::Client;
use serde_json::json;

use super::social_account::SocialPublishAccountService;
use super::types::{ContentToPublish, MediaAttachment, PublishResult};
use crate::modules::social_accounts::entity::Model as SocialModel;

pub struct FacebookPublishingService;

impl FacebookPublishingService {
    pub async fn publish_post(
        account: &SocialModel,
        content: &ContentToPublish,
        media: &[MediaAttachment],
    ) -> PublishResult {
        let page_token = match SocialPublishAccountService::facebook_page_token(account) {
            Some(t) => t,
            None => {
                return PublishResult {
                    published: false,
                    message:
                        "Facebook page token missing — reconnect Facebook in Publisher Connect"
                            .into(),
                    external_post_id: None,
                };
            }
        };

        let page_id = match SocialPublishAccountService::facebook_page_id(account) {
            Some(id) => id,
            None => {
                return PublishResult {
                    published: false,
                    message: "Facebook page ID missing — reconnect Facebook".into(),
                    external_post_id: None,
                };
            }
        };

        let client = Client::new();
        let plain_text = strip_html(&content.content);

        let mut attached_media = Vec::new();
        for att in media {
            if att.media_type != "image" && att.media_type != "video" {
                continue;
            }
            if att.media_type == "image" {
                if let Some(photo_id) =
                    upload_image(&client, &page_id, &page_token, &att.media_url).await
                {
                    attached_media.push(json!({ "media_fbid": photo_id }));
                }
            }
        }

        if !media.is_empty() && attached_media.is_empty() {
            return PublishResult {
                published: false,
                message: "Facebook could not upload media attachments. Ensure images are public HTTPS URLs.".into(),
                external_post_id: None,
            };
        }

        let mut body = json!({
            "message": plain_text,
            "access_token": page_token,
        });
        if !attached_media.is_empty() {
            body["attached_media"] = json!(attached_media);
        }

        let url = format!("https://graph.facebook.com/v19.0/{page_id}/feed");
        match client.post(&url).json(&body).send().await {
            Ok(resp) => {
                let data: serde_json::Value = resp.json().await.unwrap_or(json!({}));
                if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
                    PublishResult {
                        published: true,
                        message: format!("Published to Facebook. Post ID: {id}"),
                        external_post_id: Some(id.to_string()),
                    }
                } else {
                    PublishResult {
                        published: false,
                        message: format!("Facebook error: {data}"),
                        external_post_id: None,
                    }
                }
            }
            Err(e) => PublishResult {
                published: false,
                message: format!("Facebook publish failed: {e}"),
                external_post_id: None,
            },
        }
    }
}

async fn upload_image(
    client: &Client,
    page_id: &str,
    page_token: &str,
    media_url: &str,
) -> Option<String> {
    let url = format!("https://graph.facebook.com/v19.0/{page_id}/photos");
    let resp = client
        .post(&url)
        .json(&json!({
            "url": media_url,
            "published": false,
            "access_token": page_token,
        }))
        .send()
        .await
        .ok()?;
    let data: serde_json::Value = resp.json().await.ok()?;
    data.get("id").and_then(|v| v.as_str()).map(str::to_string)
}

fn strip_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_tag = false;
    for ch in input.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out.trim().to_string()
}
