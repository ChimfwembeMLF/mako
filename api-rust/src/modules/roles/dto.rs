use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateRoleDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "isSystem")]
    pub is_system: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<FixedOffset>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateRoleDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "isSystem")]
    pub is_system: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
}
