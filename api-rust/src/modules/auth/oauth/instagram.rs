use reqwest::Client;
use serde::Deserialize;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::users::entity::Model as UserModel;
use crate::modules::users::service::{SocialUserInput, UsersService};

#[derive(Deserialize, Clone)]
#[allow(dead_code)]
struct InstagramTokenPayload {
    access_token: Option<String>,
    user_id: Option<String>,
    expires_in: Option<i64>,
}

#[derive(Deserialize)]
struct InstagramTokenResponse {
    access_token: Option<String>,
    user_id: Option<String>,
    expires_in: Option<i64>,
    data: Option<Vec<InstagramTokenPayload>>,
    error_message: Option<String>,
}

#[derive(Deserialize)]
struct InstagramUserData {
    user_id: Option<String>,
    id: Option<String>,
    username: Option<String>,
}

pub struct InstagramAuthService;

impl InstagramAuthService {
    pub fn authorization_url(state: &AppState, oauth_state: Option<&str>) -> String {
        let oauth = &state.config.oauth;
        let mut params = vec![
            ("client_id", oauth.instagram_client_id.as_str()),
            ("redirect_uri", oauth.instagram_callback_url.as_str()),
            ("scope", "instagram_business_basic"),
            ("response_type", "code"),
            ("force_reauth", "true"),
        ];
        if let Some(s) = oauth_state {
            params.push(("state", s));
        }
        format!(
            "https://www.instagram.com/oauth/authorize?{}",
            super::google::encode_params(&params)
        )
    }

    pub async fn exchange_code_for_tokens(
        state: &AppState,
        code: &str,
    ) -> ApiResult<(String, Option<String>)> {
        let oauth = &state.config.oauth;
        let clean_code = code.replace("#_$", "").trim().to_string();
        let client = Client::new();

        let short: InstagramTokenResponse = client
            .post("https://api.instagram.com/oauth/access_token")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!(
                "client_id={}&client_secret={}&grant_type=authorization_code&redirect_uri={}&code={}",
                urlencoding::encode(&oauth.instagram_client_id),
                urlencoding::encode(&oauth.instagram_client_secret),
                urlencoding::encode(&oauth.instagram_callback_url),
                urlencoding::encode(&clean_code),
            ))
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?
            .json()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        let payload = normalize_token_payload(&short);
        let access_token = payload.access_token.ok_or_else(|| {
            ApiError::BadRequest(
                short
                    .error_message
                    .unwrap_or_else(|| "Instagram token exchange failed".into()),
            )
        })?;

        let user_id = payload.user_id.clone();

        if let Ok(long) = client
            .get("https://graph.instagram.com/access_token")
            .query(&[
                ("grant_type", "ig_exchange_token"),
                ("client_secret", oauth.instagram_client_secret.as_str()),
                ("access_token", access_token.as_str()),
            ])
            .send()
            .await
        {
            if let Ok(long_body) = long.json::<InstagramTokenResponse>().await {
                if let Some(token) = long_body.access_token {
                    return Ok((token, user_id));
                }
            }
        }

        Ok((access_token, user_id))
    }

    pub async fn authenticate(
        state: &AppState,
        token: &str,
        fallback_user_id: Option<&str>,
    ) -> ApiResult<UserModel> {
        let user_data = Self::get_user_data(token, fallback_user_id).await?;
        let instagram_id = user_data
            .user_id
            .or(user_data.id)
            .ok_or_else(|| ApiError::BadRequest("Instagram authentication failed".into()))?;

        if let Some(user) =
            UsersService::find_by_provider(state, "instagram", &instagram_id).await?
        {
            return Ok(user);
        }

        let email = format!("instagram.{instagram_id}@instagram.auth");
        UsersService::create_social_user(
            state,
            SocialUserInput {
                provider: "instagram".to_string(),
                provider_id: Some(instagram_id),
                email: Some(email),
                first_name: user_data.username,
                last_name: None,
                avatar: None,
                is_registered_with_google: false,
                is_registered_with_facebook: false,
                is_registered_with_linkedin: false,
                is_registered_with_instagram: true,
            },
        )
        .await
    }

    async fn get_user_data(
        token: &str,
        fallback_user_id: Option<&str>,
    ) -> ApiResult<InstagramUserData> {
        let client = Client::new();
        let result = client
            .get("https://graph.instagram.com/v21.0/me")
            .query(&[("fields", "user_id,username"), ("access_token", token)])
            .send()
            .await;

        match result {
            Ok(resp) if resp.status().is_success() => {
                return resp
                    .json()
                    .await
                    .map_err(|_| ApiError::BadRequest("Invalid Instagram token".into()));
            }
            _ => {
                if let Some(id) = fallback_user_id {
                    return Ok(InstagramUserData {
                        user_id: Some(id.to_string()),
                        id: Some(id.to_string()),
                        username: None,
                    });
                }
                Err(ApiError::BadRequest(
                    "Instagram authentication failed".into(),
                ))
            }
        }
    }
}

fn normalize_token_payload(response: &InstagramTokenResponse) -> InstagramTokenPayload {
    if let Some(data) = &response.data {
        if let Some(first) = data.first() {
            return first.clone();
        }
    }
    InstagramTokenPayload {
        access_token: response.access_token.clone(),
        user_id: response.user_id.clone(),
        expires_in: response.expires_in,
    }
}
