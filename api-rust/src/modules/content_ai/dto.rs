use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct GenerateContentDto {
    pub theme: Option<String>,
    pub draft: Option<String>,
    #[serde(rename = "workspaceId", alias = "workspace_id")]
    pub workspace_id: Option<Uuid>,
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
    pub platform: Option<String>,
    #[serde(rename = "templateId")]
    pub template_id: Option<Uuid>,
    pub save: Option<bool>,
}

#[derive(Deserialize)]
pub struct RepurposeContentDto {
    #[serde(rename = "contentId")]
    pub content_id: Uuid,
}

#[derive(Deserialize)]
pub struct AdaptPlatformsDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId", alias = "workspace_id")]
    pub workspace_id: Option<Uuid>,
    pub title: Option<String>,
    pub content: String,
    pub platforms: Vec<String>,
}

#[derive(Deserialize)]
pub struct GenerateImageDto {
    pub prompt: String,
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "contentId")]
    pub content_id: Option<Uuid>,
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
}

#[derive(Deserialize)]
pub struct GenerateSlideshowDto {
    pub theme: String,
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "slideCount")]
    pub slide_count: Option<i32>,
    #[serde(rename = "contentId")]
    pub content_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct PublishContentDto {
    pub platforms: Option<Vec<String>>,
    #[serde(rename = "platformPayloads")]
    pub platform_payloads: Option<Value>,
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
}

#[derive(Deserialize)]
pub struct DailyWorkflowDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
}
