use chrono::{Duration, Utc};
use reqwest::Client;
use serde::Deserialize;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::users::entity::Model as UserModel;
use crate::modules::users::service::{GoogleOAuthTokensInput, UsersService};

#[derive(Deserialize)]
struct GoogleUserInfo {
    email: Option<String>,
    given_name: Option<String>,
    family_name: Option<String>,
    picture: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GoogleTokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
}

pub struct GoogleOAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<chrono::DateTime<Utc>>,
}

pub struct GoogleAuthService;

impl GoogleAuthService {
    pub fn authorization_url(state: &AppState, oauth_state: Option<&str>) -> String {
        Self::authorization_url_with_redirect(
            state,
            oauth_state,
            &state.config.oauth.google_callback_url,
        )
    }

    pub fn authorization_url_with_redirect(
        state: &AppState,
        oauth_state: Option<&str>,
        redirect_uri: &str,
    ) -> String {
        let oauth = &state.config.oauth;
        let scope = "openid email profile https://www.googleapis.com/auth/gmail.send";
        let mut params = vec![
            ("client_id", oauth.google_client_id.as_str()),
            ("redirect_uri", redirect_uri),
            ("response_type", "code"),
            ("scope", scope),
            ("access_type", "offline"),
            ("prompt", "consent"),
        ];
        if let Some(s) = oauth_state {
            params.push(("state", s));
        }
        format!(
            "https://accounts.google.com/o/oauth2/v2/auth?{}",
            encode_params(&params)
        )
    }

    pub async fn exchange_code(state: &AppState, code: &str) -> ApiResult<GoogleTokenResponse> {
        Self::exchange_code_with_redirect(state, code, &state.config.oauth.google_callback_url)
            .await
    }

    pub async fn exchange_code_with_redirect(
        state: &AppState,
        code: &str,
        redirect_uri: &str,
    ) -> ApiResult<GoogleTokenResponse> {
        let oauth = &state.config.oauth;
        let client = Client::new();
        let resp = client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("code", code),
                ("client_id", oauth.google_client_id.as_str()),
                ("client_secret", oauth.google_client_secret.as_str()),
                ("redirect_uri", redirect_uri),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        if let Some(err) = body.get("error").and_then(|v| v.as_str()) {
            let desc = body
                .get("error_description")
                .and_then(|v| v.as_str())
                .unwrap_or(err);
            return Err(ApiError::BadRequest(desc.to_string()));
        }

        serde_json::from_value(body)
            .map_err(|_| ApiError::BadRequest("Google token exchange failed".into()))
    }

    pub async fn authenticate(
        state: &AppState,
        token: &str,
        oauth_tokens: Option<GoogleOAuthTokens>,
    ) -> ApiResult<UserModel> {
        let user_data = Self::get_user_data(token).await?;
        let email = user_data
            .email
            .ok_or_else(|| ApiError::BadRequest("Invalid token".into()))?;

        let user = if let Some(user) = UsersService::find_by_email(state, &email).await? {
            user
        } else {
            UsersService::create_social_user(
                state,
                crate::modules::users::service::SocialUserInput {
                    provider: "google".to_string(),
                    provider_id: Some(email.clone()),
                    email: Some(email),
                    first_name: user_data.given_name,
                    last_name: user_data.family_name,
                    avatar: user_data.picture,
                    is_registered_with_google: true,
                    is_registered_with_facebook: false,
                    is_registered_with_linkedin: false,
                    is_registered_with_instagram: false,
                },
            )
            .await?
        };

        let tokens = oauth_tokens.unwrap_or(GoogleOAuthTokens {
            access_token: token.to_string(),
            refresh_token: None,
            expires_at: Some(Utc::now() + Duration::minutes(55)),
        });

        UsersService::update_google_oauth_tokens(
            state,
            user.id,
            GoogleOAuthTokensInput {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: tokens.expires_at,
            },
        )
        .await?;

        UsersService::find_by_id(state, user.id)
            .await?
            .ok_or_else(|| ApiError::NotFound("User not found".into()))
    }

    pub async fn refresh_access_token(
        state: &AppState,
        refresh_token: &str,
    ) -> ApiResult<GoogleOAuthTokens> {
        let oauth = &state.config.oauth;
        let client = Client::new();
        let resp = client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("client_id", oauth.google_client_id.as_str()),
                ("client_secret", oauth.google_client_secret.as_str()),
                ("refresh_token", refresh_token),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        let body: GoogleTokenResponse = resp
            .json()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        let expires_at = body
            .expires_in
            .map(|secs| Utc::now() + Duration::seconds(secs));

        Ok(GoogleOAuthTokens {
            access_token: body.access_token,
            refresh_token: body.refresh_token,
            expires_at,
        })
    }

    async fn get_user_data(token: &str) -> ApiResult<GoogleUserInfo> {
        let client = Client::new();
        let resp = client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        if !resp.status().is_success() {
            return Err(ApiError::BadRequest("Invalid token".into()));
        }

        resp.json()
            .await
            .map_err(|_| ApiError::BadRequest("Invalid token".into()))
    }
}

pub fn encode_params(params: &[(&str, &str)]) -> String {
    params
        .iter()
        .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&")
}
