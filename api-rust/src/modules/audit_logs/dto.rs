use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateAuditLogDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    pub action: String,
    #[serde(rename = "resourceType")]
    pub resource_type: Option<String>,
    #[serde(rename = "resourceId")]
    pub resource_id: Option<Uuid>,
    #[serde(rename = "beforeState")]
    pub before_state: Option<Value>,
    #[serde(rename = "afterState")]
    pub after_state: Option<Value>,
    pub metadata: Option<Value>,
    #[serde(rename = "ipAddress")]
    pub ip_address: Option<String>,
    #[serde(rename = "userAgent")]
    pub user_agent: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateAuditLogDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    pub action: Option<String>,
    #[serde(rename = "resourceType")]
    pub resource_type: Option<String>,
    #[serde(rename = "resourceId")]
    pub resource_id: Option<Uuid>,
    #[serde(rename = "beforeState")]
    pub before_state: Option<Value>,
    #[serde(rename = "afterState")]
    pub after_state: Option<Value>,
    pub metadata: Option<Value>,
    #[serde(rename = "ipAddress")]
    pub ip_address: Option<String>,
    #[serde(rename = "userAgent")]
    pub user_agent: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
}
