use chrono::{DateTime, FixedOffset, NaiveDate};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateContentItemDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Uuid,
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    #[serde(rename = "brandProfileId")]
    pub brand_profile_id: Option<Uuid>,
    #[serde(rename = "contentType")]
    pub content_type: String,
    pub title: String,
    pub content: String,
    #[serde(rename = "campaignTheme")]
    pub campaign_theme: Option<String>,
    pub status: Option<String>,
    pub platforms: Option<Vec<String>>,
    #[serde(rename = "platformPayloads")]
    pub platform_payloads: Option<Value>,
    #[serde(rename = "scheduledDate")]
    pub scheduled_date: Option<NaiveDate>,
    #[serde(rename = "scheduledTime")]
    pub scheduled_time: Option<String>,
    #[serde(rename = "publishedAt")]
    pub published_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "externalPostId")]
    pub external_post_id: Option<String>,
    #[serde(rename = "publishFailedReason")]
    pub publish_failed_reason: Option<String>,
    #[serde(rename = "deletedAt")]
    pub deleted_at: Option<DateTime<FixedOffset>>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateContentItemDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    #[serde(rename = "brandProfileId")]
    pub brand_profile_id: Option<Uuid>,
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
    pub title: Option<String>,
    pub content: Option<String>,
    #[serde(rename = "campaignTheme")]
    pub campaign_theme: Option<String>,
    pub status: Option<String>,
    pub platforms: Option<Vec<String>>,
    #[serde(rename = "platformPayloads")]
    pub platform_payloads: Option<Value>,
    #[serde(rename = "scheduledDate")]
    pub scheduled_date: Option<NaiveDate>,
    #[serde(rename = "scheduledTime")]
    pub scheduled_time: Option<String>,
    #[serde(rename = "publishedAt")]
    pub published_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "externalPostId")]
    pub external_post_id: Option<String>,
    #[serde(rename = "publishFailedReason")]
    pub publish_failed_reason: Option<String>,
    #[serde(rename = "deletedAt")]
    pub deleted_at: Option<DateTime<FixedOffset>>,
}

#[derive(Deserialize)]
pub struct AttachMediaDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    pub items: Vec<AttachMediaItemDto>,
}

#[derive(Deserialize)]
pub struct AttachMediaItemDto {
    pub url: String,
    #[serde(rename = "type")]
    pub media_type: Option<String>,
    #[serde(rename = "assetId")]
    pub asset_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct BulkDeleteDto {
    pub ids: Vec<Uuid>,
}
