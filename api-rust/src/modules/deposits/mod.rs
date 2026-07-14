pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, EntityTrait, Set};
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::deposits::dto::{CreateDepositDto, UpdateDepositDto};
use crate::modules::deposits::entity::{
    ActiveModel as DepositActiveModel, Entity as DepositEntity, Model as DepositModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreateDepositDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let deposit = DepositActiveModel {
        id: Set(Uuid::new_v4()),
        deposit_id: Set(payload.deposit_id),
        tenant_id: Set(payload.tenant_id),
        plan: Set(payload.plan),
        status: Set(payload.status),
        amount: Set(payload.amount),
        currency: Set(payload.currency),
        correspondent: Set(payload.correspondent),
        msisdn: Set(payload.msisdn),
        phone: Set(payload.phone),
        provider: Set(payload.provider),
        is_renewal: Set(false),
        raw_payload: Set(payload.raw_payload),
        created_at: Set(payload.created_at),
        updated_at: Set(payload.updated_at),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(deposit_json(&deposit)))
}

async fn find_all(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let rows = DepositEntity::find().all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(deposit_json)
        .collect::<Vec<_>>())))
}

async fn find_one(State(state): State<AppState>, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    let deposit = DepositEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Deposits not found".into()))?;

    Ok(Json(deposit_json(&deposit)))
}

async fn update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateDepositDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let deposit = DepositEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Deposits not found".into()))?;

    let mut active: DepositActiveModel = deposit.into();

    if let Some(deposit_id) = payload.deposit_id {
        active.deposit_id = Set(deposit_id);
    }
    if let Some(tenant_id) = payload.tenant_id {
        active.tenant_id = Set(tenant_id);
    }
    if let Some(plan) = payload.plan {
        active.plan = Set(Some(plan));
    }
    if let Some(status) = payload.status {
        active.status = Set(Some(status));
    }
    if let Some(amount) = payload.amount {
        active.amount = Set(Some(amount));
    }
    if let Some(currency) = payload.currency {
        active.currency = Set(Some(currency));
    }
    if let Some(correspondent) = payload.correspondent {
        active.correspondent = Set(Some(correspondent));
    }
    if let Some(msisdn) = payload.msisdn {
        active.msisdn = Set(Some(msisdn));
    }
    if let Some(phone) = payload.phone {
        active.phone = Set(Some(phone));
    }
    if let Some(provider) = payload.provider {
        active.provider = Set(Some(provider));
    }
    if let Some(raw_payload) = payload.raw_payload {
        active.raw_payload = Set(Some(raw_payload));
    }
    if let Some(created_at) = payload.created_at {
        active.created_at = Set(created_at);
    }
    if let Some(updated_at) = payload.updated_at {
        active.updated_at = Set(updated_at);
    } else {
        active.updated_at = Set(Utc::now().fixed_offset());
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(deposit_json(&updated)))
}

async fn remove(State(state): State<AppState>, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    let result = DepositEntity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("Deposits not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

pub fn deposit_json(deposit: &DepositModel) -> Value {
    json!({
        "id": deposit.id,
        "depositId": deposit.deposit_id,
        "tenantId": deposit.tenant_id,
        "plan": deposit.plan,
        "status": deposit.status,
        "amount": deposit.amount.map(|d| d.to_string()),
        "currency": deposit.currency,
        "correspondent": deposit.correspondent,
        "msisdn": deposit.msisdn,
        "phone": deposit.phone,
        "provider": deposit.provider,
        "isRenewal": deposit.is_renewal,
        "rawPayload": deposit.raw_payload,
        "created_at": deposit.created_at,
        "updated_at": deposit.updated_at,
    })
}
