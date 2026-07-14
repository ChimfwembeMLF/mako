pub mod dto;
pub mod entity;
pub mod service;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder, Set,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::audit_logs::dto::{CreateAuditLogDto, UpdateAuditLogDto};
use crate::modules::audit_logs::entity::{
    ActiveModel as AuditLogActiveModel, Column as AuditLogColumn, Entity as AuditLogEntity,
    Model as AuditLogModel,
};

const NIL_UUID: &str = "00000000-0000-0000-0000-000000000000";

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct AuditLogListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
    search: Option<String>,
    module: Option<String>,
    page: Option<u64>,
    take: Option<u64>,
}

async fn create(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateAuditLogDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let nil_uuid = Uuid::parse_str(NIL_UUID).unwrap();
    let log = AuditLogActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(Some(payload.tenant_id)),
        user_id: Set(Some(payload.user_id.unwrap_or(user_id))),
        action: Set(payload.action),
        resource_type: Set(payload.resource_type.unwrap_or_else(|| "".into())),
        resource_id: Set(Some(payload.resource_id.unwrap_or(nil_uuid))),
        before_state: Set(payload.before_state.map(Into::into)),
        after_state: Set(payload.after_state.map(Into::into)),
        metadata: Set(payload.metadata.map(Into::into)),
        ip_address: Set(payload.ip_address),
        user_agent: Set(payload.user_agent),
        created_at: Set(payload
            .created_at
            .unwrap_or_else(|| chrono::Utc::now().fixed_offset())),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(audit_log_json(&log)))
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<AuditLogListQuery>,
) -> ApiResult<Json<Value>> {
    if let Some(tenant_id) = query.tenant_id {
        let page = query.page.unwrap_or(0);
        let take = query.take.unwrap_or(25);

        let mut db_query = AuditLogEntity::find()
            .filter(AuditLogColumn::TenantId.eq(tenant_id))
            .order_by_desc(AuditLogColumn::CreatedAt);

        if let Some(search) = query.search.as_ref().and_then(|s| {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }) {
            db_query = db_query.filter(AuditLogColumn::Action.contains(search));
        }

        if let Some(module) = query.module.as_ref().filter(|m| *m != "all") {
            if module == "http" {
                db_query = db_query.filter(AuditLogColumn::Action.starts_with("http."));
            } else {
                db_query =
                    db_query.filter(AuditLogColumn::Action.starts_with(format!("{module}.")));
            }
        }

        let paginator = db_query.paginate(&state.db, take);
        let total = paginator.num_items().await?;
        let rows = paginator.fetch_page(page).await?;

        let nil_uuid = Uuid::parse_str(NIL_UUID).unwrap();
        let items: Vec<Value> = rows
            .iter()
            .map(|log| audit_log_filtered_json(log, nil_uuid))
            .collect();

        return Ok(Json(json!({ "items": items, "total": total })));
    }

    let rows = AuditLogEntity::find().all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(audit_log_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let log = AuditLogEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("AuditLogs not found".into()))?;

    Ok(Json(audit_log_json(&log)))
}

async fn update(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAuditLogDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = AuditLogEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("AuditLogs not found".into()))?;

    let mut active: AuditLogActiveModel = existing.into();

    if let Some(tenant_id) = payload.tenant_id {
        active.tenant_id = Set(Some(tenant_id));
    }
    if let Some(user_id) = payload.user_id {
        active.user_id = Set(Some(user_id));
    }
    if let Some(action) = payload.action {
        active.action = Set(action);
    }
    if let Some(resource_type) = payload.resource_type {
        active.resource_type = Set(resource_type);
    }
    if let Some(resource_id) = payload.resource_id {
        active.resource_id = Set(Some(resource_id));
    }
    if let Some(before_state) = payload.before_state {
        active.before_state = Set(Some(before_state.into()));
    }
    if let Some(after_state) = payload.after_state {
        active.after_state = Set(Some(after_state.into()));
    }
    if let Some(metadata) = payload.metadata {
        active.metadata = Set(Some(metadata.into()));
    }
    if let Some(ip_address) = payload.ip_address {
        active.ip_address = Set(Some(ip_address));
    }
    if let Some(user_agent) = payload.user_agent {
        active.user_agent = Set(Some(user_agent));
    }
    if let Some(created_at) = payload.created_at {
        active.created_at = Set(created_at);
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(audit_log_json(&updated)))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let result = AuditLogEntity::delete_by_id(id).exec(&state.db).await?;

    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("AuditLogs not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

fn audit_log_json(log: &AuditLogModel) -> Value {
    json!({
        "id": log.id,
        "tenantId": log.tenant_id,
        "userId": log.user_id,
        "action": log.action,
        "resourceType": log.resource_type,
        "resourceId": log.resource_id,
        "beforeState": log.before_state,
        "afterState": log.after_state,
        "metadata": log.metadata,
        "ipAddress": log.ip_address,
        "userAgent": log.user_agent,
        "created_at": log.created_at,
    })
}

fn audit_log_filtered_json(log: &AuditLogModel, nil_uuid: Uuid) -> Value {
    json!({
        "id": log.id,
        "action": log.action,
        "resource_type": if log.resource_type.is_empty() { Value::Null } else { json!(log.resource_type) },
        "resource_id": if log.resource_id == Some(nil_uuid) { Value::Null } else { json!(log.resource_id) },
        "before_state": log.before_state,
        "after_state": log.after_state,
        "metadata": log.metadata,
        "ip_address": log.ip_address,
        "user_agent": log.user_agent,
        "created_at": log.created_at,
        "profiles": Value::Null,
    })
}
