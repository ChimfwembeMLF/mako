use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateProfileDto {
    #[serde(rename = "userId")]
    pub user_id: Uuid,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(rename = "fullName")]
    pub full_name: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
    #[serde(rename = "isSystemAdmin")]
    pub is_system_admin: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<FixedOffset>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<FixedOffset>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateProfileDto {
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(rename = "fullName")]
    pub full_name: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
    #[serde(rename = "isSystemAdmin")]
    pub is_system_admin: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<FixedOffset>>,
}
