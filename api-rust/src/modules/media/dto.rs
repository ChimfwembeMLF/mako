use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct Base64UploadDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    #[serde(rename = "contentId")]
    pub content_id: Option<Uuid>,
    pub data: String,
    #[serde(rename = "fileName")]
    pub file_name: Option<String>,
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
}
