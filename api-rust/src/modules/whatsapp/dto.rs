use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
pub struct UpdateWhatsappFlowConfigDto {
    pub enabled: Option<bool>,
    #[serde(rename = "serviceName")]
    pub service_name: Option<String>,
    #[serde(rename = "welcomeMessage")]
    pub welcome_message: Option<String>,
    #[serde(rename = "welcomeTriggers")]
    pub welcome_triggers: Option<Vec<String>>,
    #[serde(rename = "aiFallbackEnabled")]
    pub ai_fallback_enabled: Option<bool>,
    #[serde(rename = "menuItems")]
    pub menu_items: Option<Value>,
}

#[derive(Deserialize)]
pub struct ReplyMessageDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: uuid::Uuid,
    pub phone: String,
    pub message: String,
    #[serde(rename = "leadId")]
    pub lead_id: Option<uuid::Uuid>,
    #[serde(rename = "contactId")]
    pub contact_id: Option<uuid::Uuid>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<uuid::Uuid>,
    #[serde(rename = "useTemplate")]
    pub use_template: Option<bool>,
    #[serde(rename = "templateName")]
    pub template_name: Option<String>,
    #[serde(rename = "templateLanguage")]
    pub template_language: Option<String>,
}
