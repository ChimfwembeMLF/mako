use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct MarkAllReadDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
}

#[derive(Deserialize, Validate)]
pub struct UpdatePreferencesDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "emailPublishSuccess")]
    pub email_publish_success: Option<bool>,
    #[serde(rename = "emailBilling")]
    pub email_billing: Option<bool>,
    #[serde(rename = "emailWeeklyDigest")]
    pub email_weekly_digest: Option<bool>,
    #[serde(rename = "emailHotLeads")]
    pub email_hot_leads: Option<bool>,
    #[serde(rename = "inAppEnabled")]
    pub in_app_enabled: Option<bool>,
}
