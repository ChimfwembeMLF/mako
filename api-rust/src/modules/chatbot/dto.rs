use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct UpdateChatbotConfigDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    pub name: Option<String>,
    #[serde(rename = "welcomeMessage")]
    pub welcome_message: Option<String>,
    #[serde(rename = "systemPromptExtra")]
    pub system_prompt_extra: Option<String>,
    #[serde(rename = "brandProfileId")]
    pub brand_profile_id: Option<Uuid>,
    pub model: Option<String>,
    pub temperature: Option<f32>,
    #[serde(rename = "maxContextMessages")]
    pub max_context_messages: Option<i32>,
    #[serde(rename = "ragEnabled")]
    pub rag_enabled: Option<bool>,
    #[serde(rename = "ragTopK")]
    pub rag_top_k: Option<i32>,
    #[serde(rename = "ragMinScore")]
    pub rag_min_score: Option<f32>,
    #[serde(rename = "widgetEnabled")]
    pub widget_enabled: Option<bool>,
    #[serde(rename = "widgetTheme")]
    pub widget_theme: Option<Value>,
    #[serde(rename = "allowedOrigins")]
    pub allowed_origins: Option<Vec<String>>,
    #[serde(rename = "isActive")]
    pub is_active: Option<bool>,
    #[serde(rename = "useMistralLibrary")]
    pub use_mistral_library: Option<bool>,
    #[serde(rename = "widgetTtsEnabled")]
    pub widget_tts_enabled: Option<bool>,
    #[serde(rename = "mistralVoiceId")]
    pub mistral_voice_id: Option<String>,
}

#[derive(Deserialize, Validate)]
pub struct CreateApiKeyDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    pub label: Option<String>,
}

#[derive(Deserialize, Validate)]
pub struct CreateSessionDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    pub title: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Deserialize, Validate)]
pub struct SendMessageDto {
    pub content: String,
    pub metadata: Option<Value>,
}

#[derive(Deserialize, Validate)]
pub struct EscalateSessionDto {
    #[serde(rename = "userMessage")]
    pub user_message: String,
    #[serde(rename = "visitorEmail")]
    pub visitor_email: Option<String>,
}

#[derive(Deserialize)]
pub struct TtsPreviewDto {
    #[serde(rename = "voiceId")]
    pub voice_id: String,
    pub text: Option<String>,
}

#[derive(Deserialize)]
pub struct CloneTtsVoiceDto {
    pub name: String,
}
