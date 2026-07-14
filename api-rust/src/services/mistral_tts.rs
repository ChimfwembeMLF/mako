use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::common::ApiError;
use crate::config::MistralConfig;

const MISTRAL_SPEECH_URL: &str = "https://api.mistral.ai/v1/audio/speech";
const MISTRAL_VOICES_URL: &str = "https://api.mistral.ai/v1/audio/voices";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TtsVoiceOption {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gender: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub languages: Option<Vec<String>>,
    pub is_custom: bool,
}

#[derive(Clone, Debug)]
pub struct TtsResult {
    pub audio_data: String,
    pub format: &'static str,
}

pub struct MistralTtsService;

impl MistralTtsService {
    fn api_key(config: &MistralConfig) -> Result<&str, ApiError> {
        let key = config.api_key.trim();
        if key.is_empty() {
            return Err(ApiError::BadRequest(
                "MISTRAL_API_KEY is not configured on the server".into(),
            ));
        }
        Ok(key)
    }

    fn default_voice_id() -> String {
        std::env::var("MISTRAL_TTS_VOICE_ID")
            .unwrap_or_else(|_| "c69964a6-ab8b-4f8a-9465-ec0925096ec8".into())
    }

    fn tts_model() -> String {
        std::env::var("MISTRAL_TTS_MODEL").unwrap_or_else(|_| "mistral-tts".into())
    }

    pub async fn speak(
        config: &MistralConfig,
        text: &str,
        voice_id: Option<&str>,
    ) -> Result<TtsResult, ApiError> {
        let input = text.trim();
        if input.is_empty() {
            return Err(ApiError::BadRequest("No text to synthesize".into()));
        }
        let input = if input.len() > 4096 {
            &input[..4096]
        } else {
            input
        };

        let body = json!({
            "model": Self::tts_model(),
            "input": input,
            "voice_id": voice_id.unwrap_or(&Self::default_voice_id()),
            "response_format": "mp3",
            "stream": false
        });

        let client = reqwest::Client::new();
        let response = client
            .post(MISTRAL_SPEECH_URL)
            .header(AUTHORIZATION, format!("Bearer {}", Self::api_key(config)?))
            .header(CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                ApiError::BadRequest(format!(
                    "Cannot reach Mistral AI for text-to-speech: {e}"
                ))
            })?;

        let status = response.status();
        let data: Value = response.json().await.map_err(|e| {
            ApiError::BadRequest(format!("Invalid Mistral TTS response: {e}"))
        })?;

        if !status.is_success() {
            return Err(ApiError::BadRequest(format!(
                "Mistral TTS failed: {}",
                data.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown error")
            )));
        }

        let audio_data = data
            .get("audioData")
            .or_else(|| data.get("audio_data"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .ok_or_else(|| {
                ApiError::BadRequest("Mistral TTS returned empty audio".into())
            })?;

        Ok(TtsResult {
            audio_data,
            format: "mp3",
        })
    }

    pub async fn speak_bytes(
        config: &MistralConfig,
        text: &str,
        voice_id: Option<&str>,
    ) -> Result<Vec<u8>, ApiError> {
        let result = Self::speak(config, text, voice_id).await?;
        B64.decode(result.audio_data.as_bytes()).map_err(|e| {
            ApiError::BadRequest(format!("Invalid TTS audio encoding: {e}"))
        })
    }

    pub async fn list_preset_voices(config: &MistralConfig) -> Result<Vec<TtsVoiceOption>, ApiError> {
        let client = reqwest::Client::new();
        let response = client
            .get(MISTRAL_VOICES_URL)
            .query(&[("type", "preset"), ("limit", "100")])
            .header(AUTHORIZATION, format!("Bearer {}", Self::api_key(config)?))
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(format!("Cannot reach Mistral AI: {e}")))?;

        let status = response.status();
        let data: Value = response.json().await.map_err(|e| {
            ApiError::BadRequest(format!("Invalid Mistral voices response: {e}"))
        })?;

        if !status.is_success() {
            return Err(ApiError::BadRequest(format!(
                "Mistral voice list failed: {}",
                data.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown error")
            )));
        }

        let mut voices: Vec<TtsVoiceOption> = data
            .get("items")
            .or_else(|| data.get("data"))
            .and_then(|v| v.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        Some(TtsVoiceOption {
                            id: item.get("id")?.as_str()?.to_string(),
                            name: item
                                .get("name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Voice")
                                .to_string(),
                            gender: item
                                .get("gender")
                                .and_then(|v| v.as_str())
                                .map(str::to_string),
                            description: item
                                .get("description")
                                .and_then(|v| v.as_str())
                                .map(str::to_string),
                            languages: item.get("languages").and_then(|v| {
                                v.as_array().map(|arr| {
                                    arr.iter()
                                        .filter_map(|x| x.as_str().map(str::to_string))
                                        .collect()
                                })
                            }),
                            is_custom: false,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        voices.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(voices)
    }

    pub async fn clone_voice(
        config: &MistralConfig,
        name: &str,
        sample_bytes: &[u8],
        sample_filename: &str,
        tenant_tag: &str,
    ) -> Result<(String, String), ApiError> {
        if sample_bytes.is_empty() {
            return Err(ApiError::BadRequest("Audio sample is required".into()));
        }
        if sample_bytes.len() > 12 * 1024 * 1024 {
            return Err(ApiError::BadRequest(
                "Audio sample must be under 12 MB".into(),
            ));
        }
        let name = name.trim();
        if name.is_empty() {
            return Err(ApiError::BadRequest("Voice name is required".into()));
        }

        let body = json!({
            "name": name.chars().take(120).collect::<String>(),
            "sample_audio": B64.encode(sample_bytes),
            "sample_filename": if sample_filename.trim().is_empty() {
                "voice-sample.webm"
            } else {
                sample_filename
            },
            "tags": [format!("tenant:{tenant_tag}")],
            "description": format!("Cloned voice for tenant {tenant_tag}")
        });

        let client = reqwest::Client::new();
        let response = client
            .post(MISTRAL_VOICES_URL)
            .header(AUTHORIZATION, format!("Bearer {}", Self::api_key(config)?))
            .header(CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(format!("Voice cloning failed: {e}")))?;

        let status = response.status();
        let data: Value = response.json().await.map_err(|e| {
            ApiError::BadRequest(format!("Invalid voice clone response: {e}"))
        })?;

        if !status.is_success() {
            return Err(ApiError::BadRequest(format!(
                "Mistral voice clone failed: {}",
                data.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown error")
            )));
        }

        let id = data
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError::BadRequest("Mistral did not return a voice id".into()))?;
        let voice_name = data
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(name)
            .to_string();
        Ok((id.to_string(), voice_name))
    }

    pub async fn delete_custom_voice(config: &MistralConfig, voice_id: &str) -> Result<(), ApiError> {
        let client = reqwest::Client::new();
        let url = format!("{MISTRAL_VOICES_URL}/{voice_id}");
        let response = client
            .delete(&url)
            .header(AUTHORIZATION, format!("Bearer {}", Self::api_key(config)?))
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(format!("Failed to delete voice: {e}")))?;

        if !response.status().is_success() {
            let data: Value = response.json().await.unwrap_or_default();
            return Err(ApiError::BadRequest(format!(
                "Failed to delete Mistral voice: {}",
                data.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown error")
            )));
        }
        Ok(())
    }
}
