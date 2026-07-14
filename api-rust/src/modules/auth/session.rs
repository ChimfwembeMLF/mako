use serde_json::{json, Value};

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::refresh_tokens::RefreshTokenService;
use crate::modules::tenant_members::TenantMembersService;
use crate::modules::tenants::bootstrap::TenantBootstrapService;
use crate::modules::users::entity::Model as UserModel;

use super::service::AuthService;

pub async fn complete_authentication(state: &AppState, user: UserModel) -> ApiResult<Value> {
    if let Some(email) = user.email.as_deref() {
        let _ = TenantMembersService::accept_pending_invitations(state, user.id, email).await?;
    }

    let tenant = TenantBootstrapService::bootstrap_for_user(state, &user).await?;
    let tokens = issue_tokens_for_user(state, &user).await?;

    Ok(json!({
        "user": tokens["user"],
        "token": tokens["token"],
        "refreshToken": tokens["refreshToken"],
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "logoUrl": tenant.logo_url,
        }
    }))
}

pub async fn issue_tokens_for_user(state: &AppState, user: &UserModel) -> ApiResult<Value> {
    let token = AuthService::access_token(state, user.id, &user.provider)?;
    let refresh_token = AuthService::refresh_token(state, user.id, &user.provider)?;
    RefreshTokenService::save(state, user.id, &refresh_token).await?;

    Ok(json!({
        "user": user_json(user, &token),
        "token": token,
        "refreshToken": refresh_token,
    }))
}

pub fn user_json(user: &UserModel, token: &str) -> Value {
    json!({
        "id": user.id,
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "role": user.role,
        "provider": user.provider,
        "token": token,
    })
}
