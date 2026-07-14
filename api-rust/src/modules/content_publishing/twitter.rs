use reqwest::Client;
use serde_json::json;

use super::types::{ContentToPublish, MediaAttachment, PublishResult};
use super::util::strip_html;
use crate::modules::social_accounts::entity::Model as SocialModel;
use crate::services::oauth1::{authorization_header, OAuth1Credentials};

pub struct TwitterPublishingService;

struct TwitterOAuth1Creds {
    consumer_key: String,
    consumer_secret: String,
    access_token: String,
    access_token_secret: String,
}

impl TwitterPublishingService {
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
                    message: "Twitter account not connected or token missing".into(),
                    external_post_id: None,
                };
            }
        };

        let mut plain_text = strip_html(&content.content);
        if let Some(title) = content.title.as_ref().filter(|t| !t.trim().is_empty()) {
            if !plain_text.is_empty() {
                plain_text = format!("{title}\n\n{plain_text}");
            } else {
                plain_text = title.clone();
            }
        }
        if plain_text.is_empty() {
            return PublishResult {
                published: false,
                message: "Tweet text is empty".into(),
                external_post_id: None,
            };
        }
        if plain_text.chars().count() > 280 {
            plain_text = plain_text.chars().take(277).collect::<String>() + "...";
        }

        let oauth1 = oauth1_credentials(account);
        let mut media_ids = Vec::new();

        if !media.is_empty() {
            if let Some(ref creds) = oauth1 {
                for attachment in media.iter().take(4) {
                    match upload_media(creds, attachment).await {
                        Ok(id) => media_ids.push(id),
                        Err(err) => {
                            tracing::warn!(error = %err, "Twitter media upload failed");
                        }
                    }
                }
            } else if !media.is_empty() {
                tracing::warn!("Twitter media skipped: OAuth 1.0a credentials missing");
            }
        }

        let mut tweet_body = json!({ "text": plain_text });
        if !media_ids.is_empty() {
            tweet_body["media"] = json!({ "media_ids": media_ids });
        }

        let client = Client::new();
        let response = match client
            .post("https://api.twitter.com/2/tweets")
            .bearer_auth(&access_token)
            .json(&tweet_body)
            .send()
            .await
        {
            Ok(v) => v,
            Err(err) => {
                return PublishResult {
                    published: false,
                    message: super::util::format_publish_error(err, "Twitter"),
                    external_post_id: None,
                };
            }
        };

        let data: serde_json::Value = response.json().await.unwrap_or(json!({}));
        if let Some(id) = data
            .get("data")
            .and_then(|v| v.get("id"))
            .and_then(|v| v.as_str())
        {
            return PublishResult {
                published: true,
                message: format!("Published to Twitter/X. Tweet ID: {id}"),
                external_post_id: Some(id.to_string()),
            };
        }

        let err_msg = data
            .get("detail")
            .or_else(|| data.get("title"))
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .unwrap_or_else(|| data.to_string());
        PublishResult {
            published: false,
            message: format!("Twitter error: {err_msg}"),
            external_post_id: None,
        }
    }
}

fn oauth1_credentials(account: &SocialModel) -> Option<TwitterOAuth1Creds> {
    let meta = account.metadata.as_ref()?;
    let consumer_key = meta.get("api_key").and_then(|v| v.as_str())?;
    let consumer_secret = meta.get("api_secret").and_then(|v| v.as_str())?;
    let access_token = account.access_token.as_deref()?;
    let access_token_secret = meta.get("access_token_secret").and_then(|v| v.as_str())?;

    let trim = |s: &str| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    };

    Some(TwitterOAuth1Creds {
        consumer_key: trim(consumer_key)?,
        consumer_secret: trim(consumer_secret)?,
        access_token: trim(access_token)?,
        access_token_secret: trim(access_token_secret)?,
    })
}

async fn upload_media(creds: &TwitterOAuth1Creds, attachment: &MediaAttachment) -> Result<String, String> {
    let client = Client::new();
    let media_bytes = client
        .get(&attachment.media_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let total_bytes = media_bytes.len();
    let media_type = if attachment.media_type.to_lowercase().contains("video") {
        "video/mp4"
    } else {
        "image/jpeg"
    };

    let upload_url = "https://upload.twitter.com/1.1/media/upload.json";
    let oauth = OAuth1Credentials {
        consumer_key: &creds.consumer_key,
        consumer_secret: &creds.consumer_secret,
        token: &creds.access_token,
        token_secret: &creds.access_token_secret,
    };

    let init_params = [
        ("command", "INIT"),
        ("total_bytes", &total_bytes.to_string()),
        ("media_type", media_type),
    ];
    let init_auth = authorization_header("POST", upload_url, &init_params, &oauth);

    let init_resp = client
        .post(upload_url)
        .header("Authorization", init_auth)
        .form(&[
            ("command", "INIT"),
            ("total_bytes", &total_bytes.to_string()),
            ("media_type", media_type),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let init_data: serde_json::Value = init_resp.json().await.map_err(|e| e.to_string())?;
    let media_id = init_data
        .get("media_id_string")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Twitter media init failed: {init_data}"))?
        .to_string();

    let chunk_size = 4 * 1024 * 1024;
    let mut segment = 0usize;
    for chunk in media_bytes.chunks(chunk_size) {
        let segment_index = segment.to_string();
        let append_params = [
            ("command", "APPEND"),
            ("media_id", media_id.as_str()),
            ("segment_index", segment_index.as_str()),
        ];
        let append_auth = authorization_header("POST", upload_url, &append_params, &oauth);

        client
            .post(upload_url)
            .header("Authorization", append_auth)
            .multipart(
                reqwest::multipart::Form::new()
                    .text("command", "APPEND")
                    .text("media_id", media_id.clone())
                    .text("segment_index", segment_index)
                    .part(
                        "media",
                        reqwest::multipart::Part::bytes(chunk.to_vec())
                            .mime_str(media_type)
                            .map_err(|e| e.to_string())?,
                    ),
            )
            .send()
            .await
            .map_err(|e| e.to_string())?;

        segment += 1;
    }

    let finalize_params = [("command", "FINALIZE"), ("media_id", media_id.as_str())];
    let finalize_auth = authorization_header("POST", upload_url, &finalize_params, &oauth);

    client
        .post(upload_url)
        .header("Authorization", finalize_auth)
        .form(&[("command", "FINALIZE"), ("media_id", media_id.as_str())])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(media_id)
}
