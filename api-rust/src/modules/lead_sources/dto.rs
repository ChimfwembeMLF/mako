use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateLeadSourceDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "userId")]
    pub user_id: Uuid,
    #[validate(length(min = 1))]
    pub label: String,
    #[serde(rename = "webhookSecret")]
    pub webhook_secret: Option<String>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateLeadSourceDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    pub label: Option<String>,
    #[serde(rename = "webhookSecret")]
    pub webhook_secret: Option<String>,
}
