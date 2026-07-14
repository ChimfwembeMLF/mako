use reqwest::Client;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde_json::Value;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::content_publications::entity::{
    ActiveModel as PublicationActiveModel, Column as PublicationColumn, Entity as PublicationEntity,
    Model as PublicationModel,
};
use crate::modules::content_publishing::social_account::SocialPublishAccountService;
use crate::modules::social_accounts::entity::{
    Column as SocialColumn, Entity as SocialEntity, Model as SocialModel,
};
use crate::modules::social_accounts::token_refresh::SocialTokenRefreshService;

const GRAPH_API: &str = "https://graph.facebook.com/v20.0";

#[derive(Clone, Debug, Default)]
pub struct EngagementMetrics {
    pub like_count: i32,
    pub comment_count: i32,
    pub share_count: i32,
    pub view_count: i32,
}

pub fn compute_engagement_score(metrics: &EngagementMetrics) -> i32 {
    (metrics.like_count
        + metrics.comment_count * 3
        + metrics.share_count * 5
        + (metrics.view_count as f64 * 0.01) as i32)
        .max(0)
}

pub struct PublicationEngagementService;

impl PublicationEngagementService {
    pub async fn sync_for_tenant(
        state: &AppState,
        tenant_id: Uuid,
        user_id: Uuid,
        workspace_id: Option<Uuid>,
    ) -> ApiResult<u32> {
        let mut query = PublicationEntity::find()
            .filter(PublicationColumn::TenantId.eq(tenant_id))
            .filter(PublicationColumn::Status.eq("published"));

        if let Some(ws) = workspace_id {
            query = query.filter(PublicationColumn::WorkspaceId.eq(ws));
        }

        let publications = query.all(&state.db).await?;
        let mut updated = 0u32;

        for publication in publications {
            let Some(external_post_id) = publication
                .external_post_id
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
            else {
                continue;
            };

            let Some(account) =
                Self::resolve_account(state, &publication, tenant_id, user_id).await?
            else {
                continue;
            };

            let Some(metrics) = Self::fetch_metrics(
                &publication.platform,
                external_post_id,
                &account,
                state,
            )
            .await
            else {
                continue;
            };

            let mut active: PublicationActiveModel = publication.into();
            active.like_count = Set(metrics.like_count);
            active.comment_count = Set(metrics.comment_count);
            active.share_count = Set(metrics.share_count);
            active.view_count = Set(metrics.view_count);
            active.engagement_score = Set(compute_engagement_score(&metrics));
            active.engagement_synced_at = Set(Some(chrono::Utc::now().fixed_offset()));
            active.updated_at = Set(chrono::Utc::now().fixed_offset());
            active.update(&state.db).await?;
            updated += 1;
        }

        Ok(updated)
    }

    async fn resolve_account(
        state: &AppState,
        publication: &PublicationModel,
        tenant_id: Uuid,
        user_id: Uuid,
    ) -> ApiResult<Option<SocialModel>> {
        let mut account = if let Some(account_id) = publication.social_account_id {
            SocialEntity::find_by_id(account_id).one(&state.db).await?
        } else {
            None
        };

        if account.is_none() {
            account = SocialEntity::find()
                .filter(SocialColumn::TenantId.eq(tenant_id))
                .filter(SocialColumn::UserId.eq(user_id))
                .filter(SocialColumn::Platform.eq(publication.platform.clone()))
                .filter(SocialColumn::Connected.eq(true))
                .one(&state.db)
                .await?;
        }

        if account.is_none() {
            account = SocialEntity::find()
                .filter(SocialColumn::TenantId.eq(tenant_id))
                .filter(SocialColumn::Platform.eq(publication.platform.clone()))
                .filter(SocialColumn::Connected.eq(true))
                .one(&state.db)
                .await?;
        }

        let Some(account) = account else {
            return Ok(None);
        };
        if !account.connected {
            return Ok(None);
        }

        let prepared =
            SocialTokenRefreshService::prepare_account(state, account).await?;
        Ok(Some(prepared))
    }

    async fn fetch_metrics(
        platform: &str,
        external_post_id: &str,
        account: &SocialModel,
        state: &AppState,
    ) -> Option<EngagementMetrics> {
        match platform.to_lowercase().as_str() {
            "facebook" => Self::fetch_facebook_metrics(external_post_id, account).await,
            "instagram" => Self::fetch_instagram_metrics(external_post_id, account).await,
            "youtube" => Self::fetch_youtube_metrics(external_post_id, account, state).await,
            "linkedin" => Self::fetch_linkedin_metrics(external_post_id, account).await,
            "twitter" | "x" => Self::fetch_twitter_metrics(external_post_id, account).await,
            _ => None,
        }
    }

    async fn fetch_facebook_metrics(post_id: &str, account: &SocialModel) -> Option<EngagementMetrics> {
        let token = SocialPublishAccountService::facebook_page_token(account)?;
        if token.trim().is_empty() {
            return None;
        }
        let client = Client::new();
        let response = client
            .get(format!("{GRAPH_API}/{post_id}"))
            .query(&[
                ("access_token", token.as_str()),
                ("fields", "likes.summary(true),comments.summary(true),shares"),
            ])
            .send()
            .await
            .ok()?;
        let data: Value = response.json().await.ok()?;
        Some(EngagementMetrics {
            like_count: data
                .get("likes")
                .and_then(|v| v.get("summary"))
                .and_then(|v| v.get("total_count"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            comment_count: data
                .get("comments")
                .and_then(|v| v.get("summary"))
                .and_then(|v| v.get("total_count"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            share_count: data
                .get("shares")
                .and_then(|v| v.get("count"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            view_count: 0,
        })
    }

    async fn fetch_instagram_metrics(media_id: &str, account: &SocialModel) -> Option<EngagementMetrics> {
        let token = SocialPublishAccountService::instagram_token(account)?;
        if token.trim().is_empty() {
            return None;
        }
        let client = Client::new();
        let response = client
            .get(format!("{GRAPH_API}/{media_id}"))
            .query(&[
                ("access_token", token.as_str()),
                ("fields", "like_count,comments_count"),
            ])
            .send()
            .await
            .ok()?;
        let data: Value = response.json().await.ok()?;
        Some(EngagementMetrics {
            like_count: data
                .get("like_count")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            comment_count: data
                .get("comments_count")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            share_count: 0,
            view_count: 0,
        })
    }

    async fn fetch_youtube_metrics(
        video_id: &str,
        account: &SocialModel,
        _state: &AppState,
    ) -> Option<EngagementMetrics> {
        let access_token = account.access_token.as_deref().map(str::trim).filter(|t| !t.is_empty())?;
        let client = Client::new();
        let response = client
            .get("https://www.googleapis.com/youtube/v3/videos")
            .query(&[("part", "statistics"), ("id", video_id)])
            .bearer_auth(access_token)
            .send()
            .await
            .ok()?;
        let data: Value = response.json().await.ok()?;
        let stats = data
            .get("items")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .and_then(|item| item.get("statistics"))?;
        Some(EngagementMetrics {
            like_count: stats
                .get("likeCount")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            comment_count: stats
                .get("commentCount")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            share_count: 0,
            view_count: stats
                .get("viewCount")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
        })
    }

    async fn fetch_linkedin_metrics(post_urn: &str, account: &SocialModel) -> Option<EngagementMetrics> {
        let token = account.access_token.as_deref().map(str::trim).filter(|t| !t.is_empty())?;
        let client = Client::new();
        let response = client
            .get(format!(
                "https://api.linkedin.com/v2/socialActions/{}",
                urlencoding::encode(post_urn)
            ))
            .header("Authorization", format!("Bearer {token}"))
            .header("X-Restli-Protocol-Version", "2.0.0")
            .send()
            .await
            .ok()?;
        if !response.status().is_success() {
            return None;
        }
        let data: Value = response.json().await.ok()?;
        Some(EngagementMetrics {
            like_count: data
                .get("likesSummary")
                .and_then(|v| v.get("totalLikes"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            comment_count: data
                .get("commentsSummary")
                .and_then(|v| v.get("totalFirstLevelComments"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            share_count: 0,
            view_count: 0,
        })
    }

    async fn fetch_twitter_metrics(tweet_id: &str, account: &SocialModel) -> Option<EngagementMetrics> {
        let token = account.access_token.as_deref().map(str::trim).filter(|t| !t.is_empty())?;
        let client = Client::new();
        let response = client
            .get(format!("https://api.twitter.com/2/tweets/{tweet_id}"))
            .query(&[("tweet.fields", "public_metrics")])
            .bearer_auth(token)
            .send()
            .await
            .ok()?;
        if !response.status().is_success() {
            return None;
        }
        let data: Value = response.json().await.ok()?;
        let metrics = data.get("data")?.get("public_metrics")?;
        Some(EngagementMetrics {
            like_count: metrics
                .get("like_count")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            comment_count: metrics
                .get("reply_count")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            share_count: metrics
                .get("retweet_count")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            view_count: metrics
                .get("impression_count")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
        })
    }
}
