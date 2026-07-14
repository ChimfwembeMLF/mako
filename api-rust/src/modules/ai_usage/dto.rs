use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateAiUsageDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "userId")]
    pub user_id: Uuid,
    #[serde(rename = "functionName")]
    pub function_name: String,
    #[serde(rename = "tokensUsed")]
    pub tokens_used: String,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateAiUsageDto {
    #[serde(rename = "functionName")]
    pub function_name: Option<String>,
    #[serde(rename = "tokensUsed")]
    pub tokens_used: Option<String>,
}
