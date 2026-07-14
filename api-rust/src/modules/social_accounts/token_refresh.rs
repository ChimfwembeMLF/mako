use chrono::{Duration, Utc};
use reqwest::Client;
use sea_orm::{ActiveModelTrait, Set};
use serde_json::{json, Value};

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::social_accounts::entity::{
    ActiveModel as SocialActiveModel, Model as SocialModel,
};

pub struct SocialTokenRefreshService;

impl SocialTokenRefreshService {
    pub async fn prepare_account(
        state: &AppState,
        account: SocialModel,
    ) -> ApiResult<SocialModel> {
        Ok(Self::refresh_access_token_if_needed(state, account).await?)
    }

    pub async fn refresh_access_token_if_needed(
        state: &AppState,
        account: SocialModel,
    ) -> ApiResult<SocialModel> {
        if !account.connected {
            return Ok(account);
        }
        if Self::has_recent_auth_failure(&account) {
            return Ok(account);
        }

        let is_meta = matches!(
            account.platform.as_str(),
            "facebook" | "instagram" | "whatsapp"
        );
        let buffer_ms = if is_meta {
            15 * 24 * 60 * 60 * 1000
        } else {
            5 * 60 * 1000
        };

        let expires_soon = account.expires_at.map(|expires| {
            let millis = expires.timestamp_millis() - Utc::now().timestamp_millis();
            millis <= buffer_ms
        });

        if account.expires_at.is_some() && !expires_soon.unwrap_or(false) {
            return Ok(account);
        }

        if matches!(account.platform.as_str(), "facebook" | "instagram")
            && account
                .metadata
                .as_ref()
                .and_then(|m| m.get("page_token"))
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|t| !t.is_empty())
                .is_some()
        {
            return Ok(account);
        }

        if account.expires_at.is_none() {
            return Ok(account);
        }

        Self::force_refresh_token(state, account).await
    }

    pub async fn force_refresh_token(
        state: &AppState,
        account: SocialModel,
    ) -> ApiResult<SocialModel> {
        if !account.connected || Self::has_recent_auth_failure(&account) {
            return Ok(account);
        }

        if account.refresh_token.is_none()
            && !matches!(
                account.platform.as_str(),
                "facebook" | "instagram" | "whatsapp"
            )
        {
            return Ok(account);
        }

        let refreshed = match Self::refresh_provider_token(state, &account).await {
            Ok(Some(data)) => data,
            Ok(None) => return Ok(account),
            Err(err) => {
                tracing::debug!(
                    platform = %account.platform,
                    account_id = %account.id,
                    error = %err,
                    "Token refresh failed"
                );
                return Ok(account);
            }
        };

        let mut active: SocialActiveModel = account.into();
        if let Some(access_token) = refreshed.get("accessToken").and_then(|v| v.as_str()) {
            active.access_token = Set(Some(access_token.to_string()));
        }
        if let Some(refresh_token) = refreshed.get("refreshToken").and_then(|v| v.as_str()) {
            active.refresh_token = Set(Some(refresh_token.to_string()));
        }
        if let Some(expires_at) = refreshed.get("expiresAt").and_then(|v| v.as_str()) {
            if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(expires_at) {
                active.expires_at = Set(Some(parsed));
            }
        }
        active.updated_at = Set(Utc::now().fixed_offset());
        Ok(active.update(&state.db).await?)
    }

    fn has_recent_auth_failure(account: &SocialModel) -> bool {
        let Some(at) = account
            .metadata
            .as_ref()
            .and_then(|m| m.get("auth_error_at"))
            .and_then(|v| v.as_str())
        else {
            return false;
        };
        chrono::DateTime::parse_from_rfc3339(at)
            .ok()
            .map(|dt| {
                let age = Utc::now().signed_duration_since(dt.with_timezone(&Utc));
                age < Duration::hours(24) && age >= Duration::zero()
            })
            .unwrap_or(false)
    }

    async fn refresh_provider_token(
        state: &AppState,
        account: &SocialModel,
    ) -> ApiResult<Option<Value>> {
        match account.platform.as_str() {
            "facebook" => {
                let token = account.access_token.as_deref().unwrap_or("");
                Ok(Some(Self::refresh_facebook_token(state, token).await?))
            }
            "instagram" => {
                let token = account.access_token.as_deref().unwrap_or("");
                Ok(Some(Self::refresh_instagram_token(state, token).await?))
            }
            "whatsapp" => {
                if let Some(token) = account.access_token.as_deref() {
                    Ok(Some(Self::refresh_facebook_token(state, token).await?))
                } else {
                    Ok(None)
                }
            }
            "linkedin" => {
                if let Some(token) = account.refresh_token.as_deref() {
                    Ok(Some(Self::refresh_linkedin_token(state, token).await?))
                } else {
                    Ok(None)
                }
            }
            "google" | "youtube" => {
                if let Some(token) = account.refresh_token.as_deref() {
                    Ok(Some(Self::refresh_google_token(state, token).await?))
                } else {
                    Ok(None)
                }
            }
            "tiktok" => {
                if let Some(token) = account.refresh_token.as_deref() {
                    Ok(Some(Self::refresh_tiktok_token(state, token).await?))
                } else {
                    Ok(None)
                }
            }
            _ => Ok(None),
        }
    }

    async fn refresh_facebook_token(_state: &AppState, access_token: &str) -> ApiResult<Value> {
        let app_id = std::env::var("FACEBOOK_APP_ID").unwrap_or_default();
        let app_secret = std::env::var("FACEBOOK_APP_SECRET").unwrap_or_default();
        if app_id.is_empty() || app_secret.is_empty() {
            return Err(crate::common::ApiError::BadRequest(
                "Facebook app credentials are not configured".into(),
            ));
        }

        let client = Client::new();
        let response = client
            .get("https://graph.facebook.com/v18.0/oauth/access_token")
            .query(&[
                ("grant_type", "fb_exchange_token"),
                ("client_id", app_id.as_str()),
                ("client_secret", app_secret.as_str()),
                ("fb_exchange_token", access_token),
            ])
            .send()
            .await
            .map_err(|e| crate::common::ApiError::BadRequest(e.to_string()))?;

        let data: Value = response.json().await.map_err(|e| {
            crate::common::ApiError::BadRequest(format!("Facebook token refresh failed: {e}"))
        })?;

        let access_token = data
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                crate::common::ApiError::BadRequest("Facebook token refresh failed".into())
            })?;

        let expires_at = data
            .get("expires_in")
            .and_then(|v| v.as_i64())
            .map(|secs| (Utc::now() + Duration::seconds(secs)).to_rfc3339());

        Ok(json!({
            "accessToken": access_token,
            "expiresAt": expires_at
        }))
    }

    async fn refresh_instagram_token(state: &AppState, access_token: &str) -> ApiResult<Value> {
        Self::refresh_facebook_token(state, access_token).await
    }

    async fn refresh_linkedin_token(_state: &AppState, refresh_token: &str) -> ApiResult<Value> {
        let client_id = std::env::var("LINKEDIN_CLIENT_ID").unwrap_or_default();
        let client_secret = std::env::var("LINKEDIN_CLIENT_SECRET").unwrap_or_default();
        if client_id.is_empty() || client_secret.is_empty() {
            return Err(crate::common::ApiError::BadRequest(
                "LinkedIn credentials are not configured".into(),
            ));
        }

        let client = Client::new();
        let response = client
            .post("https://www.linkedin.com/oauth/v2/accessToken")
            .form(&[
                ("grant_type", "refresh_token"),
                ("refresh_token", refresh_token),
                ("client_id", client_id.as_str()),
                ("client_secret", client_secret.as_str()),
            ])
            .send()
            .await
            .map_err(|e| crate::common::ApiError::BadRequest(e.to_string()))?;

        let data: Value = response.json().await.map_err(|e| {
            crate::common::ApiError::BadRequest(format!("LinkedIn token refresh failed: {e}"))
        })?;

        Ok(json!({
            "accessToken": data.get("access_token").and_then(|v| v.as_str()),
            "refreshToken": data.get("refresh_token").and_then(|v| v.as_str()),
            "expiresAt": data.get("expires_in").and_then(|v| v.as_i64()).map(|secs| {
                (Utc::now() + Duration::seconds(secs)).to_rfc3339()
            })
        }))
    }

    async fn refresh_google_token(state: &AppState, refresh_token: &str) -> ApiResult<Value> {
        let _ = state;
        let client_id = std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default();
        let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default();
        if client_id.is_empty() || client_secret.is_empty() {
            return Err(crate::common::ApiError::BadRequest(
                "Google credentials are not configured".into(),
            ));
        }

        let client = Client::new();
        let response = client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("client_id", client_id.as_str()),
                ("client_secret", client_secret.as_str()),
                ("refresh_token", refresh_token),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await
            .map_err(|e| crate::common::ApiError::BadRequest(e.to_string()))?;

        let data: Value = response.json().await.map_err(|e| {
            crate::common::ApiError::BadRequest(format!("Google token refresh failed: {e}"))
        })?;

        Ok(json!({
            "accessToken": data.get("access_token").and_then(|v| v.as_str()),
            "refreshToken": data.get("refresh_token").and_then(|v| v.as_str()),
            "expiresAt": data.get("expires_in").and_then(|v| v.as_i64()).map(|secs| {
                (Utc::now() + Duration::seconds(secs)).to_rfc3339()
            })
        }))
    }

    async fn refresh_tiktok_token(state: &AppState, refresh_token: &str) -> ApiResult<Value> {
        let _ = state;
        let client_key = std::env::var("TIKTOK_CLIENT_KEY").unwrap_or_default();
        let client_secret = std::env::var("TIKTOK_CLIENT_SECRET").unwrap_or_default();
        if client_key.is_empty() || client_secret.is_empty() {
            return Err(crate::common::ApiError::BadRequest(
                "TikTok credentials are not configured".into(),
            ));
        }

        let client = Client::new();
        let response = client
            .post("https://open.tiktokapis.com/v2/oauth/token/")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .form(&[
                ("client_key", client_key.as_str()),
                ("client_secret", client_secret.as_str()),
                ("grant_type", "refresh_token"),
                ("refresh_token", refresh_token),
            ])
            .send()
            .await
            .map_err(|e| crate::common::ApiError::BadRequest(e.to_string()))?;

        let data: Value = response.json().await.map_err(|e| {
            crate::common::ApiError::BadRequest(format!("TikTok token refresh failed: {e}"))
        })?;

        Ok(json!({
            "accessToken": data.get("access_token").and_then(|v| v.as_str()),
            "refreshToken": data.get("refresh_token").and_then(|v| v.as_str()),
            "expiresAt": data.get("expires_in").and_then(|v| v.as_i64()).map(|secs| {
                (Utc::now() + Duration::seconds(secs)).to_rfc3339()
            })
        }))
    }
}
