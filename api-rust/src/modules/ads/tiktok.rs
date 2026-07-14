use reqwest::Client;
use rust_decimal::prelude::ToPrimitive;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::ads::entity::campaign::Model as CampaignModel;
use crate::modules::social_accounts::entity::Model as SocialModel;
use crate::modules::social_accounts::token_refresh::SocialTokenRefreshService;

const API_BASE: &str = "https://business-api.tiktok.com/open_api/v1.3";

pub struct TiktokAdsAdapter;

impl TiktokAdsAdapter {
    pub async fn create_campaign(
        state: &AppState,
        tenant_id: Uuid,
        user_id: Uuid,
        campaign: &CampaignModel,
    ) -> ApiResult<String> {
        let account = resolve_account(state, tenant_id, user_id).await?;
        let account = SocialTokenRefreshService::prepare_account(state, account).await?;

        let access_token = account
            .access_token
            .as_deref()
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .ok_or_else(|| {
                ApiError::BadRequest(
                    "TikTok access token missing — reconnect TikTok in Publisher Connect".into(),
                )
            })?;

        let advertiser_id = advertiser_id(&account)?;

        let client = Client::new();
        let response = client
            .post(format!("{API_BASE}/campaign/create/"))
            .header("Access-Token", access_token)
            .json(&json!({
                "advertiser_id": advertiser_id,
                "campaign_name": campaign.name.chars().take(200).collect::<String>(),
                "objective_type": "TRAFFIC",
                "budget_mode": "BUDGET_MODE_DAY",
                "budget": campaign.daily_budget.to_f64().unwrap_or(10.0).max(1.0),
                "operation_status": "DISABLE"
            }))
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(format!("TikTok Ads API request failed: {e}")))?;

        let data: Value = response.json().await.map_err(|e| {
            ApiError::BadRequest(format!("Invalid TikTok Ads response: {e}"))
        })?;

        let campaign_id = data
            .get("data")
            .and_then(|v| v.get("campaign_id"))
            .and_then(json_value_to_string)
            .ok_or_else(|| {
                ApiError::BadRequest(format_tiktok_error(
                    &data,
                    "TikTok Ads API did not return a campaign id",
                ))
            })?;

        Ok(format!("tiktok_{campaign_id}"))
    }
}

fn json_value_to_string(value: &Value) -> Option<String> {
    value
        .as_str()
        .map(str::to_string)
        .or_else(|| value.as_i64().map(|n| n.to_string()))
        .or_else(|| value.as_u64().map(|n| n.to_string()))
}

fn advertiser_id(account: &SocialModel) -> ApiResult<String> {
    if let Some(meta) = account.metadata.as_ref() {
        if let Some(id) = meta.get("advertiser_id").and_then(|v| v.as_str()) {
            let trimmed = id.trim();
            if !trimmed.is_empty() {
                return Ok(trimmed.to_string());
            }
        }
    }

    std::env::var("TIKTOK_ADVERTISER_ID").map_err(|_| {
        ApiError::BadRequest(
            "TIKTOK_ADVERTISER_ID is required for TikTok Ads — set env or reconnect account".into(),
        )
    })
}

async fn resolve_account(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
) -> ApiResult<SocialModel> {
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};

    if let Some(account) = crate::modules::social_accounts::entity::Entity::find()
        .filter(crate::modules::social_accounts::entity::Column::TenantId.eq(tenant_id))
        .filter(crate::modules::social_accounts::entity::Column::UserId.eq(user_id))
        .filter(crate::modules::social_accounts::entity::Column::Platform.eq("tiktok"))
        .filter(crate::modules::social_accounts::entity::Column::Connected.eq(true))
        .order_by_desc(crate::modules::social_accounts::entity::Column::UpdatedAt)
        .one(&state.db)
        .await?
    {
        return Ok(account);
    }

    Err(ApiError::BadRequest(
        "No connected TikTok account found for this tenant".into(),
    ))
}

fn format_tiktok_error(data: &Value, fallback: &str) -> String {
    data.get("message")
        .and_then(|v| v.as_str())
        .or_else(|| {
            data.get("data")
                .and_then(|d| d.get("message"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or(fallback)
        .to_string()
}
