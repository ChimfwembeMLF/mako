pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use sea_orm::{ActiveModelTrait, EntityTrait, Set};
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::payment_failures::dto::{CreatePaymentFailureDto, UpdatePaymentFailureDto};
use crate::modules::payment_failures::entity::{
    ActiveModel as FailureActiveModel, Entity as FailureEntity, Model as FailureModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreatePaymentFailureDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let row = FailureActiveModel {
        id: Set(Uuid::new_v4()),
        deposit_id: Set(payload.deposit_id),
        tenant_id: Set(payload.tenant_id),
        provider: Set(payload.provider),
        reason: Set(payload.reason),
        raw_payload: Set(payload.raw_payload),
        created_at: Set(payload.created_at),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(failure_json(&row)))
}

async fn find_all(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let rows = FailureEntity::find().all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(failure_json)
        .collect::<Vec<_>>())))
}

async fn find_one(State(state): State<AppState>, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    let row = FailureEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("PaymentFailures not found".into()))?;

    Ok(Json(failure_json(&row)))
}

async fn update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePaymentFailureDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let row = FailureEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("PaymentFailures not found".into()))?;

    let mut active: FailureActiveModel = row.into();

    if let Some(deposit_id) = payload.deposit_id {
        active.deposit_id = Set(deposit_id);
    }
    if let Some(tenant_id) = payload.tenant_id {
        active.tenant_id = Set(tenant_id);
    }
    if let Some(provider) = payload.provider {
        active.provider = Set(Some(provider));
    }
    if let Some(reason) = payload.reason {
        active.reason = Set(Some(reason));
    }
    if let Some(raw_payload) = payload.raw_payload {
        active.raw_payload = Set(Some(raw_payload));
    }
    if let Some(created_at) = payload.created_at {
        active.created_at = Set(created_at);
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(failure_json(&updated)))
}

async fn remove(State(state): State<AppState>, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    let result = FailureEntity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("PaymentFailures not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

fn failure_json(row: &FailureModel) -> Value {
    json!({
        "id": row.id,
        "depositId": row.deposit_id,
        "tenantId": row.tenant_id,
        "provider": row.provider,
        "reason": row.reason,
        "rawPayload": row.raw_payload,
        "created_at": row.created_at,
    })
}
