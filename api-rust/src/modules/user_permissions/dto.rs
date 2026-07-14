use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateUserPermissionDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "userId")]
    pub user_id: Uuid,
    #[serde(rename = "permissionKey")]
    pub permission_key: String,
    pub effect: String,
    #[serde(rename = "validFrom")]
    pub valid_from: Option<DateTime<FixedOffset>>,
    #[serde(rename = "validUntil")]
    pub valid_until: Option<DateTime<FixedOffset>>,
    #[serde(rename = "grantedBy")]
    pub granted_by: Uuid,
    pub reason: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<FixedOffset>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateUserPermissionDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    #[serde(rename = "permissionKey")]
    pub permission_key: Option<String>,
    pub effect: Option<String>,
    #[serde(rename = "validFrom")]
    pub valid_from: Option<DateTime<FixedOffset>>,
    #[serde(rename = "validUntil")]
    pub valid_until: Option<DateTime<FixedOffset>>,
    #[serde(rename = "grantedBy")]
    pub granted_by: Option<Uuid>,
    pub reason: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
}
