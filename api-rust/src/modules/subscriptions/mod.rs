pub mod entity;
pub mod service;

use axum::{
    extract::{Path, State},
    routing::{get, patch},
    Json, Router,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/tenant/{tenant_id}", get(get_for_tenant))
        .route("/tenant/{tenant_id}/auto-renew", patch(set_auto_renew))
}

#[derive(Deserialize, Validate)]
struct AutoRenewDto {
    enabled: bool,
}

async fn get_for_tenant(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    Ok(Json(service::get_summary(&state, tenant_id).await?))
}

async fn set_auto_renew(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
    Json(payload): Json<AutoRenewDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    service::set_auto_renew(&state, tenant_id, payload.enabled).await?;
    Ok(Json(service::get_summary(&state, tenant_id).await?))
}
