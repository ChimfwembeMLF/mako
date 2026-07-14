use reqwest::Client;
use rust_decimal::prelude::ToPrimitive;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::ads::entity::campaign::Model as CampaignModel;
use crate::modules::social_accounts::entity::Model as SocialModel;
use crate::modules::social_accounts::token_refresh::SocialTokenRefreshService;

const API_BASE: &str = "https://ads-api.twitter.com/12";

pub struct XAdsAdapter;

impl XAdsAdapter {
    pub async fn create_campaign(
        state: &AppState,
        tenant_id: Uuid,
        user_id: Uuid,
        campaign: &CampaignModel,
    ) -> ApiResult<String> {
        let (account_id, access_token) = resolve_credentials(state, tenant_id, user_id).await?;

        let daily_micros = (campaign.daily_budget.to_f64().unwrap_or(10.0).max(1.0) * 1_000_000.0)
            as i64;

        let mut body = json!({
            "name": campaign.name.chars().take(200).collect::<String>(),
            "daily_budget_amount_local_micro": daily_micros.max(1_000_000),
            "entity_status": "PAUSED"
        });

        if let Ok(funding) = std::env::var("X_ADS_FUNDING_INSTRUMENT_ID") {
            if !funding.trim().is_empty() {
                body["funding_instrument_id"] = json!(funding.trim());
            }
        }

        let client = Client::new();
        let response = client
            .post(format!("{API_BASE}/accounts/{account_id}/campaigns"))
            .bearer_auth(&access_token)
            .json(&body)
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(format!("X Ads API request failed: {e}")))?;

        let data: Value = response.json().await.map_err(|e| {
            ApiError::BadRequest(format!("Invalid X Ads response: {e}"))
        })?;

        let campaign_id = data
            .get("data")
            .and_then(|v| v.get("id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ApiError::BadRequest(format_x_error(&data, "X Ads API did not return a campaign id"))
            })?;

        Ok(format!("x_{campaign_id}"))
    }
}

async fn resolve_credentials(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
) -> ApiResult<(String, String)> {
    let env_account = std::env::var("X_ADS_ACCOUNT_ID").ok();
    let env_token = std::env::var("X_ADS_ACCESS_TOKEN").ok();

    if let (Some(ref account_id), Some(ref token)) = (&env_account, &env_token) {
        let account_id = account_id.trim().to_string();
        let token = token.trim().to_string();
        if !account_id.is_empty() && !token.is_empty() {
            return Ok((account_id, token));
        }
    }

    let account = resolve_account(state, tenant_id, user_id).await?;
    let account = SocialTokenRefreshService::prepare_account(state, account).await?;

    let access_token = account
        .access_token
        .as_deref()
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .ok_or_else(|| {
            ApiError::BadRequest(
                "X Ads credentials missing — connect Twitter or set X_ADS_ACCOUNT_ID and X_ADS_ACCESS_TOKEN"
                    .into(),
            )
        })?
        .to_string();

    let account_id = env_account
        .or(account.external_id.clone())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| {
            ApiError::BadRequest(
                "X_ADS_ACCOUNT_ID is required for X Ads — set env or reconnect account".into(),
            )
        })?;

    Ok((account_id, access_token))
}

async fn resolve_account(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
) -> ApiResult<SocialModel> {
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};

    for platform in ["x", "twitter"] {
        if let Some(account) = crate::modules::social_accounts::entity::Entity::find()
            .filter(crate::modules::social_accounts::entity::Column::TenantId.eq(tenant_id))
            .filter(crate::modules::social_accounts::entity::Column::UserId.eq(user_id))
            .filter(crate::modules::social_accounts::entity::Column::Platform.eq(platform))
            .filter(crate::modules::social_accounts::entity::Column::Connected.eq(true))
            .order_by_desc(crate::modules::social_accounts::entity::Column::UpdatedAt)
            .one(&state.db)
            .await?
        {
            return Ok(account);
        }
    }

    Err(ApiError::BadRequest(
        "No connected X/Twitter account found for this tenant".into(),
    ))
}

fn format_x_error(data: &Value, fallback: &str) -> String {
    data.get("errors")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|e| e.get("message").and_then(|m| m.as_str()))
        .or_else(|| data.get("detail").and_then(|v| v.as_str()))
        .unwrap_or(fallback)
        .to_string()
}
