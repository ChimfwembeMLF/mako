pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use sea_orm::{ActiveModelTrait, EntityTrait, Set};
use serde_json::{json, Value};
use validator::Validate;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::permissions::dto::{CreatePermissionDto, UpdatePermissionDto};
use crate::modules::permissions::entity::{
    ActiveModel as PermissionActiveModel, Entity as PermissionEntity, Model as PermissionModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreatePermissionDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let permission = PermissionActiveModel {
        key: Set(payload.key),
        label: Set(payload.label),
        description: Set(payload.description),
        module: Set(payload.module),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(json!(permission_json(&permission))))
}

async fn find_all(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let rows = PermissionEntity::find().all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(permission_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> ApiResult<Json<Value>> {
    let permission = PermissionEntity::find_by_id(key)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Permissions not found".into()))?;

    Ok(Json(json!(permission_json(&permission))))
}

async fn update(
    State(state): State<AppState>,
    Path(key): Path<String>,
    Json(payload): Json<UpdatePermissionDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let permission = PermissionEntity::find_by_id(key.clone())
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Permissions not found".into()))?;

    let mut active: PermissionActiveModel = permission.into();

    if let Some(label) = payload.label {
        active.label = Set(label);
    }
    if let Some(description) = payload.description {
        active.description = Set(Some(description));
    }
    if let Some(module) = payload.module {
        active.module = Set(Some(module));
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(json!(permission_json(&updated))))
}

async fn remove(State(state): State<AppState>, Path(key): Path<String>) -> ApiResult<Json<Value>> {
    let result = PermissionEntity::delete_by_id(key).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("Permissions not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

fn permission_json(permission: &PermissionModel) -> Value {
    json!({
        "key": permission.key,
        "label": permission.label,
        "description": permission.description,
        "module": permission.module,
    })
}
