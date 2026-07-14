use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateWhatsappContactDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    pub phone: String,
    pub name: Option<String>,
    #[serde(rename = "optedIn")]
    pub opted_in: bool,
    #[serde(rename = "optedInAt")]
    pub opted_in_at: Option<DateTime<FixedOffset>>,
    pub tags: Option<Vec<String>>,
    #[serde(rename = "leadId")]
    pub lead_id: Option<Uuid>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateWhatsappContactDto {
    pub phone: Option<String>,
    pub name: Option<String>,
    #[serde(rename = "optedIn")]
    pub opted_in: Option<bool>,
    #[serde(rename = "optedInAt")]
    pub opted_in_at: Option<DateTime<FixedOffset>>,
    pub tags: Option<Vec<String>>,
    #[serde(rename = "leadId")]
    pub lead_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
}
