use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateWorkspaceDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    pub name: String,
    pub slug: String,
    #[serde(rename = "logoUrl")]
    pub logo_url: Option<String>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateWorkspaceDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    pub name: Option<String>,
    pub slug: Option<String>,
    #[serde(rename = "logoUrl")]
    pub logo_url: Option<String>,
}
