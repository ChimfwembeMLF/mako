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
use crate::modules::approval_requests::dto::{CreateApprovalRequestDto, UpdateApprovalRequestDto};
use crate::modules::approval_requests::entity::{
    ActiveModel as RequestActiveModel, Column as RequestColumn, Entity as RequestEntity,
    Model as RequestModel,
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
    status: Option<String>,
    statuses: Option<String>,
}

async fn create(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateApprovalRequestDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let request = RequestActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        action_key: Set(payload.action_key),
        resource_type: Set(payload.resource_type),
        resource_id: Set(payload.resource_id),
        payload: Set(payload.payload),
        requested_by: Set(payload.requested_by),
        reviewed_by: Set(payload.reviewed_by),
        status: Set(payload.status),
        requester_notes: Set(payload.requester_notes),
        reviewer_notes: Set(payload.reviewer_notes),
        created_at: Set(payload
            .created_at
            .unwrap_or_else(|| Utc::now().fixed_offset())),
        reviewed_at: Set(payload.reviewed_at),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(request_json(&request)))
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = RequestEntity::find().order_by_desc(RequestColumn::CreatedAt);

    if let Some(tenant_id) = query.tenant_id {
        db_query = db_query.filter(RequestColumn::TenantId.eq(tenant_id));
        if let Some(status) = query.status {
            db_query = db_query.filter(RequestColumn::Status.eq(status));
        } else if let Some(statuses) = query.statuses {
            let list: Vec<String> = statuses
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            if !list.is_empty() {
                db_query = db_query.filter(RequestColumn::Status.is_in(list));
            }
        }
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(request_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let request = RequestEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Approval request not found".into()))?;

    Ok(Json(request_json(&request)))
}

async fn update(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateApprovalRequestDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = RequestEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Approval request not found".into()))?;

    let mut active: RequestActiveModel = existing.into();
    if let Some(v) = payload.action_key {
        active.action_key = Set(v);
    }
    if let Some(v) = payload.resource_type {
        active.resource_type = Set(v);
    }
    if let Some(v) = payload.resource_id {
        active.resource_id = Set(v);
    }
    if let Some(v) = payload.payload {
        active.payload = Set(Some(v));
    }
    if let Some(v) = payload.reviewed_by {
        active.reviewed_by = Set(Some(v));
    }
    if let Some(v) = payload.status {
        active.status = Set(v);
    }
    if let Some(v) = payload.requester_notes {
        active.requester_notes = Set(Some(v));
    }
    if let Some(v) = payload.reviewer_notes {
        active.reviewer_notes = Set(Some(v));
    }
    if let Some(v) = payload.reviewed_at {
        active.reviewed_at = Set(Some(v));
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(request_json(&updated)))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let result = RequestEntity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("Approval request not found".into()));
    }
    Ok(Json(json!({ "success": true })))
}

fn request_json(r: &RequestModel) -> Value {
    json!({
        "id": r.id,
        "tenantId": r.tenant_id,
        "actionKey": r.action_key,
        "resourceType": r.resource_type,
        "resourceId": r.resource_id,
        "payload": r.payload,
        "requestedBy": r.requested_by,
        "reviewedBy": r.reviewed_by,
        "status": r.status,
        "requesterNotes": r.requester_notes,
        "reviewerNotes": r.reviewer_notes,
        "created_at": r.created_at,
        "reviewedAt": r.reviewed_at,
    })
}
