use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct SearchAskDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    pub q: String,
}
