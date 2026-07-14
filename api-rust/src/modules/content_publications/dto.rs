use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct SyncEngagementDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
}
