use std::time::Duration;

use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};

use super::types::{ContentToPublish, MediaAttachment, PublishResult};
use super::util::{format_publish_error, strip_html};
use crate::modules::social_accounts::entity::Model as SocialModel;

const TIKTOK_API_BASE: &str = "https://open.tiktokapis.com/v2";

pub struct TiktokPublishingService;

#[derive(Debug, Deserialize)]
struct TikTokEnvelope<T> {
    data: Option<T>,
    error: Option<TikTokError>,
}

#[derive(Debug, Deserialize)]
struct TikTokError {
    code: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct CreatorInfo {
    privacy_level_options: Option<Vec<String>>,
    #[allow(dead_code)]
    max_video_post_duration_sec: Option<i64>,
    can_post_more: Option<bool>,
}

impl TiktokPublishingService {
    pub async fn publish_post(
        account: &SocialModel,
        content: &ContentToPublish,
        media: &[MediaAttachment],
    ) -> PublishResult {
        let access_token = match account
            .access_token
            .as_ref()
            .map(|v| v.trim())
            .filter(|v| !v.is_empty())
        {
            Some(t) => t.to_string(),
            None => {
                return PublishResult {
                    published: false,
                    message: "TikTok not connected for this workspace".into(),
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
                    "TikTok requires a video attachment. Add a vertical video in Content Engine before publishing."
                        .into(),
                external_post_id: None,
            };
        };

        let creator_info = match query_creator_info(&access_token).await {
            Ok(v) => v,
            Err(err) => {
                return PublishResult {
                    published: false,
                    message: err,
                    external_post_id: None,
                };
            }
        };

        if creator_info.can_post_more == Some(false) {
            return PublishResult {
                published: false,
                message: "TikTok rate limit reached for this creator — try again later.".into(),
                external_post_id: None,
            };
        }

        let privacy_level = pick_privacy_level(creator_info.privacy_level_options.as_deref());
        let caption = build_caption(content);

        let publish_id = match init_video_publish(
            &access_token,
            &video.media_url,
            &caption,
            &privacy_level,
        )
        .await
        {
            Ok(v) => v,
            Err(err) => {
                return PublishResult {
                    published: false,
                    message: err,
                    external_post_id: None,
                };
            }
        };

        let status = match poll_publish_status(&access_token, &publish_id).await {
            Ok(v) => v,
            Err(err) => {
                return PublishResult {
                    published: false,
                    message: err,
                    external_post_id: None,
                };
            }
        };

        if status.get("status").and_then(|v| v.as_str()) == Some("FAILED") {
            let reason = status
                .get("fail_reason")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown error");
            return PublishResult {
                published: false,
                message: format!("TikTok publish failed: {reason}"),
                external_post_id: None,
            };
        }

        let post_id = status
            .get("publicly_available_post_id")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .and_then(|v| v.as_str())
            .or_else(|| status.get("post_id").and_then(|v| v.as_str()))
            .map(str::to_string);

        let message = if privacy_level == "SELF_ONLY" {
            "Video uploaded to TikTok (private — app may be unaudited; submit for review to post publicly)"
        } else {
            "Video published to TikTok"
        };

        PublishResult {
            published: true,
            message: message.into(),
            external_post_id: post_id,
        }
    }
}

fn build_caption(content: &ContentToPublish) -> String {
    let plain = strip_html(&content.content);
    let title = content.title.as_deref().unwrap_or("").trim();
    let combined = if !title.is_empty() && !plain.is_empty() {
        format!("{title}\n\n{plain}")
    } else if !title.is_empty() {
        title.to_string()
    } else {
        plain
    };
    combined.chars().take(2200).collect()
}

fn pick_privacy_level(options: Option<&[String]>) -> String {
    let list = options.unwrap_or(&[]);
    if list.iter().any(|v| v == "PUBLIC_TO_EVERYONE") {
        return "PUBLIC_TO_EVERYONE".into();
    }
    if list.iter().any(|v| v == "MUTUAL_FOLLOW_FRIENDS") {
        return "MUTUAL_FOLLOW_FRIENDS".into();
    }
    if list.iter().any(|v| v == "FOLLOWER_OF_CREATOR") {
        return "FOLLOWER_OF_CREATOR".into();
    }
    list.first()
        .cloned()
        .unwrap_or_else(|| "SELF_ONLY".into())
}

async fn query_creator_info(access_token: &str) -> Result<CreatorInfo, String> {
    tiktok_post(access_token, "/post/publish/creator_info/query/", json!({}))
        .await
        .map(|v| serde_json::from_value(v).unwrap_or_default())
}

async fn init_video_publish(
    access_token: &str,
    video_url: &str,
    title: &str,
    privacy_level: &str,
) -> Result<String, String> {
    let data = tiktok_post(
        access_token,
        "/post/publish/video/init/",
        json!({
            "post_info": {
                "title": title,
                "privacy_level": privacy_level,
                "disable_duet": false,
                "disable_comment": false,
                "disable_stitch": false,
                "video_cover_timestamp_ms": 1000
            },
            "source_info": {
                "source": "PULL_FROM_URL",
                "video_url": video_url
            }
        }),
    )
    .await?;

    data.get("publish_id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| "TikTok did not return a publish_id".into())
}

async fn poll_publish_status(access_token: &str, publish_id: &str) -> Result<Value, String> {
    for _ in 0..30 {
        let data = tiktok_post(
            access_token,
            "/post/publish/status/fetch/",
            json!({ "publish_id": publish_id }),
        )
        .await?;

        let status = data.get("status").and_then(|v| v.as_str()).unwrap_or("");
        if matches!(status, "PUBLISH_COMPLETE" | "FAILED" | "SEND_TO_USER_INBOX") {
            return Ok(data);
        }

        tokio::time::sleep(Duration::from_secs(2)).await;
    }
    Err("TikTok publish timed out while processing".into())
}

async fn tiktok_post(access_token: &str, path: &str, body: Value) -> Result<Value, String> {
    let client = Client::new();
    let response = client
        .post(format!("{TIKTOK_API_BASE}{path}"))
        .bearer_auth(access_token)
        .header("Content-Type", "application/json; charset=UTF-8")
        .json(&body)
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format_publish_error(e, "TikTok"))?;

    let envelope: TikTokEnvelope<Value> = response
        .json()
        .await
        .map_err(|e| format_publish_error(e, "TikTok"))?;

    if let Some(err) = envelope.error {
        if err.code.as_deref() != Some("ok") {
            return Err(err
                .message
                .unwrap_or_else(|| format!("TikTok API error: {:?}", err.code)));
        }
    }

    Ok(envelope.data.unwrap_or(json!({})))
}
