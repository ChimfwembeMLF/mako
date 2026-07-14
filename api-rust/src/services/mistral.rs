use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::common::ApiError;
use crate::config::MistralConfig;

const MISTRAL_CHAT_URL: &str = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_IMAGE_URL: &str = "https://api.mistral.ai/v1/images/generations";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatResult {
    pub content: String,
    pub tokens_used: i32,
    pub model: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ImageResult {
    pub url: String,
    pub revised_prompt: Option<String>,
}

pub struct MistralService;

impl MistralService {
    pub fn default_model(config: &MistralConfig) -> String {
        config.text_model.clone()
    }

    pub fn premium_model(config: &MistralConfig) -> String {
        config.premium_model.clone()
    }

    pub async fn health_check(config: &MistralConfig) -> Result<(bool, String), ApiError> {
        let result = Self::complete(
            config,
            vec![ChatMessage {
                role: "user".into(),
                content: "Reply with exactly: ok".into(),
            }],
            None,
            false,
            Some(16),
        )
        .await?;
        Ok((result.content.to_lowercase().contains("ok"), result.model))
    }

    pub async fn complete_json(
        config: &MistralConfig,
        messages: Vec<ChatMessage>,
        model: Option<String>,
    ) -> Result<(Value, i32, String), ApiError> {
        let result = Self::complete(config, messages, model, true, None).await?;
        let cleaned = result
            .content
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();
        let data: Value = serde_json::from_str(cleaned).map_err(|_| {
            ApiError::BadRequest("AI returned an invalid response. Try again.".into())
        })?;
        Ok((data, result.tokens_used, result.model))
    }

    pub async fn complete(
        config: &MistralConfig,
        messages: Vec<ChatMessage>,
        model: Option<String>,
        json_mode: bool,
        max_tokens: Option<i32>,
    ) -> Result<ChatResult, ApiError> {
        if config.api_key.trim().is_empty() {
            return Err(ApiError::BadRequest(
                "MISTRAL_API_KEY is not configured on the server".into(),
            ));
        }

        let model = model.unwrap_or_else(|| Self::default_model(config));
        let body = json!({
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens.unwrap_or(4096),
            "response_format": if json_mode { json!({"type": "json_object"}) } else { Value::Null },
        });

        let client = reqwest::Client::new();
        let response = client
            .post(MISTRAL_CHAT_URL)
            .header(AUTHORIZATION, format!("Bearer {}", config.api_key.trim()))
            .header(CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(format!("Cannot reach Mistral AI: {e}")))?;

        let status = response.status();
        let data: Value = response
            .json()
            .await
            .map_err(|e| ApiError::BadRequest(format!("Invalid Mistral response: {e}")))?;
        if !status.is_success() {
            return Err(ApiError::BadRequest(format!(
                "Mistral request failed: {}",
                data.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or_else(|| data.as_str().unwrap_or("unknown error"))
            )));
        }

        let content = data
            .get("choices")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .map(|v| {
                if let Some(s) = v.as_str() {
                    s.to_string()
                } else if let Some(arr) = v.as_array() {
                    arr.iter()
                        .filter_map(|x| x.get("text").and_then(|t| t.as_str()))
                        .collect::<String>()
                } else {
                    String::new()
                }
            })
            .unwrap_or_default()
            .trim()
            .to_string();

        if content.is_empty() {
            return Err(ApiError::BadRequest(
                "Mistral returned an empty response".into(),
            ));
        }

        let usage = data.get("usage").cloned().unwrap_or_default();
        let tokens_used = usage
            .get("total_tokens")
            .and_then(|v| v.as_i64())
            .or_else(|| {
                let p = usage
                    .get("prompt_tokens")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let c = usage
                    .get("completion_tokens")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                Some(p + c)
            })
            .unwrap_or(0) as i32;

        Ok(ChatResult {
            content,
            tokens_used,
            model,
        })
    }

    pub async fn generate_image(config: &MistralConfig, prompt: &str) -> Result<ImageResult, ApiError> {
        if config.api_key.trim().is_empty() {
            return Err(ApiError::BadRequest(
                "MISTRAL_API_KEY is not configured on the server".into(),
            ));
        }

        let model = std::env::var("MISTRAL_IMAGE_MODEL")
            .unwrap_or_else(|_| "black-forest-labs/FLUX.1-schnell".into());
        let body = json!({
            "model": model,
            "prompt": prompt,
            "size": "1024x1024"
        });

        let client = reqwest::Client::new();
        let response = client
            .post(MISTRAL_IMAGE_URL)
            .header(AUTHORIZATION, format!("Bearer {}", config.api_key.trim()))
            .header(CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(format!("Image generation failed: {e}")))?;

        let status = response.status();
        let data: Value = response
            .json()
            .await
            .map_err(|e| ApiError::BadRequest(format!("Invalid image response: {e}")))?;
        if !status.is_success() {
            return Err(ApiError::BadRequest(format!(
                "Mistral image request failed: {}",
                data.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown error")
            )));
        }

        let first = data
            .get("data")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .cloned()
            .unwrap_or_default();
        let url = first
            .get("url")
            .and_then(|v| v.as_str())
            .or_else(|| first.get("image_url").and_then(|v| v.as_str()))
            .unwrap_or_default()
            .to_string();
        if url.is_empty() {
            return Err(ApiError::BadRequest(
                "Mistral image response did not include a URL".into(),
            ));
        }
        Ok(ImageResult {
            url,
            revised_prompt: first
                .get("revised_prompt")
                .and_then(|v| v.as_str())
                .map(str::to_string),
        })
    }

    pub async fn list_models(config: &MistralConfig) -> Result<Value, ApiError> {
        if config.api_key.trim().is_empty() {
            return Ok(json!({
                "models": [
                    { "id": Self::default_model(config), "type": "text", "default": true },
                    { "id": Self::premium_model(config), "type": "text", "premium": true }
                ]
            }));
        }

        let client = reqwest::Client::new();
        let response = client
            .get("https://api.mistral.ai/v1/models")
            .header(AUTHORIZATION, format!("Bearer {}", config.api_key.trim()))
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(format!("Failed to list models: {e}")))?;

        let status = response.status();
        let data: Value = response
            .json()
            .await
            .map_err(|e| ApiError::BadRequest(format!("Invalid model list response: {e}")))?;
        if !status.is_success() {
            return Err(ApiError::BadRequest(format!(
                "Mistral model list failed: {}",
                data.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown error")
            )));
        }

        Ok(data)
    }
}
