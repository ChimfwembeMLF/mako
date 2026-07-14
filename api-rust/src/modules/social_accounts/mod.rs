pub mod dto;
pub mod entity;
pub mod oauth;
pub mod service;
pub mod token_refresh;

use axum::{
    extract::{Path, Query, State},
    response::{IntoResponse, Redirect, Response},
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::social_accounts::dto::{
    ConnectSocialAccountDto, FacebookFinalizeDto, OAuthAuthorizeResponse, WhatsappFinalizeDto,
    YoutubeFinalizeDto,
};
use crate::modules::social_accounts::oauth::{
    attach_tiktok_pkce, decode_state, encode_state, get_authorize_url, get_callback_url,
    verify_facebook_setup_token, verify_whatsapp_setup_token, verify_youtube_setup_token,
    FacebookSetupPayload, OAuthConnectState, WhatsappSetupFromMetaResult, YoutubeSetupPayload,
    OAUTH_PLATFORMS,
};
use crate::modules::social_accounts::service::SocialAccountsService;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/connect", post(connect))
        .route("/tenant/{tenant_id}", get(find_by_tenant))
        .route("/me", get(get_my_accounts))
        .route("/oauth/{platform}/authorize", get(start_oauth))
        .route("/oauth/{platform}/callback", get(oauth_callback))
        .route("/facebook/setup", get(get_facebook_setup))
        .route("/facebook/finalize", post(finalize_facebook))
        .route("/youtube/setup", get(get_youtube_setup))
        .route("/youtube/finalize", post(finalize_youtube))
        .route("/whatsapp/enable-platform", post(enable_platform_whatsapp))
        .route("/whatsapp/setup-from-meta", post(setup_whatsapp_from_meta))
        .route("/whatsapp/setup", get(get_whatsapp_setup))
        .route("/whatsapp/finalize", post(finalize_whatsapp))
        .route("/{id}/disconnect", post(disconnect))
        .route("/{id}", delete(remove))
}

#[derive(Deserialize)]
struct TenantQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct OAuthAuthorizeQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
    #[serde(rename = "returnUrl")]
    return_url: Option<String>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct SetupTokenQuery {
    token: Option<String>,
}

#[derive(Deserialize)]
struct OAuthCallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    #[serde(rename = "error_description")]
    error_description: Option<String>,
}

async fn connect(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(mut payload): Json<ConnectSocialAccountDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    if let Some(dto_user_id) = payload.user_id {
        if dto_user_id != user_id {
            return Err(ApiError::Unauthorized(
                "Cannot connect social account for another user".into(),
            ));
        }
    }

    payload.user_id = Some(user_id);
    payload.connected = Some(true);

    let account = SocialAccountsService::connect_account(&state, payload).await?;
    Ok(Json(account))
}

async fn find_by_tenant(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let accounts =
        SocialAccountsService::find_by_tenant(&state, tenant_id, user_id, query.workspace_id)
            .await?;
    Ok(Json(json!(accounts)))
}

async fn get_my_accounts(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let accounts = SocialAccountsService::find_by_user(&state, user_id).await?;
    Ok(Json(json!(accounts)))
}

async fn start_oauth(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(platform): Path<String>,
    Query(query): Query<OAuthAuthorizeQuery>,
) -> ApiResult<Json<OAuthAuthorizeResponse>> {
    if !OAUTH_PLATFORMS.contains(&platform.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Unsupported OAuth platform: {platform}"
        )));
    }

    let tenant_id = query
        .tenant_id
        .ok_or_else(|| ApiError::BadRequest("tenantId query parameter is required".into()))?;

    let api_base = crate::modules::social_accounts::oauth::api_base_url(&state);
    let redirect_uri = get_callback_url(&state, &api_base, &platform);

    let mut connect_state = OAuthConnectState {
        user_id,
        tenant_id,
        workspace_id: query.workspace_id,
        return_url: query.return_url,
        provider: platform.clone(),
        redirect_uri: redirect_uri.clone(),
        code_verifier: None,
    };

    if platform == "tiktok" {
        connect_state = attach_tiktok_pkce(connect_state);
    }

    let oauth_state = encode_state(&connect_state);
    let redirect_url = get_authorize_url(
        &state,
        &platform,
        &oauth_state,
        &redirect_uri,
        connect_state.code_verifier.as_deref(),
    )?;

    Ok(Json(OAuthAuthorizeResponse {
        redirect_url,
        redirect_uri,
    }))
}

async fn oauth_callback(
    State(state): State<AppState>,
    Path(platform): Path<String>,
    Query(query): Query<OAuthCallbackQuery>,
) -> Response {
    let fallback_return = format!(
        "{}/publisher",
        crate::modules::social_accounts::oauth::frontend_url(&state)
    );

    if let Some(error) = query.error.as_deref() {
        let mut message = query
            .error_description
            .clone()
            .unwrap_or_else(|| error.to_string());
        if error == "unauthorized_scope_error" && platform == "linkedin" {
            message = "LinkedIn rejected a requested permission. Reconnect after removing restricted scopes, or enable Share on LinkedIn (w_member_social) in your LinkedIn app Products tab.".into();
        }
        return redirect_with_query(&fallback_return, "error", &message);
    }

    let (code, oauth_state) = match (query.code.as_deref(), query.state.as_deref()) {
        (Some(code), Some(state)) if !code.is_empty() && !state.is_empty() => (code, state),
        _ => {
            return ApiError::BadRequest("Missing OAuth code or state".into()).into_response();
        }
    };

    if !OAUTH_PLATFORMS.contains(&platform.as_str()) {
        return ApiError::BadRequest(format!("Unsupported OAuth platform: {platform}"))
            .into_response();
    }

    let decoded = match decode_state(oauth_state) {
        Some(decoded) if decoded.provider == platform => decoded,
        _ => {
            return redirect_with_query(
                &fallback_return,
                "error",
                "Invalid OAuth state — please start connect again from Publisher",
            );
        }
    };

    let return_url = decoded
        .return_url
        .clone()
        .unwrap_or_else(|| fallback_return.clone());

    match handle_oauth_callback(&state, &platform, code, &decoded).await {
        Ok(redirect) => redirect,
        Err(err) => {
            let message = crate::modules::social_accounts::oauth::format_oauth_error(&err);
            tracing::error!("OAuth callback failed for {platform}: {message}");
            redirect_to_return_url(&return_url, "error", &message)
        }
    }
}

async fn handle_oauth_callback(
    state: &AppState,
    platform: &str,
    code: &str,
    decoded: &OAuthConnectState,
) -> Result<Response, ApiError> {
    let return_url = decoded.return_url.clone().unwrap_or_else(|| {
        format!(
            "{}/publisher",
            crate::modules::social_accounts::oauth::frontend_url(state)
        )
    });

    if platform == "whatsapp" {
        let (access_token, expires_at, phones) =
            oauth::prepare_whatsapp_connect(state, code, &decoded.redirect_uri).await?;
        let setup_token = oauth::create_whatsapp_setup_token(
            state,
            oauth::WhatsAppSetupPayload {
                token_type: String::new(),
                user_id: decoded.user_id,
                tenant_id: decoded.tenant_id,
                workspace_id: decoded.workspace_id,
                access_token,
                expires_at: expires_at.map(|d| d.to_rfc3339()),
                phones,
                exp: 0,
            },
        )?;
        return Ok(redirect_to_return_url(
            &return_url,
            "whatsapp_setup",
            &setup_token,
        ));
    }

    if platform == "facebook" {
        let (access_token, expires_at, profile, pages) =
            oauth::prepare_facebook_connect(state, code, &decoded.redirect_uri).await?;
        let setup_token = oauth::create_facebook_setup_token(
            state,
            FacebookSetupPayload {
                token_type: String::new(),
                user_id: decoded.user_id,
                tenant_id: decoded.tenant_id,
                workspace_id: decoded.workspace_id,
                access_token,
                expires_at: expires_at.map(|d| d.to_rfc3339()),
                profile,
                pages,
                exp: 0,
            },
        )?;
        return Ok(redirect_to_return_url(
            &return_url,
            "facebook_setup",
            &setup_token,
        ));
    }

    if platform == "youtube" {
        let (access_token, refresh_token, expires_at, profile, channels) =
            oauth::prepare_youtube_connect(state, code, &decoded.redirect_uri).await?;
        let setup_token = oauth::create_youtube_setup_token(
            state,
            YoutubeSetupPayload {
                token_type: String::new(),
                user_id: decoded.user_id,
                tenant_id: decoded.tenant_id,
                workspace_id: decoded.workspace_id,
                access_token,
                refresh_token,
                expires_at: expires_at.map(|d| d.to_rfc3339()),
                profile,
                channels,
                exp: 0,
            },
        )?;
        return Ok(redirect_to_return_url(
            &return_url,
            "youtube_setup",
            &setup_token,
        ));
    }

    let result = oauth::handle_callback(
        state,
        platform,
        code,
        &decoded.redirect_uri,
        decoded.code_verifier.as_deref(),
    )
    .await?;

    SocialAccountsService::connect_from_oauth_result(
        state,
        decoded.tenant_id,
        decoded.workspace_id,
        decoded.user_id,
        result,
    )
    .await?;

    Ok(redirect_to_return_url(&return_url, "connected", platform))
}

async fn get_facebook_setup(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<SetupTokenQuery>,
) -> ApiResult<Json<Value>> {
    let token = query
        .token
        .as_deref()
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .ok_or_else(|| ApiError::BadRequest("token query parameter is required".into()))?;

    let payload = verify_facebook_setup_token(&state, token)?;

    Ok(Json(json!({
        "pages": payload.pages,
        "profileName": payload.profile.name,
    })))
}

async fn finalize_facebook(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<FacebookFinalizeDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let setup = verify_facebook_setup_token(&state, &payload.setup_token)?;
    if setup.user_id != user_id {
        return Err(ApiError::Unauthorized(
            "Facebook setup token does not belong to this user".into(),
        ));
    }

    let result = oauth::build_facebook_connect_result(&state, &setup, &payload.page_id).await?;
    let account = SocialAccountsService::connect_from_oauth_result(
        &state,
        setup.tenant_id,
        setup.workspace_id,
        setup.user_id,
        result,
    )
    .await?;

    Ok(Json(account))
}

async fn get_youtube_setup(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<SetupTokenQuery>,
) -> ApiResult<Json<Value>> {
    let token = query
        .token
        .as_deref()
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .ok_or_else(|| ApiError::BadRequest("token query parameter is required".into()))?;

    let payload = verify_youtube_setup_token(&state, token)?;

    Ok(Json(json!({
        "channels": payload.channels,
        "profileName": payload.profile.as_ref().and_then(|p| p.name.clone())
            .or_else(|| payload.profile.as_ref().and_then(|p| p.id.clone())),
    })))
}

async fn finalize_youtube(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<YoutubeFinalizeDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let setup = verify_youtube_setup_token(&state, &payload.setup_token)?;
    if setup.user_id != user_id {
        return Err(ApiError::Unauthorized(
            "YouTube setup token does not belong to this user".into(),
        ));
    }

    let result = oauth::build_youtube_connect_result(&setup, &payload.channel_id)?;
    let account = SocialAccountsService::connect_from_oauth_result(
        &state,
        setup.tenant_id,
        setup.workspace_id,
        setup.user_id,
        result,
    )
    .await?;

    Ok(Json(account))
}

async fn enable_platform_whatsapp() -> ApiResult<Json<Value>> {
    Err(ApiError::BadRequest(
        "Shared platform WhatsApp is disabled. Connect your own WhatsApp Business number via Publisher Connect → WhatsApp → Connect.".into(),
    ))
}

async fn setup_whatsapp_from_meta(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<WhatsappSetupFromMetaResult>> {
    let tenant_id = query
        .tenant_id
        .ok_or_else(|| ApiError::BadRequest("tenantId query parameter is required".into()))?;

    let result = SocialAccountsService::prepare_whatsapp_from_existing_meta(
        &state,
        tenant_id,
        user_id,
        query.workspace_id,
    )
    .await?;

    Ok(Json(result))
}

async fn get_whatsapp_setup(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<SetupTokenQuery>,
) -> ApiResult<Json<Value>> {
    let token = query
        .token
        .as_deref()
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .ok_or_else(|| ApiError::BadRequest("token query parameter is required".into()))?;

    let payload = verify_whatsapp_setup_token(&state, token)?;

    Ok(Json(json!({
        "phones": payload.phones,
    })))
}

async fn finalize_whatsapp(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<WhatsappFinalizeDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let setup = verify_whatsapp_setup_token(&state, &payload.setup_token)?;
    if setup.user_id != user_id {
        return Err(ApiError::Unauthorized(
            "WhatsApp setup token does not belong to this user".into(),
        ));
    }

    let phone = setup
        .phones
        .iter()
        .find(|p| p.id == payload.phone_number_id)
        .ok_or_else(|| {
            ApiError::BadRequest(
                "Selected phone number is not available for this setup session".into(),
            )
        })?;

    let account_name = phone
        .verified_name
        .clone()
        .or(phone.display_phone_number.clone())
        .or(phone.waba_name.clone())
        .unwrap_or_else(|| "WhatsApp Business".into());

    let account = SocialAccountsService::connect_account(
        &state,
        ConnectSocialAccountDto {
            tenant_id: setup.tenant_id,
            workspace_id: setup.workspace_id,
            user_id: Some(setup.user_id),
            platform: "whatsapp".into(),
            account_name,
            external_id: Some(phone.id.clone()),
            username: phone.display_phone_number.clone(),
            access_token: setup.access_token,
            refresh_token: None,
            expires_at: setup
                .expires_at
                .as_ref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok()),
            connected: Some(true),
            metadata: Some(json!({
                "phone_number_id": phone.id,
                "display_phone_number": phone.display_phone_number,
                "verified_name": phone.verified_name,
                "waba_id": phone.waba_id,
                "waba_name": phone.waba_name,
            })),
        },
    )
    .await?;

    Ok(Json(account))
}

async fn disconnect(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let account = SocialAccountsService::disconnect(&state, id, user_id, query.tenant_id).await?;
    Ok(Json(account))
}

async fn remove(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    SocialAccountsService::remove(&state, id, user_id, query.tenant_id).await?;
    Ok(Json(json!({ "success": true })))
}

fn redirect_with_query(base: &str, key: &str, value: &str) -> Response {
    let separator = if base.contains('?') { '&' } else { '?' };
    let url = format!("{base}{separator}{key}={}", urlencoding::encode(value));
    Redirect::temporary(&url).into_response()
}

fn redirect_to_return_url(return_url: &str, key: &str, value: &str) -> Response {
    redirect_with_query(return_url, key, value)
}
