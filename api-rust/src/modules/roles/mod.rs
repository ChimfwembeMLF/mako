pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::roles::dto::{CreateRoleDto, UpdateRoleDto};
use crate::modules::roles::entity::{
    ActiveModel as RoleActiveModel, Column as RoleColumn, Entity as RoleEntity, Model as RoleModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct RoleQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
}

async fn create(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateRoleDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let role = RoleActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        name: Set(payload.name),
        description: Set(payload.description),
        is_system: Set(payload.is_system),
        created_at: Set(payload.created_at),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(json!(role_json(&role))))
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<RoleQuery>,
) -> ApiResult<Json<Value>> {
    let mut finder = RoleEntity::find()
        .order_by_desc(RoleColumn::IsSystem)
        .order_by_asc(RoleColumn::Name);

    if let Some(tenant_id) = query.tenant_id {
        finder = finder.filter(RoleColumn::TenantId.eq(tenant_id));
    }

    let rows = finder.all(&state.db).await?;
    Ok(Json(json!(rows.iter().map(role_json).collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let role = RoleEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Roles not found".into()))?;

    Ok(Json(json!(role_json(&role))))
}

async fn update(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRoleDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let role = RoleEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Roles not found".into()))?;

    let mut active: RoleActiveModel = role.into();

    if let Some(tenant_id) = payload.tenant_id {
        active.tenant_id = Set(tenant_id);
    }
    if let Some(name) = payload.name {
        active.name = Set(name);
    }
    if let Some(description) = payload.description {
        active.description = Set(Some(description));
    }
    if let Some(is_system) = payload.is_system {
        active.is_system = Set(Some(is_system));
    }
    if let Some(created_at) = payload.created_at {
        active.created_at = Set(created_at);
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(json!(role_json(&updated))))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let role = RoleEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Roles not found".into()))?;

    if role.is_system.unwrap_or(false) {
        return Err(ApiError::BadRequest("Cannot delete system roles".into()));
    }

    let result = RoleEntity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("Roles not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

fn role_json(role: &RoleModel) -> Value {
    json!({
        "id": role.id,
        "tenantId": role.tenant_id,
        "name": role.name,
        "description": role.description,
        "isSystem": role.is_system,
        "created_at": role.created_at,
    })
}
