use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateApprovalWorkflowDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "actionKey")]
    pub action_key: String,
    pub label: String,
    pub description: Option<String>,
    #[serde(rename = "isEnabled")]
    pub is_enabled: bool,
    #[serde(rename = "approverRoleId")]
    pub approver_role_id: Uuid,
    #[serde(rename = "updatedBy")]
    pub updated_by: Uuid,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<FixedOffset>>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateApprovalWorkflowDto {
    pub label: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "isEnabled")]
    pub is_enabled: Option<bool>,
    #[serde(rename = "approverRoleId")]
    pub approver_role_id: Option<Uuid>,
    #[serde(rename = "updatedBy")]
    pub updated_by: Option<Uuid>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<FixedOffset>>,
}
