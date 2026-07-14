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
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::lead_sources::dto::{CreateLeadSourceDto, UpdateLeadSourceDto};
use crate::modules::lead_sources::entity::{
    ActiveModel as SourceActiveModel, Entity as SourceEntity, Model as SourceModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

fn random_webhook_secret() -> String {
    let mut bytes = [0u8; 24];
    getrandom::fill(&mut bytes).expect("failed to generate webhook secret");
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

async fn create(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateLeadSourceDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let webhook_secret = payload
        .webhook_secret
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(random_webhook_secret);

    let source = SourceActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        user_id: Set(payload.user_id),
        label: Set(payload.label),
        webhook_secret: Set(Some(webhook_secret)),
        created_at: Set(chrono::Utc::now().fixed_offset()),
    }
    .insert(&state.db)
    .await?;

    Ok(Json(source_json(&source)))
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let rows = SourceEntity::find().all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(source_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(source_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let source = SourceEntity::find_by_id(source_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("LeadSources not found".into()))?;

    Ok(Json(source_json(&source)))
}

async fn update(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(source_id): Path<Uuid>,
    Json(payload): Json<UpdateLeadSourceDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let source = SourceEntity::find_by_id(source_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("LeadSources not found".into()))?;

    let mut active: SourceActiveModel = source.into();

    if let Some(tenant_id) = payload.tenant_id {
        active.tenant_id = Set(tenant_id);
    }
    if let Some(user_id) = payload.user_id {
        active.user_id = Set(user_id);
    }
    if let Some(label) = payload.label {
        active.label = Set(label);
    }
    if let Some(webhook_secret) = payload.webhook_secret {
        active.webhook_secret = Set(Some(webhook_secret));
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(source_json(&updated)))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(source_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let result = SourceEntity::delete_by_id(source_id)
        .exec(&state.db)
        .await?;

    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("LeadSources not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

fn source_json(source: &SourceModel) -> Value {
    json!({
        "id": source.id,
        "tenantId": source.tenant_id,
        "userId": source.user_id,
        "label": source.label,
        "webhookSecret": source.webhook_secret,
        "created_at": source.created_at,
    })
}
