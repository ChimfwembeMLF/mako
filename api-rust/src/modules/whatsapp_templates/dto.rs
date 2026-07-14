use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateWhatsappTemplateDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    pub name: String,
    pub language: Option<String>,
    pub category: Option<String>,
    pub components: Option<Value>,
    pub variables: Option<Value>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateWhatsappTemplateDto {
    pub name: Option<String>,
    pub language: Option<String>,
    pub category: Option<String>,
    pub status: Option<String>,
    pub components: Option<Value>,
    pub variables: Option<Value>,
    #[serde(rename = "metaTemplateId")]
    pub meta_template_id: Option<String>,
    #[serde(rename = "rejectionReason")]
    pub rejection_reason: Option<String>,
}

#[derive(Deserialize)]
pub struct ImportFromMetaDto {
    #[serde(rename = "metaId")]
    pub meta_id: String,
    pub name: String,
    pub language: String,
    pub status: String,
    pub category: Option<String>,
    pub components: Value,
}
