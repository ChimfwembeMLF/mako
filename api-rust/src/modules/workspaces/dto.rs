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

#[derive(Deserialize, Validate)]
pub struct UpdateAutomationConfigDto {
    #[serde(rename = "isActive")]
    pub is_active: Option<bool>,
    pub timezone: Option<String>,
    #[serde(rename = "generateAt")]
    pub generate_at: Option<String>,
    #[serde(rename = "postsPerCycle")]
    pub posts_per_cycle: Option<i32>,
    #[serde(rename = "planAheadDays")]
    pub plan_ahead_days: Option<i32>,
    #[serde(rename = "publishingDays")]
    pub publishing_days: Option<serde_json::Value>,
    #[serde(rename = "postingTimes")]
    pub posting_times: Option<serde_json::Value>,
    pub platforms: Option<serde_json::Value>,
}
