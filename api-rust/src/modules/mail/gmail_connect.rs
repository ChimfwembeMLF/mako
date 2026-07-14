use axum::{
    extract::{Query, State},
    response::{IntoResponse, Redirect, Response},
    routing::{delete, get},
    Json, Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::auth::oauth::google::GoogleAuthService;
use crate::modules::users::service::{GoogleOAuthTokensInput, UsersService};

#[derive(Serialize, Deserialize)]
struct GmailLinkState {
    #[serde(rename = "userId")]
    user_id: Uuid,
    #[serde(rename = "returnUrl")]
    return_url: Option<String>,
}

#[derive(Deserialize)]
struct GmailConnectQuery {
    #[serde(rename = "returnUrl")]
    return_url: Option<String>,
}

#[derive(Deserialize)]
struct GmailCallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    #[serde(rename = "error_description")]
    error_description: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/gmail/status", get(gmail_status))
        .route("/gmail/connect", get(gmail_connect))
        .route("/gmail/callback", get(gmail_callback))
        .route("/gmail/disconnect", delete(gmail_disconnect))
}

fn gmail_callback_url(state: &AppState) -> String {
    let from_env = state.config.oauth.google_gmail_callback_url.trim();
    if !from_env.is_empty() {
        return from_env.trim_end_matches('/').to_string();
    }

    let api_base = crate::modules::social_accounts::oauth::api_base_url(state);
    format!("{api_base}/api/v1/mail/gmail/callback")
}

fn frontend_url(state: &AppState) -> String {
    crate::modules::social_accounts::oauth::frontend_url(state)
}

fn encode_link_state(link_state: &GmailLinkState) -> String {
    let json = serde_json::to_string(link_state).unwrap_or_default();
    URL_SAFE_NO_PAD.encode(json.as_bytes())
}

fn decode_link_state(raw: &str) -> Option<GmailLinkState> {
    let mut value = raw.trim().to_string();
    for _ in 0..3 {
        if !value.contains('%') {
            break;
        }
        value = urlencoding::decode(&value).ok()?.into_owned();
    }
    let bytes = URL_SAFE_NO_PAD.decode(value.as_bytes()).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn redirect_with_query(base: &str, key: &str, value: &str) -> Response {
    let separator = if base.contains('?') { '&' } else { '?' };
    let url = format!("{base}{separator}{key}={}", urlencoding::encode(value));
    Redirect::temporary(&url).into_response()
}

async fn gmail_status(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let user = UsersService::find_by_id(&state, user_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("User not found".into()))?;

    let tokens = UsersService::get_google_oauth_tokens(&state, user_id).await?;
    let connected = tokens.is_some();

    Ok(Json(json!({
        "connected": connected,
        "email": user.email,
        "expiresAt": tokens.and_then(|t| t.expires_at),
        "smtpConfigured": state.config.mail.is_configured(),
    })))
}

async fn gmail_connect(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<GmailConnectQuery>,
) -> ApiResult<Json<Value>> {
    if state.config.oauth.google_client_id.is_empty()
        || state.config.oauth.google_client_secret.is_empty()
    {
        return Err(ApiError::BadRequest(
            "Google OAuth is not configured on the server".into(),
        ));
    }

    let redirect_uri = gmail_callback_url(&state);
    let link_state = GmailLinkState {
        user_id,
        return_url: query.return_url,
    };
    let oauth_state = encode_link_state(&link_state);
    let redirect_url =
        GoogleAuthService::authorization_url_with_redirect(&state, Some(&oauth_state), &redirect_uri);

    Ok(Json(json!({
        "redirectUrl": redirect_url,
        "redirectUri": redirect_uri,
    })))
}

async fn gmail_callback(
    State(state): State<AppState>,
    Query(query): Query<GmailCallbackQuery>,
) -> Response {
    let fallback_return = format!("{}/mail", frontend_url(&state));

    if let Some(error) = query.error.as_deref() {
        let message = query
            .error_description
            .unwrap_or_else(|| error.to_string());
        return redirect_with_query(&fallback_return, "error", &message);
    }

    let (code, link_state) = match (query.code.as_deref(), query.state.as_deref()) {
        (Some(code), Some(raw_state)) if !code.is_empty() && !raw_state.is_empty() => {
            match decode_link_state(raw_state) {
                Some(s) => (code, s),
                None => {
                    return redirect_with_query(
                        &fallback_return,
                        "error",
                        "Invalid OAuth state — try connecting again",
                    );
                }
            }
        }
        _ => {
            return redirect_with_query(
                &fallback_return,
                "error",
                "Missing authorization code or state",
            );
        }
    };

    let return_url = link_state
        .return_url
        .filter(|u| !u.trim().is_empty())
        .unwrap_or(fallback_return);

    let redirect_uri = gmail_callback_url(&state);
    let result: ApiResult<()> = async {
        let token_response =
            GoogleAuthService::exchange_code_with_redirect(&state, code, &redirect_uri).await?;
        let expires_at = token_response
            .expires_in
            .map(|secs| Utc::now() + chrono::Duration::seconds(secs));

        UsersService::update_google_oauth_tokens(
            &state,
            link_state.user_id,
            GoogleOAuthTokensInput {
                access_token: token_response.access_token,
                refresh_token: token_response.refresh_token,
                expires_at,
            },
        )
        .await?;

        Ok(())
    }
    .await;

    match result {
        Ok(()) => redirect_with_query(&return_url, "connected", "1"),
        Err(err) => redirect_with_query(&return_url, "error", &err.to_string()),
    }
}

async fn gmail_disconnect(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    UsersService::clear_google_oauth_tokens(&state, user_id).await?;
    Ok(Json(json!({ "success": true })))
}
