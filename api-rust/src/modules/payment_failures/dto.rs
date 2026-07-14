use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreatePaymentFailureDto {
    #[serde(rename = "depositId")]
    pub deposit_id: String,
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    pub provider: Option<String>,
    pub reason: Option<String>,
    #[serde(rename = "rawPayload")]
    pub raw_payload: Option<serde_json::Value>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<FixedOffset>,
}

#[derive(Deserialize, Validate)]
pub struct UpdatePaymentFailureDto {
    #[serde(rename = "depositId")]
    pub deposit_id: Option<String>,
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    pub provider: Option<String>,
    pub reason: Option<String>,
    #[serde(rename = "rawPayload")]
    pub raw_payload: Option<serde_json::Value>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
}
