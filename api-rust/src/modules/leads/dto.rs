use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateLeadDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    #[serde(rename = "userId")]
    pub user_id: Uuid,
    #[validate(length(min = 1))]
    pub name: String,
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 1))]
    pub source: String,
    pub message: Option<String>,
    pub classification: Option<String>,
    pub status: Option<String>,
    #[serde(rename = "aiReply")]
    pub ai_reply: Option<String>,
    pub unsubscribed: Option<bool>,
    #[serde(rename = "unsubscribeToken")]
    pub unsubscribe_token: Option<String>,
    #[serde(rename = "deletedAt")]
    pub deleted_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<FixedOffset>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<FixedOffset>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateLeadDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    pub name: Option<String>,
    pub email: Option<String>,
    pub source: Option<String>,
    pub message: Option<String>,
    pub classification: Option<String>,
    pub status: Option<String>,
    #[serde(rename = "aiReply")]
    pub ai_reply: Option<String>,
    pub unsubscribed: Option<bool>,
    #[serde(rename = "unsubscribeToken")]
    pub unsubscribe_token: Option<String>,
    #[serde(rename = "deletedAt")]
    pub deleted_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<FixedOffset>>,
}

#[derive(Deserialize)]
pub struct WebhookLeadDto {
    #[serde(rename = "sourceId")]
    pub source_id: Option<Uuid>,
    pub name: Option<String>,
    pub email: Option<String>,
    pub message: Option<String>,
    pub source: Option<String>,
}
