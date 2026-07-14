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
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::user_permissions::dto::{CreateUserPermissionDto, UpdateUserPermissionDto};
use crate::modules::user_permissions::entity::{
    ActiveModel as UserPermissionActiveModel, Column as UserPermissionColumn,
    Entity as UserPermissionEntity, Model as UserPermissionModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct UserPermissionQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
    #[serde(rename = "userId")]
    user_id: Option<Uuid>,
}

async fn create(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateUserPermissionDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let row = UserPermissionActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        user_id: Set(payload.user_id),
        permission_key: Set(payload.permission_key),
        effect: Set(payload.effect),
        valid_from: Set(payload.valid_from),
        valid_until: Set(payload.valid_until),
        granted_by: Set(payload.granted_by),
        reason: Set(payload.reason),
        created_at: Set(payload.created_at),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(json!(user_permission_json(&row))))
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<UserPermissionQuery>,
) -> ApiResult<Json<Value>> {
    let mut finder = UserPermissionEntity::find();

    if let Some(tenant_id) = query.tenant_id {
        finder = finder.filter(UserPermissionColumn::TenantId.eq(tenant_id));
    }
    if let Some(user_id) = query.user_id {
        finder = finder.filter(UserPermissionColumn::UserId.eq(user_id));
    }

    let rows = finder.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(user_permission_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let row = UserPermissionEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("UserPermissions not found".into()))?;

    Ok(Json(json!(user_permission_json(&row))))
}

async fn update(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateUserPermissionDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let row = UserPermissionEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("UserPermissions not found".into()))?;

    let mut active: UserPermissionActiveModel = row.into();

    if let Some(tenant_id) = payload.tenant_id {
        active.tenant_id = Set(tenant_id);
    }
    if let Some(user_id) = payload.user_id {
        active.user_id = Set(user_id);
    }
    if let Some(permission_key) = payload.permission_key {
        active.permission_key = Set(permission_key);
    }
    if let Some(effect) = payload.effect {
        active.effect = Set(effect);
    }
    if let Some(valid_from) = payload.valid_from {
        active.valid_from = Set(Some(valid_from));
    }
    if let Some(valid_until) = payload.valid_until {
        active.valid_until = Set(Some(valid_until));
    }
    if let Some(granted_by) = payload.granted_by {
        active.granted_by = Set(granted_by);
    }
    if let Some(reason) = payload.reason {
        active.reason = Set(Some(reason));
    }
    if let Some(created_at) = payload.created_at {
        active.created_at = Set(created_at);
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(json!(user_permission_json(&updated))))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let result = UserPermissionEntity::delete_by_id(id)
        .exec(&state.db)
        .await?;

    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("UserPermissions not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

fn user_permission_json(row: &UserPermissionModel) -> Value {
    json!({
        "id": row.id,
        "tenantId": row.tenant_id,
        "userId": row.user_id,
        "permissionKey": row.permission_key,
        "effect": row.effect,
        "validFrom": row.valid_from,
        "validUntil": row.valid_until,
        "grantedBy": row.granted_by,
        "reason": row.reason,
        "created_at": row.created_at,
    })
}
