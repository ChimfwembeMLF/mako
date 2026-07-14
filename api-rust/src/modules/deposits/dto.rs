use chrono::{DateTime, FixedOffset};
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateDepositDto {
    #[serde(rename = "depositId")]
    pub deposit_id: String,
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    pub plan: Option<String>,
    pub status: Option<String>,
    pub amount: Option<Decimal>,
    pub currency: Option<String>,
    pub correspondent: Option<String>,
    pub msisdn: Option<String>,
    pub phone: Option<String>,
    pub provider: Option<String>,
    #[serde(rename = "rawPayload")]
    pub raw_payload: Option<serde_json::Value>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<FixedOffset>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<FixedOffset>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateDepositDto {
    #[serde(rename = "depositId")]
    pub deposit_id: Option<String>,
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    pub plan: Option<String>,
    pub status: Option<String>,
    pub amount: Option<Decimal>,
    pub currency: Option<String>,
    pub correspondent: Option<String>,
    pub msisdn: Option<String>,
    pub phone: Option<String>,
    pub provider: Option<String>,
    #[serde(rename = "rawPayload")]
    pub raw_payload: Option<serde_json::Value>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<FixedOffset>>,
}
