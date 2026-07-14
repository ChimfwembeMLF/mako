use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct ConnectSocialAccountDto {
    pub tenant_id: Uuid,
    #[serde(default)]
    pub workspace_id: Option<Uuid>,
    #[serde(default)]
    pub user_id: Option<Uuid>,
    #[validate(length(min = 1))]
    pub platform: String,
    #[validate(length(min = 1))]
    pub account_name: String,
    #[serde(default)]
    pub external_id: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[validate(length(min = 1))]
    pub access_token: String,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub expires_at: Option<DateTime<FixedOffset>>,
    #[serde(default)]
    pub connected: Option<bool>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct FacebookFinalizeDto {
    #[validate(length(min = 1))]
    pub setup_token: String,
    #[validate(length(min = 1))]
    pub page_id: String,
}

#[derive(Debug, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeFinalizeDto {
    #[validate(length(min = 1))]
    pub setup_token: String,
    #[validate(length(min = 1))]
    pub channel_id: String,
}

#[derive(Debug, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct WhatsappFinalizeDto {
    #[validate(length(min = 1))]
    pub setup_token: String,
    #[validate(length(min = 1))]
    pub phone_number_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthAuthorizeResponse {
    pub redirect_url: String,
    pub redirect_uri: String,
}
