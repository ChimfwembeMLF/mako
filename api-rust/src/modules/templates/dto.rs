use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateTemplateDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
    pub body: Option<String>,
    pub platforms: Option<Vec<String>>,
    #[serde(rename = "isActive")]
    pub is_active: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<FixedOffset>>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateTemplateDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
    pub body: Option<String>,
    pub platforms: Option<Vec<String>>,
    #[serde(rename = "isActive")]
    pub is_active: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "deletedAt")]
    pub deleted_at: Option<DateTime<FixedOffset>>,
}
