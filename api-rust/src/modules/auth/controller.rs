use axum::http::StatusCode;
use axum::{
    extract::{Query, State},
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
    Json, Router,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::mail::MailService;
use crate::modules::refresh_tokens::RefreshTokenService;
use crate::modules::tenants::bootstrap::TenantBootstrapService;
use crate::modules::users::entity::{
    ActiveModel as UserActiveModel, Column as UserColumn, Entity as UserEntity,
};
use crate::modules::users::service::UsersService;

use super::dto::{
    ForgotPasswordDto, LoginDto, OAuthCallbackQuery, OAuthStateQuery, RefreshTokenDto, RegisterDto,
    ResetPasswordDto, TokenVerificationDto,
};
use super::oauth::{
    FacebookAuthService, GoogleAuthService, InstagramAuthService, LinkedInAuthService,
};
use super::service::AuthService;
use super::session::{complete_authentication, user_json};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login))
        .route("/register", post(register))
        .route("/forgot-password", post(forgot_password))
        .route("/reset-password", post(reset_password))
        .route("/refresh", post(refresh))
        .route("/logout", post(logout))
        .route("/me", get(me))
        .route("/google", get(google_auth))
        .route("/google/redirect", get(google_redirect))
        .route("/google-auth", post(google_authenticate))
        .route("/facebook", get(facebook_auth))
        .route("/facebook/redirect", get(facebook_redirect))
        .route("/facebook-auth", post(facebook_authenticate))
        .route("/linkedin", get(linkedin_auth))
        .route("/linkedin/redirect", get(linkedin_redirect))
        .route("/linkedin-auth", post(linkedin_authenticate))
        .route("/instagram", get(instagram_auth))
        .route("/instagram/redirect", get(instagram_redirect))
        .route("/instagram-auth", post(instagram_authenticate))
}

async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let user = UserEntity::find()
        .filter(UserColumn::Email.eq(payload.email.clone()))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::Unauthorized("Invalid credentials".into()))?;

    if user.provider != "local" || user.password.is_none() {
        return Err(ApiError::Unauthorized(
            "Please login using social login".into(),
        ));
    }

    let hash = user.password.as_ref().unwrap();
    if !AuthService::verify_password(&payload.password, hash)? {
        return Err(ApiError::Unauthorized("Invalid credentials".into()));
    }

    Ok(Json(complete_authentication(&state, user).await?))
}

async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    if UserEntity::find()
        .filter(UserColumn::Email.eq(payload.email.clone()))
        .one(&state.db)
        .await?
        .is_some()
    {
        return Err(ApiError::Conflict("Email already registered".into()));
    }

    let hashed = AuthService::hash_password(&payload.password)?;
    let now = chrono::Utc::now().fixed_offset();

    let user = UserActiveModel {
        id: Set(Uuid::new_v4()),
        email: Set(Some(payload.email)),
        password: Set(Some(hashed)),
        first_name: Set(payload.first_name),
        last_name: Set(payload.last_name),
        role: Set("USER".to_string()),
        provider: Set("local".to_string()),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(complete_authentication(&state, user).await?))
}

async fn forgot_password(
    State(state): State<AppState>,
    Json(payload): Json<ForgotPasswordDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let user = UsersService::find_by_email(&state, &payload.email)
        .await?
        .ok_or_else(|| ApiError::NotFound("User not found".into()))?;

    if user.provider != "local" {
        return Err(ApiError::BadRequest(
            "Please use social login to access your account".into(),
        ));
    }

    let reset_token = AuthService::reset_token(&state, user.id)?;
    let reset_link = format!(
        "{}/reset-password?token={}",
        state.config.oauth.frontend_url,
        urlencoding::encode(&reset_token)
    );

    if let Some(email) = user.email.as_deref() {
        MailService::send_password_reset_email(&state, email, &reset_link).await?;
    }

    Ok(Json(json!({
        "message": "If your email is registered, you will receive a password reset link."
    })))
}

async fn reset_password(
    State(state): State<AppState>,
    Json(payload): Json<ResetPasswordDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let claims = AuthService::verify_claims(&state, &payload.token)
        .map_err(|_| ApiError::BadRequest("Invalid or expired reset token".into()))?;

    if claims.token_type.as_deref() != Some("reset") {
        return Err(ApiError::BadRequest(
            "Invalid or expired reset token".into(),
        ));
    }

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::BadRequest("Invalid or expired reset token".into()))?;

    let user = UsersService::find_by_id(&state, user_id)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Invalid reset request".into()))?;

    if user.provider != "local" {
        return Err(ApiError::BadRequest("Invalid reset request".into()));
    }

    let hashed = AuthService::hash_password(&payload.new_password)?;
    UsersService::update_password(&state, user.id, hashed).await?;
    RefreshTokenService::revoke(&state, user.id).await?;

    Ok(Json(json!({
        "message": "Password successfully reset. You can now log in with your new password."
    })))
}

async fn refresh(
    State(state): State<AppState>,
    Json(payload): Json<RefreshTokenDto>,
) -> ApiResult<Json<Value>> {
    let claims = AuthService::verify_claims(&state, &payload.refresh_token)
        .map_err(|_| ApiError::Unauthorized("Invalid refresh token".into()))?;

    if claims.token_type.as_deref() != Some("refresh") {
        return Err(ApiError::Unauthorized("Invalid refresh token type".into()));
    }

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::Unauthorized("Invalid refresh token".into()))?;

    let valid = RefreshTokenService::is_valid(&state, user_id, &payload.refresh_token).await?;
    if !valid {
        return Err(ApiError::Unauthorized("Refresh token revoked".into()));
    }

    let provider = claims.provider.as_deref().unwrap_or("local");
    let access_token = AuthService::access_token(&state, user_id, provider)?;
    Ok(Json(json!({ "accessToken": access_token })))
}

async fn logout(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
) -> ApiResult<StatusCode> {
    RefreshTokenService::revoke(&state, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn me(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let user = UsersService::find_by_id(&state, id)
        .await?
        .ok_or_else(|| ApiError::Unauthorized("User not found".into()))?;

    let tenant = TenantBootstrapService::bootstrap_for_user(&state, &user).await?;
    Ok(Json(json!({
        "user": user_json(&user, ""),
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "logoUrl": tenant.logo_url,
        }
    })))
}

async fn google_auth(
    State(state): State<AppState>,
    Query(query): Query<OAuthStateQuery>,
) -> Redirect {
    Redirect::temporary(&GoogleAuthService::authorization_url(
        &state,
        query.state.as_deref(),
    ))
}

async fn google_redirect(
    State(state): State<AppState>,
    Query(query): Query<OAuthCallbackQuery>,
) -> Response {
    if let Some(error) = query.error {
        let message = query.error_description.unwrap_or(error);
        return oauth_error_redirect(&state, &message);
    }
    let Some(code) = query.code else {
        return oauth_error_redirect(&state, "Missing authorization code");
    };

    let token_result: ApiResult<String> = async {
        let token_response = GoogleAuthService::exchange_code(&state, &code).await?;
        let expires_at = token_response
            .expires_in
            .map(|secs| chrono::Utc::now() + chrono::Duration::seconds(secs));
        let user = GoogleAuthService::authenticate(
            &state,
            &token_response.access_token,
            Some(super::oauth::google::GoogleOAuthTokens {
                access_token: token_response.access_token.clone(),
                refresh_token: token_response.refresh_token,
                expires_at,
            }),
        )
        .await?;
        let tokens = complete_authentication(&state, user).await?;
        Ok(tokens["token"].as_str().unwrap_or_default().to_string())
    }
    .await;

    match token_result {
        Ok(token) => oauth_success_redirect(&state, &token),
        Err(err) => oauth_error_redirect(&state, &err.to_string()),
    }
}

async fn google_authenticate(
    State(state): State<AppState>,
    Json(payload): Json<TokenVerificationDto>,
) -> ApiResult<Json<Value>> {
    let user = GoogleAuthService::authenticate(
        &state,
        &payload.token,
        Some(super::oauth::google::GoogleOAuthTokens {
            access_token: payload.token.clone(),
            refresh_token: payload.refresh_token,
            expires_at: Some(chrono::Utc::now() + chrono::Duration::minutes(55)),
        }),
    )
    .await?;
    Ok(Json(complete_authentication(&state, user).await?))
}

async fn facebook_auth(
    State(state): State<AppState>,
    Query(query): Query<OAuthStateQuery>,
) -> Redirect {
    Redirect::temporary(&FacebookAuthService::authorization_url(
        &state,
        query.state.as_deref(),
    ))
}

async fn facebook_redirect(
    State(state): State<AppState>,
    Query(query): Query<OAuthCallbackQuery>,
) -> Result<Response, ApiError> {
    if let Some(error) = query.error {
        let message = query.error_description.unwrap_or(error);
        return Ok(oauth_error_redirect(&state, &message));
    }
    let code = query
        .code
        .ok_or_else(|| ApiError::BadRequest("Missing authorization code".into()))?;

    let access_token = FacebookAuthService::exchange_code(&state, &code).await?;
    let user = FacebookAuthService::authenticate(&state, &access_token).await?;
    let tokens = complete_authentication(&state, user).await?;
    let token = tokens["token"].as_str().unwrap_or_default();
    Ok(oauth_success_redirect(&state, token))
}

async fn facebook_authenticate(
    State(state): State<AppState>,
    Json(payload): Json<TokenVerificationDto>,
) -> ApiResult<Json<Value>> {
    let user = FacebookAuthService::authenticate(&state, &payload.token).await?;
    Ok(Json(complete_authentication(&state, user).await?))
}

async fn linkedin_auth(
    State(state): State<AppState>,
    Query(query): Query<OAuthStateQuery>,
) -> Redirect {
    Redirect::temporary(&LinkedInAuthService::authorization_url(
        &state,
        query.state.as_deref(),
    ))
}

async fn linkedin_redirect(
    State(state): State<AppState>,
    Query(query): Query<OAuthCallbackQuery>,
) -> Result<Response, ApiError> {
    if let Some(error) = query.error {
        let message = query.error_description.unwrap_or(error);
        return Ok(oauth_error_redirect(&state, &message));
    }
    let code = query
        .code
        .ok_or_else(|| ApiError::BadRequest("Missing authorization code".into()))?;

    let access_token = LinkedInAuthService::exchange_code_for_tokens(&state, &code).await?;
    let user = LinkedInAuthService::authenticate(&state, &access_token).await?;
    let tokens = complete_authentication(&state, user).await?;
    let token = tokens["token"].as_str().unwrap_or_default();
    Ok(oauth_success_redirect(&state, token))
}

async fn linkedin_authenticate(
    State(state): State<AppState>,
    Json(payload): Json<TokenVerificationDto>,
) -> ApiResult<Json<Value>> {
    let user = LinkedInAuthService::authenticate(&state, &payload.token).await?;
    Ok(Json(complete_authentication(&state, user).await?))
}

async fn instagram_auth(
    State(state): State<AppState>,
    Query(query): Query<OAuthStateQuery>,
) -> Redirect {
    Redirect::temporary(&InstagramAuthService::authorization_url(
        &state,
        query.state.as_deref(),
    ))
}

async fn instagram_redirect(
    State(state): State<AppState>,
    Query(query): Query<OAuthCallbackQuery>,
) -> Result<Response, ApiError> {
    if let Some(error) = query.error {
        let message = query.error_description.unwrap_or(error);
        return Ok(oauth_error_redirect(&state, &message));
    }
    let code = query
        .code
        .ok_or_else(|| ApiError::BadRequest("Missing authorization code".into()))?;

    let (access_token, user_id) =
        InstagramAuthService::exchange_code_for_tokens(&state, &code).await?;
    let user =
        InstagramAuthService::authenticate(&state, &access_token, user_id.as_deref()).await?;
    let tokens = complete_authentication(&state, user).await?;
    let token = tokens["token"].as_str().unwrap_or_default();
    Ok(oauth_success_redirect(&state, token))
}

async fn instagram_authenticate(
    State(state): State<AppState>,
    Json(payload): Json<TokenVerificationDto>,
) -> ApiResult<Json<Value>> {
    let user = InstagramAuthService::authenticate(&state, &payload.token, None).await?;
    Ok(Json(complete_authentication(&state, user).await?))
}

fn oauth_success_redirect(state: &AppState, token: &str) -> Response {
    let url = format!(
        "{}/auth/callback?token={}",
        state.config.oauth.frontend_url,
        urlencoding::encode(token)
    );
    Redirect::temporary(&url).into_response()
}

fn oauth_error_redirect(state: &AppState, message: &str) -> Response {
    let url = format!(
        "{}/auth/callback?error={}",
        state.config.oauth.frontend_url,
        urlencoding::encode(message)
    );
    Redirect::temporary(&url).into_response()
}
