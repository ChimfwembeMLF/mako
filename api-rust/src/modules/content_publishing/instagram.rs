use reqwest::Client;
use serde_json::json;

use super::social_account::SocialPublishAccountService;
use super::types::{ContentToPublish, MediaAttachment, PublishResult};
use crate::modules::social_accounts::entity::Model as SocialModel;

pub struct InstagramPublishingService;

impl InstagramPublishingService {
    pub async fn publish_post(
        account: &SocialModel,
        content: &ContentToPublish,
        media: &[MediaAttachment],
    ) -> PublishResult {
        if media.is_empty() {
            return PublishResult {
                published: false,
                message: "Instagram requires at least one image or video attachment".into(),
                external_post_id: None,
            };
        }

        let ig_token = match SocialPublishAccountService::instagram_token(account) {
            Some(t) if !t.trim().is_empty() => t,
            _ => {
                return PublishResult {
                    published: false,
                    message:
                        "Instagram credentials missing — reconnect Instagram in Publisher Connect"
                            .into(),
                    external_post_id: None,
                };
            }
        };

        let ig_account_id = match SocialPublishAccountService::instagram_business_id(account) {
            Some(id) if !id.trim().is_empty() => id,
            _ => {
                return PublishResult {
                    published: false,
                    message:
                        "Instagram credentials missing — reconnect Instagram in Publisher Connect"
                            .into(),
                    external_post_id: None,
                };
            }
        };

        let caption = strip_html(&content.content);
        let client = Client::new();
        let mut container_ids = Vec::new();

        for item in media {
            let mut payload = json!({
                "access_token": ig_token,
                "caption": caption,
            });

            if media.len() > 1 {
                payload["is_carousel_item"] = json!(true);
            }
            if let Some(alt) = item.alt_text.as_ref().filter(|v| !v.trim().is_empty()) {
                payload["alt_text"] = json!(alt);
            }

            match item.media_type.to_lowercase().as_str() {
                "image" => payload["image_url"] = json!(item.media_url),
                "video" => {
                    payload["media_type"] = json!("VIDEO");
                    payload["video_url"] = json!(item.media_url);
                }
                _ => continue,
            }

            let create_url = format!("https://graph.facebook.com/v19.0/{ig_account_id}/media");
            let response = match client.post(&create_url).json(&payload).send().await {
                Ok(v) => v,
                Err(err) => {
                    return PublishResult {
                        published: false,
                        message: format!("Instagram container creation failed: {err}"),
                        external_post_id: None,
                    };
                }
            };
            let data = response
                .json::<serde_json::Value>()
                .await
                .unwrap_or(json!({}));
            if data.get("error").is_some() {
                return PublishResult {
                    published: false,
                    message: format!("Instagram error: {data}"),
                    external_post_id: None,
                };
            }
            let Some(id) = data.get("id").and_then(|v| v.as_str()) else {
                return PublishResult {
                    published: false,
                    message: format!("Instagram container creation failed: {data}"),
                    external_post_id: None,
                };
            };
            container_ids.push(id.to_string());
        }

        if container_ids.is_empty() {
            return PublishResult {
                published: false,
                message: "No valid Instagram media containers created".into(),
                external_post_id: None,
            };
        }

        let creation_id = if container_ids.len() == 1 {
            container_ids[0].clone()
        } else {
            let carousel_payload = json!({
                "media_type": "CAROUSEL",
                "children": container_ids,
                "caption": caption,
                "access_token": ig_token,
            });
            let create_url = format!("https://graph.facebook.com/v19.0/{ig_account_id}/media");
            let response = match client
                .post(&create_url)
                .json(&carousel_payload)
                .send()
                .await
            {
                Ok(v) => v,
                Err(err) => {
                    return PublishResult {
                        published: false,
                        message: format!("Instagram carousel creation failed: {err}"),
                        external_post_id: None,
                    };
                }
            };
            let data = response
                .json::<serde_json::Value>()
                .await
                .unwrap_or(json!({}));
            if data.get("error").is_some() {
                return PublishResult {
                    published: false,
                    message: format!("Instagram error: {data}"),
                    external_post_id: None,
                };
            }
            match data.get("id").and_then(|v| v.as_str()) {
                Some(v) => v.to_string(),
                None => {
                    return PublishResult {
                        published: false,
                        message: format!("Instagram carousel creation failed: {data}"),
                        external_post_id: None,
                    };
                }
            }
        };

        let publish_url = format!("https://graph.facebook.com/v19.0/{ig_account_id}/media_publish");
        let response = match client
            .post(&publish_url)
            .json(&json!({
                "creation_id": creation_id,
                "access_token": ig_token,
            }))
            .send()
            .await
        {
            Ok(v) => v,
            Err(err) => {
                return PublishResult {
                    published: false,
                    message: format!("Instagram publish failed: {err}"),
                    external_post_id: None,
                };
            }
        };
        let data = response
            .json::<serde_json::Value>()
            .await
            .unwrap_or(json!({}));
        if data.get("error").is_some() {
            return PublishResult {
                published: false,
                message: format!("Instagram publish error: {data}"),
                external_post_id: None,
            };
        }
        if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
            PublishResult {
                published: true,
                message: format!("Published to Instagram. Post ID: {id}"),
                external_post_id: Some(id.to_string()),
            }
        } else {
            PublishResult {
                published: false,
                message: format!("Instagram publish error: {data}"),
                external_post_id: None,
            }
        }
    }
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
