pub mod constants;
pub mod definitions;
pub mod seed;
pub mod service;

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;

use self::service::{EffectivePermissions, RbacService};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/roles/check/{tenant_id}/{user_id}", get(check_roles))
        .route(
            "/permissions/check/{tenant_id}/{user_id}",
            get(check_permission),
        )
        .route(
            "/effective-permissions/{tenant_id}/{user_id}",
            get(effective_permissions),
        )
}

#[derive(Deserialize)]
struct RolesQuery {
    roles: Option<String>,
}

#[derive(Deserialize)]
struct PermissionQuery {
    permission: Option<String>,
}

async fn check_roles(
    State(state): State<AppState>,
    Path((tenant_id, user_id)): Path<(Uuid, Uuid)>,
    Query(query): Query<RolesQuery>,
) -> ApiResult<Json<Value>> {
    let required: Vec<String> = query
        .roles
        .as_deref()
        .map(|s| {
            s.split(',')
                .map(str::trim)
                .filter(|r| !r.is_empty())
                .map(String::from)
                .collect()
        })
        .unwrap_or_default();

    let has_role = RbacService::has_roles(&state, user_id, tenant_id, &required).await?;
    Ok(Json(json!({ "success": true, "hasRole": has_role })))
}

async fn check_permission(
    State(state): State<AppState>,
    Path((tenant_id, user_id)): Path<(Uuid, Uuid)>,
    Query(query): Query<PermissionQuery>,
) -> ApiResult<Json<Value>> {
    let permission = query.permission.unwrap_or_default();
    let has_permission =
        RbacService::has_permission(&state, user_id, tenant_id, &permission).await?;
    Ok(Json(
        json!({ "success": true, "hasPermission": has_permission }),
    ))
}

async fn effective_permissions(
    State(state): State<AppState>,
    Path((tenant_id, user_id)): Path<(Uuid, Uuid)>,
) -> ApiResult<Json<EffectivePermissions>> {
    let result = RbacService::get_effective_permissions(&state, user_id, tenant_id).await?;
    Ok(Json(result))
}
