pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::role_permissions::dto::{CreateRolePermissionDto, UpdateRolePermissionDto};
use crate::modules::role_permissions::entity::{
    ActiveModel as RolePermissionActiveModel, Column as RolePermissionColumn,
    Entity as RolePermissionEntity, Model as RolePermissionModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{role_id}/{permission_key}", get(find_one).patch(update))
        .route("/{role_id}", axum::routing::delete(remove))
}

async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreateRolePermissionDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let row = RolePermissionActiveModel {
        role_id: Set(payload.role_id),
        permission_key: Set(payload.permission_key),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(json!(role_permission_json(&row))))
}

async fn find_all(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let rows = RolePermissionEntity::find().all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(role_permission_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    State(state): State<AppState>,
    Path((role_id, permission_key)): Path<(Uuid, String)>,
) -> ApiResult<Json<Value>> {
    let row = find_role_permission(&state, role_id, &permission_key).await?;
    Ok(Json(json!(role_permission_json(&row))))
}

async fn update(
    State(state): State<AppState>,
    Path((role_id, permission_key)): Path<(Uuid, String)>,
    Json(payload): Json<UpdateRolePermissionDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = find_role_permission(&state, role_id, &permission_key).await?;

    let new_role_id = payload.role_id.unwrap_or(existing.role_id);
    let new_permission_key = payload
        .permission_key
        .unwrap_or_else(|| existing.permission_key.clone());

    if new_role_id != existing.role_id || new_permission_key != existing.permission_key {
        RolePermissionEntity::delete_many()
            .filter(RolePermissionColumn::RoleId.eq(existing.role_id))
            .filter(RolePermissionColumn::PermissionKey.eq(existing.permission_key.clone()))
            .exec(&state.db)
            .await?;

        let row = RolePermissionActiveModel {
            role_id: Set(new_role_id),
            permission_key: Set(new_permission_key),
            ..Default::default()
        }
        .insert(&state.db)
        .await?;

        return Ok(Json(json!(role_permission_json(&row))));
    }

    Ok(Json(json!(role_permission_json(&existing))))
}

#[derive(Deserialize)]
struct DeleteRolePermissionQuery {
    #[serde(rename = "permissionKey")]
    permission_key: Option<String>,
}

async fn remove(
    State(state): State<AppState>,
    Path(role_id): Path<Uuid>,
    Query(query): Query<DeleteRolePermissionQuery>,
) -> ApiResult<Json<Value>> {
    let permission_key = query
        .permission_key
        .ok_or_else(|| ApiError::BadRequest("permissionKey query param is required".into()))?;

    let result = RolePermissionEntity::delete_many()
        .filter(RolePermissionColumn::RoleId.eq(role_id))
        .filter(RolePermissionColumn::PermissionKey.eq(permission_key))
        .exec(&state.db)
        .await?;

    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("RolePermissions not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

async fn find_role_permission(
    state: &AppState,
    role_id: Uuid,
    permission_key: &str,
) -> ApiResult<RolePermissionModel> {
    RolePermissionEntity::find()
        .filter(RolePermissionColumn::RoleId.eq(role_id))
        .filter(RolePermissionColumn::PermissionKey.eq(permission_key))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("RolePermissions not found".into()))
}

fn role_permission_json(row: &RolePermissionModel) -> Value {
    json!({
        "roleId": row.role_id,
        "permissionKey": row.permission_key,
    })
}
