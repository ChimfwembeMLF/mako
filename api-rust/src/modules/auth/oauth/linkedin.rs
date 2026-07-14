use reqwest::Client;
use serde::Deserialize;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::users::entity::Model as UserModel;
use crate::modules::users::service::{SocialUserInput, UsersService};

#[derive(Deserialize)]
struct LinkedInUserInfo {
    sub: Option<String>,
    email: Option<String>,
    given_name: Option<String>,
    family_name: Option<String>,
    picture: Option<String>,
}

pub struct LinkedInAuthService;

impl LinkedInAuthService {
    pub fn authorization_url(state: &AppState, oauth_state: Option<&str>) -> String {
        let oauth = &state.config.oauth;
        let mut params = vec![
            ("response_type", "code"),
            ("client_id", oauth.linkedin_client_id.as_str()),
            ("redirect_uri", oauth.linkedin_callback_url.as_str()),
            ("scope", "openid profile email"),
        ];
        if let Some(s) = oauth_state {
            params.push(("state", s));
        }
        format!(
            "https://www.linkedin.com/oauth/v2/authorization?{}",
            super::google::encode_params(&params)
        )
    }

    pub async fn exchange_code_for_tokens(state: &AppState, code: &str) -> ApiResult<String> {
        let oauth = &state.config.oauth;
        let client = Client::new();
        let body: serde_json::Value = client
            .post("https://www.linkedin.com/oauth/v2/accessToken")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!(
                "grant_type=authorization_code&code={}&redirect_uri={}&client_id={}&client_secret={}",
                urlencoding::encode(code),
                urlencoding::encode(&oauth.linkedin_callback_url),
                urlencoding::encode(&oauth.linkedin_client_id),
                urlencoding::encode(&oauth.linkedin_client_secret),
            ))
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?
            .json()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        body.get("access_token")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .ok_or_else(|| ApiError::BadRequest("LinkedIn token exchange failed".into()))
    }

    pub async fn authenticate(state: &AppState, token: &str) -> ApiResult<UserModel> {
        let user_data = Self::get_user_data(token).await?;
        let email = user_data
            .email
            .ok_or_else(|| ApiError::BadRequest("Invalid token – email missing".into()))?;

        if let Some(user) = UsersService::find_by_email(state, &email).await? {
            return Ok(user);
        }

        UsersService::create_social_user(
            state,
            SocialUserInput {
                provider: "linkedin".to_string(),
                provider_id: user_data.sub,
                email: Some(email),
                first_name: user_data.given_name,
                last_name: user_data.family_name,
                avatar: user_data.picture,
                is_registered_with_google: false,
                is_registered_with_facebook: false,
                is_registered_with_linkedin: true,
                is_registered_with_instagram: false,
            },
        )
        .await
    }

    async fn get_user_data(token: &str) -> ApiResult<LinkedInUserInfo> {
        let client = Client::new();
        client
            .get("https://api.linkedin.com/v2/userinfo")
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?
            .json()
            .await
            .map_err(|_| ApiError::BadRequest("Invalid LinkedIn token".into()))
    }
}
