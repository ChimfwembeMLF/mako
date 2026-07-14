use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateAutoReplyRuleDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    pub platform: String,
    pub name: String,
    #[serde(rename = "triggerKeywords")]
    pub trigger_keywords: Option<Vec<String>>,
    #[serde(rename = "triggerSentiment")]
    pub trigger_sentiment: Option<String>,
    #[serde(rename = "responseTemplate")]
    pub response_template: Option<String>,
    #[serde(rename = "aiGenerate")]
    pub ai_generate: bool,
    #[serde(rename = "isActive")]
    pub is_active: bool,
}

#[derive(Deserialize, Validate)]
pub struct UpdateAutoReplyRuleDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    pub platform: Option<String>,
    pub name: Option<String>,
    #[serde(rename = "triggerKeywords")]
    pub trigger_keywords: Option<Vec<String>>,
    #[serde(rename = "triggerSentiment")]
    pub trigger_sentiment: Option<String>,
    #[serde(rename = "responseTemplate")]
    pub response_template: Option<String>,
    #[serde(rename = "aiGenerate")]
    pub ai_generate: Option<bool>,
    #[serde(rename = "isActive")]
    pub is_active: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "deletedAt")]
    pub deleted_at: Option<DateTime<FixedOffset>>,
}
