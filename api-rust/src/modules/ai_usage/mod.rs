pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, EntityTrait, QueryOrder, Set};
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::ai_usage::dto::{CreateAiUsageDto, UpdateAiUsageDto};
use crate::modules::ai_usage::entity::{
    ActiveModel as AiUsageActiveModel, Column as AiUsageColumn, Entity as AiUsageEntity,
    Model as AiUsageModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreateAiUsageDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let usage = AiUsageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        user_id: Set(payload.user_id),
        function_name: Set(payload.function_name),
        tokens_used: Set(payload.tokens_used),
        created_at: Set(payload
            .created_at
            .unwrap_or_else(|| Utc::now().fixed_offset())),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(ai_usage_json(&usage)))
}

async fn find_all(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let rows = AiUsageEntity::find()
        .order_by_desc(AiUsageColumn::CreatedAt)
        .all(&state.db)
        .await?;

    Ok(Json(json!(rows
        .iter()
        .map(ai_usage_json)
        .collect::<Vec<_>>())))
}

async fn find_one(State(state): State<AppState>, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    let usage = AiUsageEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("AI usage record not found".into()))?;

    Ok(Json(ai_usage_json(&usage)))
}

async fn update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAiUsageDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = AiUsageEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("AI usage record not found".into()))?;

    let mut active: AiUsageActiveModel = existing.into();
    if let Some(v) = payload.function_name {
        active.function_name = Set(v);
    }
    if let Some(v) = payload.tokens_used {
        active.tokens_used = Set(v);
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(ai_usage_json(&updated)))
}

async fn remove(State(state): State<AppState>, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    let result = AiUsageEntity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("AI usage record not found".into()));
    }
    Ok(Json(json!({ "success": true })))
}

fn ai_usage_json(u: &AiUsageModel) -> Value {
    json!({
        "id": u.id,
        "tenantId": u.tenant_id,
        "userId": u.user_id,
        "functionName": u.function_name,
        "tokensUsed": u.tokens_used,
        "created_at": u.created_at,
    })
}
