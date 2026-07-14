use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateMemberDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "userId")]
    pub user_id: Uuid,
    #[serde(rename = "roleId")]
    pub role_id: Uuid,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "invitedBy")]
    pub invited_by: Uuid,
    #[serde(rename = "joinedAt")]
    pub joined_at: DateTime<FixedOffset>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateMemberDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    #[serde(rename = "roleId")]
    pub role_id: Option<Uuid>,
    #[serde(rename = "isActive")]
    pub is_active: Option<bool>,
    #[serde(rename = "invitedBy")]
    pub invited_by: Option<Uuid>,
    #[serde(rename = "joinedAt")]
    pub joined_at: Option<DateTime<FixedOffset>>,
}

#[derive(Deserialize, Validate)]
pub struct InviteMemberDto {
    #[validate(email)]
    pub email: String,
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "roleId")]
    pub role_id: Uuid,
}
