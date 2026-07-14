use reqwest::Client;
use serde::Deserialize;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::users::entity::Model as UserModel;
use crate::modules::users::service::{SocialUserInput, UsersService};

#[derive(Deserialize)]
struct FacebookPicture {
    data: Option<FacebookPictureData>,
}

#[derive(Deserialize)]
struct FacebookPictureData {
    url: Option<String>,
}

#[derive(Deserialize)]
struct FacebookUserData {
    id: Option<String>,
    email: Option<String>,
    first_name: Option<String>,
    last_name: Option<String>,
    picture: Option<FacebookPicture>,
}

pub struct FacebookAuthService;

impl FacebookAuthService {
    pub fn authorization_url(state: &AppState, oauth_state: Option<&str>) -> String {
        let oauth = &state.config.oauth;
        let mut params = vec![
            ("client_id", oauth.facebook_app_id.as_str()),
            ("redirect_uri", oauth.facebook_callback_url.as_str()),
            ("scope", "email"),
            ("response_type", "code"),
        ];
        if let Some(s) = oauth_state {
            params.push(("state", s));
        }
        format!(
            "https://www.facebook.com/v19.0/dialog/oauth?{}",
            super::google::encode_params(&params)
        )
    }

    pub async fn exchange_code(state: &AppState, code: &str) -> ApiResult<String> {
        let oauth = &state.config.oauth;
        let url = format!(
            "https://graph.facebook.com/v19.0/oauth/access_token?client_id={}&client_secret={}&redirect_uri={}&code={}",
            urlencoding::encode(&oauth.facebook_app_id),
            urlencoding::encode(&oauth.facebook_app_secret),
            urlencoding::encode(&oauth.facebook_callback_url),
            urlencoding::encode(code),
        );
        let client = Client::new();
        let body: serde_json::Value = client
            .get(&url)
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?
            .json()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        if let Some(msg) = body
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
        {
            return Err(ApiError::BadRequest(format!(
                "Facebook code exchange error: {msg}"
            )));
        }

        body.get("access_token")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .ok_or_else(|| ApiError::BadRequest("Facebook token exchange failed".into()))
    }

    pub async fn authenticate(state: &AppState, token: &str) -> ApiResult<UserModel> {
        let user_data = Self::get_user_data(state, token).await?;
        let provider_id = user_data
            .id
            .ok_or_else(|| ApiError::BadRequest("Invalid Facebook response".into()))?;

        if let Some(user) = UsersService::find_by_provider(state, "facebook", &provider_id).await? {
            return Ok(user);
        }

        UsersService::create_social_user(
            state,
            SocialUserInput {
                provider: "facebook".to_string(),
                provider_id: Some(provider_id),
                email: user_data.email,
                first_name: user_data.first_name,
                last_name: user_data.last_name,
                avatar: user_data.picture.and_then(|p| p.data).and_then(|d| d.url),
                is_registered_with_google: false,
                is_registered_with_facebook: true,
                is_registered_with_linkedin: false,
                is_registered_with_instagram: false,
            },
        )
        .await
    }

    async fn get_user_data(state: &AppState, token: &str) -> ApiResult<FacebookUserData> {
        let oauth = &state.config.oauth;
        let url = format!(
            "{}/me?fields=id,first_name,last_name,name,email,picture&access_token={}",
            oauth.facebook_graph_url.trim_end_matches('/'),
            urlencoding::encode(token)
        );
        let client = Client::new();
        client
            .get(url)
            .send()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?
            .json()
            .await
            .map_err(|_| ApiError::BadRequest("Facebook authentication failed".into()))
    }
}
