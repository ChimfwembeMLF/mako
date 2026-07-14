use reqwest::Client;
use serde_json::json;

use super::social_account::SocialPublishAccountService;
use super::types::{ContentToPublish, MediaAttachment, PublishResult};
use crate::modules::social_accounts::entity::Model as SocialModel;

pub struct LinkedInPublishingService;

impl LinkedInPublishingService {
    pub async fn publish_post(
        account: &SocialModel,
        content: &ContentToPublish,
        media: &[MediaAttachment],
    ) -> PublishResult {
        let li_token = match SocialPublishAccountService::linkedin_token(account) {
            Some(t) if !t.trim().is_empty() => t,
            _ => {
                return PublishResult {
                    published: false,
                    message:
                        "LinkedIn credentials missing — reconnect LinkedIn in Publisher Connect"
                            .into(),
                    external_post_id: None,
                };
            }
        };

        let person_id = match SocialPublishAccountService::linkedin_person_id(account) {
            Some(v) if !v.trim().is_empty() => v,
            _ => {
                return PublishResult {
                    published: false,
                    message: "LinkedIn person ID missing — reconnect LinkedIn in Publisher Connect"
                        .into(),
                    external_post_id: None,
                };
            }
        };

        let client = Client::new();
        let plain_text = strip_html(&content.content);
        let mut media_array = Vec::new();
        let mut share_media_category = "NONE".to_string();

        for item in media {
            let (recipe, media_type) = match item.media_type.to_lowercase().as_str() {
                "image" => ("urn:li:digitalmediaRecipe:feedshare-image", "IMAGE"),
                "video" => ("urn:li:digitalmediaRecipe:feedshare-video", "VIDEO"),
                _ => continue,
            };

            let register_payload = json!({
                "registerUploadRequest": {
                    "owner": format!("urn:li:person:{person_id}"),
                    "recipes": [recipe],
                    "serviceRelationships": [{
                        "relationshipType": "OWNER",
                        "identifier": "urn:li:userGeneratedContent"
                    }]
                }
            });

            let register = match client
                .post("https://api.linkedin.com/v2/assets?action=registerUpload")
                .bearer_auth(&li_token)
                .header("Content-Type", "application/json")
                .header("X-Restli-Protocol-Version", "2.0.0")
                .json(&register_payload)
                .send()
                .await
            {
                Ok(v) => v,
                Err(err) => {
                    return PublishResult {
                        published: false,
                        message: format!("LinkedIn register upload failed: {err}"),
                        external_post_id: None,
                    };
                }
            };
            let register_json = register
                .json::<serde_json::Value>()
                .await
                .unwrap_or(json!({}));
            let upload_url = register_json
                .get("value")
                .and_then(|v| v.get("uploadMechanism"))
                .and_then(|v| v.get("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"))
                .and_then(|v| v.get("uploadUrl"))
                .and_then(|v| v.as_str());
            let asset = register_json
                .get("value")
                .and_then(|v| v.get("asset"))
                .and_then(|v| v.as_str());

            let (Some(upload_url), Some(asset)) = (upload_url, asset) else {
                return PublishResult {
                    published: false,
                    message: format!("LinkedIn register upload failed: {register_json}"),
                    external_post_id: None,
                };
            };

            let media_bytes = match client.get(&item.media_url).send().await {
                Ok(resp) => match resp.bytes().await {
                    Ok(bytes) => bytes,
                    Err(err) => {
                        return PublishResult {
                            published: false,
                            message: format!("LinkedIn media download failed: {err}"),
                            external_post_id: None,
                        };
                    }
                },
                Err(err) => {
                    return PublishResult {
                        published: false,
                        message: format!("LinkedIn media download failed: {err}"),
                        external_post_id: None,
                    };
                }
            };

            if let Err(err) = client
                .put(upload_url)
                .header("Content-Type", "application/octet-stream")
                .body(media_bytes)
                .send()
                .await
            {
                return PublishResult {
                    published: false,
                    message: format!("LinkedIn media upload failed: {err}"),
                    external_post_id: None,
                };
            }

            media_array.push(json!({
                "status": "READY",
                "media": asset,
            }));
            if media_type == "VIDEO" {
                share_media_category = "VIDEO".to_string();
            } else if share_media_category != "VIDEO" {
                share_media_category = "IMAGE".to_string();
            }
        }

        let mut share_content = json!({
            "shareCommentary": { "text": plain_text },
            "shareMediaCategory": share_media_category,
        });
        if !media_array.is_empty() {
            share_content["media"] = json!(media_array);
        }

        let post_body = json!({
            "author": format!("urn:li:person:{person_id}"),
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": share_content
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        });

        let response = match client
            .post("https://api.linkedin.com/v2/ugcPosts")
            .bearer_auth(&li_token)
            .header("Content-Type", "application/json")
            .header("X-Restli-Protocol-Version", "2.0.0")
            .json(&post_body)
            .send()
            .await
        {
            Ok(v) => v,
            Err(err) => {
                return PublishResult {
                    published: false,
                    message: format!("LinkedIn publish failed: {err}"),
                    external_post_id: None,
                };
            }
        };

        let external_post_id = response
            .headers()
            .get("x-restli-id")
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);

        if response.status().as_u16() == 201 || external_post_id.is_some() {
            PublishResult {
                published: true,
                message: "Published to LinkedIn.".into(),
                external_post_id,
            }
        } else {
            let data = response
                .json::<serde_json::Value>()
                .await
                .unwrap_or(json!({}));
            PublishResult {
                published: false,
                message: format!("LinkedIn error: {data}"),
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
