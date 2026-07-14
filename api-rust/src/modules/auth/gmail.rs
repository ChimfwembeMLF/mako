use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::Utc;
use reqwest::Client;
use serde::Deserialize;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::auth::oauth::google::GoogleAuthService;
use crate::modules::users::service::{GoogleOAuthTokens, GoogleOAuthTokensInput, UsersService};

#[derive(Deserialize)]
pub struct GmailSendResponse {
    pub id: Option<String>,
}

pub struct GmailService;

impl GmailService {
    pub async fn send_email_as_user(
        state: &AppState,
        user_id: Uuid,
        to: &str,
        subject: &str,
        body: &str,
    ) -> ApiResult<GmailSendResponse> {
        let user = UsersService::find_by_id(state, user_id)
            .await?
            .ok_or_else(|| ApiError::NotFound("User not found".into()))?;

        let from = user
            .email
            .as_deref()
            .ok_or_else(|| ApiError::BadRequest("User has no email for Gmail send".into()))?;

        let mut tokens = UsersService::get_google_oauth_tokens(state, user_id)
            .await?
            .ok_or_else(|| {
                ApiError::BadRequest(
                    "Google OAuth not connected — sign in with Google (gmail.send scope) first"
                        .into(),
                )
            })?;

        let needs_refresh = tokens
            .expires_at
            .map(|exp| exp < Utc::now() + chrono::Duration::seconds(60))
            .unwrap_or(false);

        if needs_refresh {
            let refresh = tokens.refresh_token.as_deref().ok_or_else(|| {
                ApiError::BadRequest(
                    "Google access token expired — re-authenticate with Google".into(),
                )
            })?;

            let refreshed = GoogleAuthService::refresh_access_token(state, refresh).await?;
            UsersService::update_google_oauth_tokens(
                state,
                user_id,
                GoogleOAuthTokensInput {
                    access_token: refreshed.access_token.clone(),
                    refresh_token: refreshed
                        .refresh_token
                        .clone()
                        .or(tokens.refresh_token.clone()),
                    expires_at: refreshed
                        .expires_at
                        .or_else(|| Some(Utc::now() + chrono::Duration::minutes(55))),
                },
            )
            .await?;
            tokens = GoogleOAuthTokens {
                access_token: refreshed.access_token,
                refresh_token: refreshed.refresh_token.or(tokens.refresh_token),
                expires_at: refreshed
                    .expires_at
                    .or_else(|| Some(Utc::now() + chrono::Duration::minutes(55))),
            };
        }

        let raw = create_raw_email(from, to, subject, body);
        let client = Client::new();
        let resp = client
            .post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
            .bearer_auth(&tokens.access_token)
            .json(&serde_json::json!({ "raw": raw }))
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            tracing::error!(status = ?status, "Gmail send failed");
            return Err(ApiError::BadRequest(format!(
                "Gmail send failed: {}",
                if err_body.is_empty() {
                    "unknown error".to_string()
                } else {
                    err_body
                }
            )));
        }

        let data: GmailSendResponse = resp
            .json()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        tracing::info!(
            from = %from,
            to = %to,
            id = ?data.id,
            "Gmail sent"
        );

        Ok(data)
    }
}

fn create_raw_email(from: &str, to: &str, subject: &str, body: &str) -> String {
    let email = format!(
        "From: {from}\r\nTo: {to}\r\nSubject: {subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 7bit\r\n\r\n{body}"
    );
    URL_SAFE_NO_PAD.encode(email.as_bytes())
}
