use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateCampaignDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    pub name: String,
    pub platform: String,
    #[serde(rename = "dailyBudget")]
    pub daily_budget: Decimal,
    #[serde(rename = "targetAudience")]
    pub target_audience: String,
    pub prompt: String,
    #[serde(rename = "startDate")]
    pub start_date: Option<NaiveDate>,
    #[serde(rename = "endDate")]
    pub end_date: Option<NaiveDate>,
    pub location: Option<String>,
    #[serde(rename = "ageRange")]
    pub age_range: Option<String>,
    #[serde(rename = "targetUrl")]
    pub target_url: Option<String>,
    pub launch: Option<bool>,
}

#[derive(Deserialize, Validate)]
pub struct TenantScopedBody {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
}

#[derive(Deserialize, Validate)]
pub struct AiAssistDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    pub prompt: String,
    pub platform: Option<String>,
}
