pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::approval_workflows::dto::{
    CreateApprovalWorkflowDto, UpdateApprovalWorkflowDto,
};
use crate::modules::approval_workflows::entity::{
    ActiveModel as WorkflowActiveModel, Column as WorkflowColumn, Entity as WorkflowEntity,
    Model as WorkflowModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
}

async fn create(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateApprovalWorkflowDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let workflow = WorkflowActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        action_key: Set(payload.action_key),
        label: Set(payload.label),
        description: Set(payload.description),
        is_enabled: Set(payload.is_enabled),
        approver_role_id: Set(payload.approver_role_id),
        updated_by: Set(payload.updated_by),
        updated_at: Set(payload
            .updated_at
            .unwrap_or_else(|| Utc::now().fixed_offset())),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(workflow_json(&workflow)))
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = WorkflowEntity::find().order_by_asc(WorkflowColumn::ActionKey);
    if let Some(tenant_id) = query.tenant_id {
        db_query = db_query.filter(WorkflowColumn::TenantId.eq(tenant_id));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(workflow_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let workflow = WorkflowEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Approval workflow not found".into()))?;

    Ok(Json(workflow_json(&workflow)))
}

async fn update(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateApprovalWorkflowDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = WorkflowEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Approval workflow not found".into()))?;

    let mut active: WorkflowActiveModel = existing.into();
    if let Some(v) = payload.label {
        active.label = Set(v);
    }
    if let Some(v) = payload.description {
        active.description = Set(Some(v));
    }
    if let Some(v) = payload.is_enabled {
        active.is_enabled = Set(v);
    }
    if let Some(v) = payload.approver_role_id {
        active.approver_role_id = Set(v);
    }
    if let Some(v) = payload.updated_by {
        active.updated_by = Set(v);
    }
    active.updated_at = Set(payload
        .updated_at
        .unwrap_or_else(|| Utc::now().fixed_offset()));

    let updated = active.update(&state.db).await?;
    Ok(Json(workflow_json(&updated)))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let result = WorkflowEntity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("Approval workflow not found".into()));
    }
    Ok(Json(json!({ "success": true })))
}

fn workflow_json(w: &WorkflowModel) -> Value {
    json!({
        "id": w.id,
        "tenantId": w.tenant_id,
        "actionKey": w.action_key,
        "label": w.label,
        "description": w.description,
        "isEnabled": w.is_enabled,
        "approverRoleId": w.approver_role_id,
        "updatedBy": w.updated_by,
        "updated_at": w.updated_at,
    })
}
