pub mod entity;
pub mod invoice;
pub mod service;
pub mod subscription_renewal;

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::services::pawapay::PawaPayService;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/deposits/initiate", post(initiate))
        .route("/ads-deposit", post(initiate_ads))
        .route("/webhooks/deposit", post(webhook))
        .route("/deposits/check-pending", post(check_pending))
        .route("/deposits/tenant/{tenant_id}", get(list_by_tenant))
        .route("/deposits/{deposit_id}/check", post(check_one))
        .route("/deposits/{deposit_id}/invoice", get(invoice))
        .route(
            "/deposits/{deposit_id}/refund-request",
            post(refund_request),
        )
}

#[derive(Deserialize, Validate)]
struct InitiateDepositDto {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    plan: String,
    phone: Option<String>,
    correspondent: Option<String>,
}

#[derive(Deserialize, Validate)]
struct InitiateAdsDepositDto {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    amount: f64,
    phone: Option<String>,
    correspondent: Option<String>,
}

#[derive(Deserialize)]
struct WebhookDto {
    #[serde(rename = "depositId")]
    deposit_id: Option<String>,
    status: Option<String>,
}

#[derive(Deserialize)]
struct InvoiceQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
}

#[derive(Deserialize, Validate)]
struct RefundRequestDto {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    reason: String,
}

async fn initiate(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<InitiateDepositDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(Json(
        service::initiate_deposit(
            &state,
            payload.tenant_id,
            &payload.plan,
            payload.phone,
            payload.correspondent,
            false,
        )
        .await?,
    ))
}

async fn initiate_ads(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<InitiateAdsDepositDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    service::assert_tenant_access(&state, id, payload.tenant_id).await?;
    Ok(Json(
        service::initiate_ads_deposit(
            &state,
            payload.tenant_id,
            payload.amount,
            payload.phone,
            payload.correspondent,
        )
        .await?,
    ))
}

async fn webhook(
    State(state): State<AppState>,
    Json(payload): Json<WebhookDto>,
) -> ApiResult<Json<Value>> {
    let pawapay = PawaPayService::new(state.config.pawapay.clone());
    if pawapay.supports_webhook_signing() {
        tracing::debug!(
            key_id = %pawapay.webhook_signing_key_id(),
            has_private_key = !pawapay.webhook_private_key().is_empty(),
            "PawaPay webhook signing configured"
        );
    }
    if payload.status.as_deref() == Some("COMPLETED") {
        if let Some(deposit_id) = payload.deposit_id {
            return Ok(Json(service::complete_deposit(&state, &deposit_id).await?));
        }
    }
    Ok(Json(json!({ "received": true })))
}

async fn check_pending(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    Ok(Json(service::check_pending_deposits(&state).await?))
}

async fn check_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(deposit_id): Path<String>,
) -> ApiResult<Json<Value>> {
    Ok(Json(
        service::check_deposit_status(&state, &deposit_id).await?,
    ))
}

async fn list_by_tenant(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    Ok(Json(service::find_by_tenant(&state, tenant_id, id).await?))
}

async fn invoice(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(deposit_id): Path<String>,
    Query(query): Query<InvoiceQuery>,
) -> ApiResult<impl IntoResponse> {
    let (status, headers, body) =
        service::generate_invoice_response(&state, &deposit_id, query.tenant_id, id).await?;
    Ok((status, headers, body))
}

async fn refund_request(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(deposit_id): Path<String>,
    Json(payload): Json<RefundRequestDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(Json(
        service::request_refund(&state, payload.tenant_id, &deposit_id, &payload.reason, id)
            .await?,
    ))
}
