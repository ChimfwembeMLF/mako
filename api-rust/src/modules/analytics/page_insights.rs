use chrono::Utc;
use reqwest::Client;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde_json::Value;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::analytics::entity::{
    ActiveModel as InsightsActiveModel, Column as InsightsColumn, Entity as InsightsEntity,
};
use crate::modules::social_accounts::entity::{
    Column as SocialAccountColumn, Entity as SocialAccountEntity, Model as SocialAccountModel,
};

const GRAPH_API: &str = "https://graph.facebook.com/v20.0";

pub async fn sync_all_insights(state: &AppState) -> ApiResult<()> {
    let accounts = SocialAccountEntity::find()
        .filter(SocialAccountColumn::Connected.eq(true))
        .all(&state.db)
        .await?;

    for account in accounts {
        let platform = account.platform.to_lowercase();
        if platform != "facebook" && platform != "instagram" {
            continue;
        }
        if let Err(err) = sync_account_insights(state, &account).await {
            tracing::error!(
                account_id = %account.id,
                error = %err,
                "Failed to sync insights for social account"
            );
        }
    }
    Ok(())
}

async fn sync_account_insights(state: &AppState, account: &SocialAccountModel) -> ApiResult<()> {
    let today = Utc::now().date_naive();
    let existing = InsightsEntity::find()
        .filter(InsightsColumn::SocialAccountId.eq(account.id))
        .filter(InsightsColumn::Date.eq(today))
        .one(&state.db)
        .await?;

    let insights = match account.platform.to_lowercase().as_str() {
        "facebook" => fetch_facebook_insights(account).await,
        "instagram" => fetch_instagram_insights(account).await,
        _ => InsightsPayload::default(),
    };

    let now = Utc::now().fixed_offset();
    if let Some(row) = existing {
        let mut active: InsightsActiveModel = row.into();
        active.followers_count = Set(insights.followers_count);
        active.reach = Set(insights.reach);
        active.impressions = Set(insights.impressions);
        active.updated_at = Set(now);
        active.update(&state.db).await?;
    } else {
        InsightsActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(account.tenant_id),
            workspace_id: Set(account.workspace_id),
            social_account_id: Set(account.id),
            date: Set(today),
            followers_count: Set(insights.followers_count),
            reach: Set(insights.reach),
            impressions: Set(insights.impressions),
            engagement: Set(0),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(&state.db)
        .await?;
    }
    Ok(())
}

#[derive(Default)]
struct InsightsPayload {
    followers_count: i32,
    reach: i32,
    impressions: i32,
}

async fn fetch_facebook_insights(account: &SocialAccountModel) -> InsightsPayload {
    let token = page_token_from_account(account).unwrap_or_default();
    let page_id = page_id_from_account(account).unwrap_or_default();
    if token.is_empty() || page_id.is_empty() {
        return InsightsPayload::default();
    }

    let client = Client::new();
    let page_res = client
        .get(format!("{GRAPH_API}/{page_id}"))
        .query(&[("access_token", token.as_str()), ("fields", "followers_count")])
        .send()
        .await;
    let metrics_res = client
        .get(format!("{GRAPH_API}/{page_id}/insights"))
        .query(&[
            ("access_token", token.as_str()),
            ("metric", "page_impressions_unique,page_impressions"),
            ("period", "day"),
        ])
        .send()
        .await;

    let followers_count = match page_res {
        Ok(resp) => resp
            .json::<Value>()
            .await
            .ok()
            .and_then(|b| b.get("followers_count").and_then(|v| v.as_i64()))
            .unwrap_or(0) as i32,
        Err(_) => 0,
    };

    let mut reach = 0i32;
    let mut impressions = 0i32;
    if let Ok(resp) = metrics_res {
        if let Ok(body) = resp.json::<Value>().await {
            if let Some(data) = body.get("data").and_then(|v| v.as_array()) {
                for item in data {
                    let name = item.get("name").and_then(|v| v.as_str()).unwrap_or_default();
                    let value = item
                        .get("values")
                        .and_then(|v| v.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|v| v.get("value"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0) as i32;
                    match name {
                        "page_impressions_unique" => reach = value,
                        "page_impressions" => impressions = value,
                        _ => {}
                    }
                }
            }
        }
    }

    InsightsPayload {
        followers_count,
        reach,
        impressions,
    }
}

async fn fetch_instagram_insights(account: &SocialAccountModel) -> InsightsPayload {
    let token = account.access_token.clone().unwrap_or_default();
    let ig_id = account
        .metadata
        .as_ref()
        .and_then(|m| m.get("instagram_business_account_id"))
        .and_then(|v| v.as_str())
        .or_else(|| account.external_id.as_deref())
        .unwrap_or_default()
        .to_string();
    if token.is_empty() || ig_id.is_empty() {
        return InsightsPayload::default();
    }

    let client = Client::new();
    let page_res = client
        .get(format!("{GRAPH_API}/{ig_id}"))
        .query(&[("access_token", token.as_str()), ("fields", "followers_count")])
        .send()
        .await;
    let metrics_res = client
        .get(format!("{GRAPH_API}/{ig_id}/insights"))
        .query(&[
            ("access_token", token.as_str()),
            ("metric", "reach,impressions"),
            ("period", "day"),
        ])
        .send()
        .await;

    let followers_count = match page_res {
        Ok(resp) => resp
            .json::<Value>()
            .await
            .ok()
            .and_then(|b| b.get("followers_count").and_then(|v| v.as_i64()))
            .unwrap_or(0) as i32,
        Err(_) => 0,
    };

    let mut reach = 0i32;
    let mut impressions = 0i32;
    if let Ok(resp) = metrics_res {
        if let Ok(body) = resp.json::<Value>().await {
            if let Some(data) = body.get("data").and_then(|v| v.as_array()) {
                for item in data {
                    let name = item.get("name").and_then(|v| v.as_str()).unwrap_or_default();
                    let value = item
                        .get("values")
                        .and_then(|v| v.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|v| v.get("value"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0) as i32;
                    match name {
                        "reach" => reach = value,
                        "impressions" => impressions = value,
                        _ => {}
                    }
                }
            }
        }
    }

    InsightsPayload {
        followers_count,
        reach,
        impressions,
    }
}

fn page_token_from_account(account: &SocialAccountModel) -> Option<String> {
    account
        .metadata
        .as_ref()
        .and_then(|m| m.get("page_token"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| account.access_token.clone())
}

fn page_id_from_account(account: &SocialAccountModel) -> Option<String> {
    account
        .metadata
        .as_ref()
        .and_then(|m| m.get("page_id"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| account.external_id.clone())
}
