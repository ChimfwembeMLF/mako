use reqwest::Client;
use rust_decimal::prelude::ToPrimitive;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::ads::entity::creative::Model as CreativeModel;
use crate::modules::ads::entity::campaign::Model as CampaignModel;
use crate::modules::content_publishing::social_account::SocialPublishAccountService;
use crate::modules::social_accounts::entity::Model as SocialModel;
use crate::modules::social_accounts::token_refresh::SocialTokenRefreshService;

const GRAPH_API: &str = "https://graph.facebook.com/v20.0";

pub struct MetaAdsAdapter;

impl MetaAdsAdapter {
    pub async fn create_campaign(
        state: &AppState,
        tenant_id: Uuid,
        user_id: Uuid,
        campaign: &CampaignModel,
        _creative: &CreativeModel,
    ) -> ApiResult<String> {
        let account = resolve_meta_account(state, tenant_id, user_id).await?;
        let account = SocialTokenRefreshService::prepare_account(state, account).await?;

        let access_token = account
            .access_token
            .as_deref()
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .ok_or_else(|| {
                ApiError::BadRequest(
                    "Meta access token missing — reconnect Facebook in Ads settings".into(),
                )
            })?;

        let ad_account_id = resolve_meta_ad_account_id(access_token).await?;
        let page_id = SocialPublishAccountService::facebook_page_id(&account).ok_or_else(|| {
            ApiError::BadRequest("Facebook page not linked — reconnect Meta account".into())
        })?;

        let client = Client::new();
        let campaign_name = campaign.name.chars().take(200).collect::<String>();
        let campaign_resp = client
            .post(format!("{GRAPH_API}/{ad_account_id}/campaigns"))
            .query(&[("access_token", access_token)])
            .json(&json!({
                "name": campaign_name,
                "objective": "OUTCOME_TRAFFIC",
                "status": "PAUSED",
                "special_ad_categories": ["NONE"],
                "is_adset_budget_sharing_enabled": false
            }))
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(format!("Meta Ads API request failed: {e}")))?;

        let campaign_data: Value = campaign_resp.json().await.map_err(|e| {
            ApiError::BadRequest(format!("Invalid Meta campaign response: {e}"))
        })?;
        let campaign_id = campaign_data
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ApiError::BadRequest(format_meta_error(&campaign_data, "Meta campaign create failed"))
            })?;

        let daily_budget_minor = (campaign
            .daily_budget
            .to_f64()
            .unwrap_or(10.0)
            .max(1.0)
            * 100.0) as i64;

        let adset_resp = client
            .post(format!("{GRAPH_API}/{ad_account_id}/adsets"))
            .query(&[("access_token", access_token)])
            .json(&json!({
                "name": format!("{campaign_name} Ad Set"),
                "campaign_id": campaign_id,
                "daily_budget": daily_budget_minor.max(100),
                "billing_event": "IMPRESSIONS",
                "optimization_goal": "LINK_CLICKS",
                "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
                "targeting": {
                    "geo_locations": { "countries": ["ZM"] },
                    "age_min": 18,
                    "age_max": 65
                },
                "status": "PAUSED",
                "promoted_object": { "page_id": page_id }
            }))
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(format!("Meta ad set create failed: {e}")))?;

        let adset_data: Value = adset_resp.json().await.map_err(|e| {
            ApiError::BadRequest(format!("Invalid Meta ad set response: {e}"))
        })?;
        let adset_id = adset_data
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ApiError::BadRequest(format_meta_error(&adset_data, "Meta ad set create failed"))
            })?;

        Ok(format!("meta_{campaign_id}_{adset_id}"))
    }

    pub async fn fetch_metrics(
        state: &AppState,
        tenant_id: Uuid,
        user_id: Uuid,
        platform_campaign_id: &str,
    ) -> ApiResult<super::CampaignMetrics> {
        let campaign_id = platform_campaign_id
            .strip_prefix("meta_")
            .and_then(|rest| rest.split('_').next())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| ApiError::BadRequest("Invalid Meta platform campaign id".into()))?;

        let account = resolve_meta_account(state, tenant_id, user_id).await?;
        let account = SocialTokenRefreshService::prepare_account(state, account).await?;

        let access_token = account
            .access_token
            .as_deref()
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .ok_or_else(|| ApiError::BadRequest("Meta access token missing".into()))?;

        let client = Client::new();
        let response = client
            .get(format!("{GRAPH_API}/{campaign_id}/insights"))
            .query(&[
                ("access_token", access_token),
                ("fields", "spend,impressions,clicks"),
                ("date_preset", "maximum"),
            ])
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(format!("Meta insights request failed: {e}")))?;

        let data: Value = response.json().await.map_err(|e| {
            ApiError::BadRequest(format!("Invalid Meta insights response: {e}"))
        })?;

        let row = data
            .get("data")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .cloned()
            .unwrap_or(json!({}));

        Ok(super::CampaignMetrics {
            spend: row
                .get("spend")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0.0),
            impressions: row
                .get("impressions")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
                .or_else(|| row.get("impressions").and_then(|v| v.as_i64()))
                .unwrap_or(0),
            clicks: row
                .get("clicks")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
                .or_else(|| row.get("clicks").and_then(|v| v.as_i64()))
                .unwrap_or(0),
        })
    }
}

async fn resolve_meta_account(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
) -> ApiResult<SocialModel> {
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};

    let aliases = ["facebook", "instagram", "meta"];
    for platform in aliases {
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
        "No connected Meta account found for this tenant".into(),
    ))
}

async fn resolve_meta_ad_account_id(access_token: &str) -> ApiResult<String> {
    let client = Client::new();
    let response = client
        .get(format!("{GRAPH_API}/me/adaccounts"))
        .query(&[
            ("access_token", access_token),
            ("fields", "account_id,id,name"),
            ("limit", "5"),
        ])
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(format!("Meta ad accounts lookup failed: {e}")))?;

    let data: Value = response.json().await.map_err(|e| {
        ApiError::BadRequest(format!("Invalid Meta ad accounts response: {e}"))
    })?;

    let id = data
        .get("data")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|item| item.get("id").and_then(|v| v.as_str()))
        .map(str::to_string)
        .ok_or_else(|| {
            ApiError::BadRequest(
                "No Meta ad account found — create one in Meta Business Manager".into(),
            )
        })?;

    Ok(id)
}

fn format_meta_error(data: &Value, fallback: &str) -> String {
    let parts = [
        data.get("error")
            .and_then(|e| e.get("error_user_title"))
            .and_then(|v| v.as_str()),
        data.get("error")
            .and_then(|e| e.get("error_user_msg"))
            .and_then(|v| v.as_str()),
        data.get("error")
            .and_then(|e| e.get("message"))
            .and_then(|v| v.as_str()),
        data.get("message").and_then(|v| v.as_str()),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join(" — ");

    if parts.is_empty() {
        fallback.to_string()
    } else {
        parts
    }
}
