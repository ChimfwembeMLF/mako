use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct GenerateCampaignDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Uuid,
    pub theme: String,
    pub name: Option<String>,
    pub goal: Option<String>,
    pub platforms: Option<Vec<String>>,
    #[serde(rename = "postCount")]
    pub post_count: Option<i32>,
    #[serde(rename = "startDate")]
    pub start_date: Option<String>,
}
