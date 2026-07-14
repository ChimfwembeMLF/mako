use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct SyncInboxDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
}

#[derive(Deserialize, Validate)]
pub struct ReplyMessageDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "conversationId")]
    pub conversation_id: String,
    pub message: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    #[serde(rename = "useTemplate")]
    pub use_template: Option<bool>,
    #[serde(rename = "templateName")]
    pub template_name: Option<String>,
    #[serde(rename = "templateLanguage")]
    pub template_language: Option<String>,
}
