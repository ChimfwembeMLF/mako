use reqwest::Client;
use serde_json::json;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::ads::entity::campaign::Model as CampaignModel;
use crate::modules::social_accounts::entity::Model as SocialModel;
use crate::modules::social_accounts::token_refresh::SocialTokenRefreshService;

pub struct LinkedinAdsAdapter;

impl LinkedinAdsAdapter {
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
                    "LinkedIn access token missing — reconnect LinkedIn in Publisher Connect".into(),
                )
            })?;

        let sponsored_account = sponsored_account_urn(&account)?;

        let client = Client::new();
        let response = client
            .post("https://api.linkedin.com/rest/adCampaigns")
            .header("Authorization", format!("Bearer {access_token}"))
            .header("Content-Type", "application/json")
            .header("LinkedIn-Version", "202402")
            .header("X-Restli-Protocol-Version", "2.0.0")
            .json(&json!({
                "account": sponsored_account,
                "name": campaign.name.chars().take(200).collect::<String>(),
                "status": "PAUSED",
                "type": "TEXT_AD",
                "costType": "CPC",
                "dailyBudget": {
                    "amount": campaign.daily_budget.to_string(),
                    "currencyCode": "USD"
                },
                "unitCost": {
                    "amount": "2",
                    "currencyCode": "USD"
                },
                "locale": { "country": "US", "language": "en" }
            }))
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(format!("LinkedIn Ads API request failed: {e}")))?;

        let status = response.status();
        let headers = response.headers().clone();
        let body = response.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(ApiError::BadRequest(format!(
                "LinkedIn Ads API error ({status}): {body}"
            )));
        }

        let campaign_id = headers
            .get("x-restli-id")
            .or_else(|| headers.get("x-linkedin-id"))
            .and_then(|v| v.to_str().ok())
            .map(str::to_string)
            .or_else(|| {
                serde_json::from_str::<serde_json::Value>(&body)
                    .ok()
                    .and_then(|v| v.get("id").and_then(|id| id.as_str()).map(str::to_string))
            })
            .ok_or_else(|| {
                ApiError::BadRequest("LinkedIn Ads API did not return a campaign id".into())
            })?;

        Ok(format!("linkedin_{campaign_id}"))
    }
}

fn sponsored_account_urn(account: &SocialModel) -> ApiResult<String> {
    let from_meta = account
        .metadata
        .as_ref()
        .and_then(|m| m.get("sponsored_account_id"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    let from_external = account
        .external_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    let from_env = std::env::var("LINKEDIN_AD_ACCOUNT_ID").ok();

    let id = from_meta
        .or(from_external)
        .or(from_env)
        .ok_or_else(|| {
            ApiError::BadRequest(
                "LinkedIn ad account id missing — reconnect LinkedIn or set LINKEDIN_AD_ACCOUNT_ID"
                    .into(),
            )
        })?;

    Ok(if id.starts_with("urn:") {
        id
    } else {
        format!("urn:li:sponsoredAccount:{id}")
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
        .filter(crate::modules::social_accounts::entity::Column::Platform.eq("linkedin"))
        .filter(crate::modules::social_accounts::entity::Column::Connected.eq(true))
        .order_by_desc(crate::modules::social_accounts::entity::Column::UpdatedAt)
        .one(&state.db)
        .await?
    {
        return Ok(account);
    }

    Err(ApiError::BadRequest(
        "No connected LinkedIn account found for this tenant".into(),
    ))
}
