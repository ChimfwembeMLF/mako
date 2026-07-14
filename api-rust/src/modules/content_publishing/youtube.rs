use std::env;

use reqwest::Client;
use serde_json::json;

use super::types::{ContentToPublish, MediaAttachment, PublishResult};
use super::util::{format_publish_error, strip_html};
use crate::modules::social_accounts::entity::Model as SocialModel;

const MAX_VIDEO_BYTES: usize = 256 * 1024 * 1024;

pub struct YoutubePublishingService;

impl YoutubePublishingService {
    pub async fn publish_post(
        account: &SocialModel,
        content: &ContentToPublish,
        media: &[MediaAttachment],
    ) -> PublishResult {
        let access_token = match ensure_access_token(account).await {
            Ok(t) => t,
            Err(msg) => {
                return PublishResult {
                    published: false,
                    message: msg,
                    external_post_id: None,
                };
            }
        };

        let video = media
            .iter()
            .find(|m| m.media_type.eq_ignore_ascii_case("video"));
        let Some(video) = video else {
            return PublishResult {
                published: false,
                message:
                    "YouTube requires a video attachment. Add a video in Content Engine before publishing."
                        .into(),
                external_post_id: None,
            };
        };

        let client = Client::new();
        let video_bytes = match client.get(&video.media_url).send().await {
            Ok(resp) => match resp.bytes().await {
                Ok(bytes) if bytes.len() <= MAX_VIDEO_BYTES => bytes,
                Ok(bytes) => {
                    return PublishResult {
                        published: false,
                        message: format!(
                            "Video exceeds YouTube upload limit ({} MB)",
                            bytes.len() / (1024 * 1024)
                        ),
                        external_post_id: None,
                    };
                }
                Err(err) => {
                    return PublishResult {
                        published: false,
                        message: format_publish_error(err, "YouTube"),
                        external_post_id: None,
                    };
                }
            },
            Err(err) => {
                return PublishResult {
                    published: false,
                    message: format!("YouTube video download failed: {err}"),
                    external_post_id: None,
                };
            }
        };

        let title = content
            .title
            .as_deref()
            .unwrap_or("Mako upload")
            .trim()
            .chars()
            .take(100)
            .collect::<String>();
        let description = strip_html(&content.content).chars().take(5000).collect::<String>();

        let metadata = json!({
            "snippet": {
                "title": title,
                "description": if description.is_empty() { title.clone() } else { description },
                "categoryId": "22"
            },
            "status": {
                "privacyStatus": "public",
                "selfDeclaredMadeForKids": false
            }
        });

        let init = match client
            .post("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status")
            .bearer_auth(&access_token)
            .header("Content-Type", "application/json")
            .json(&metadata)
            .send()
            .await
        {
            Ok(v) => v,
            Err(err) => {
                return PublishResult {
                    published: false,
                    message: format_publish_error(err, "YouTube"),
                    external_post_id: None,
                };
            }
        };

        if !init.status().is_success() {
            let body = init.text().await.unwrap_or_default();
            return PublishResult {
                published: false,
                message: format!("YouTube upload init failed: {body}"),
                external_post_id: None,
            };
        }

        let upload_url = match init
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|v| v.to_str().ok())
        {
            Some(url) => url.to_string(),
            None => {
                return PublishResult {
                    published: false,
                    message: "YouTube did not return an upload URL".into(),
                    external_post_id: None,
                };
            }
        };

        let upload = match client
            .put(&upload_url)
            .header("Content-Type", "video/*")
            .body(video_bytes.to_vec())
            .send()
            .await
        {
            Ok(v) => v,
            Err(err) => {
                return PublishResult {
                    published: false,
                    message: format_publish_error(err, "YouTube"),
                    external_post_id: None,
                };
            }
        };

        let data: serde_json::Value = upload.json().await.unwrap_or(json!({}));
        if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
            PublishResult {
                published: true,
                message: "Video published to YouTube".into(),
                external_post_id: Some(id.to_string()),
            }
        } else {
            PublishResult {
                published: false,
                message: format!("YouTube upload failed: {data}"),
                external_post_id: None,
            }
        }
    }
}

async fn ensure_access_token(account: &SocialModel) -> Result<String, String> {
    if let Some(token) = account
        .access_token
        .as_ref()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
    {
        return Ok(token);
    }

    let refresh_token = account
        .refresh_token
        .as_ref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty());

    let Some(refresh_token) = refresh_token else {
        return Err("YouTube credentials missing — reconnect YouTube in Publisher Connect".into());
    };

    let client_id = env::var("GOOGLE_CLIENT_ID").unwrap_or_default();
    let client_secret = env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default();
    if client_id.is_empty() || client_secret.is_empty() {
        return Err("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not configured".into());
    }

    let client = Client::new();
    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|e| format_publish_error(e, "YouTube"))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format_publish_error(e, "YouTube"))?;

    data.get("access_token")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| format!("YouTube token refresh failed: {data}"))
}
