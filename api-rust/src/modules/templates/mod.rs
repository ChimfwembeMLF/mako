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
use crate::modules::templates::dto::{CreateTemplateDto, UpdateTemplateDto};
use crate::modules::templates::entity::{
    ActiveModel as TemplateActiveModel, Column as TemplateColumn, Entity as TemplateEntity,
    Model as TemplateModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct TemplateListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct TemplateScopedQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

async fn create(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateTemplateDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let now = Utc::now().fixed_offset();
    let template = TemplateActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        workspace_id: Set(payload.workspace_id),
        user_id: Set(payload.user_id.unwrap_or(user_id)),
        name: Set(payload.name),
        description: Set(payload.description),
        content_type: Set(payload.content_type),
        body: Set(payload.body),
        platforms: Set(payload.platforms),
        is_active: Set(payload.is_active.unwrap_or(true)),
        created_at: Set(payload.created_at.unwrap_or(now)),
        updated_at: Set(payload.updated_at.unwrap_or(now)),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(template_json(&template)))
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TemplateListQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = TemplateEntity::find()
        .filter(TemplateColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(TemplateColumn::UpdatedAt);

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(TemplateColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(template_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TemplateScopedQuery>,
) -> ApiResult<Json<Value>> {
    let template = find_scoped(&state, id, query.tenant_id, query.workspace_id).await?;
    Ok(Json(template_json(&template)))
}

async fn update(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TemplateScopedQuery>,
    Json(payload): Json<UpdateTemplateDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = find_scoped(&state, id, query.tenant_id, query.workspace_id).await?;
    let mut active: TemplateActiveModel = existing.into();

    if let Some(tenant_id) = payload.tenant_id {
        active.tenant_id = Set(tenant_id);
    }
    if let Some(workspace_id) = payload.workspace_id {
        active.workspace_id = Set(Some(workspace_id));
    }
    if let Some(user_id) = payload.user_id {
        active.user_id = Set(user_id);
    }
    if let Some(name) = payload.name {
        active.name = Set(name);
    }
    if let Some(description) = payload.description {
        active.description = Set(Some(description));
    }
    if let Some(content_type) = payload.content_type {
        active.content_type = Set(Some(content_type));
    }
    if let Some(body) = payload.body {
        active.body = Set(Some(body));
    }
    if let Some(platforms) = payload.platforms {
        active.platforms = Set(Some(platforms));
    }
    if let Some(is_active) = payload.is_active {
        active.is_active = Set(is_active);
    }
    if let Some(created_at) = payload.created_at {
        active.created_at = Set(created_at);
    }
    if let Some(updated_at) = payload.updated_at {
        active.updated_at = Set(updated_at);
    } else {
        active.updated_at = Set(Utc::now().fixed_offset());
    }
    if let Some(deleted_at) = payload.deleted_at {
        active.deleted_at = Set(Some(deleted_at));
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(template_json(&updated)))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TemplateScopedQuery>,
) -> ApiResult<Json<Value>> {
    let _ = find_scoped(&state, id, query.tenant_id, query.workspace_id).await?;

    let result = TemplateEntity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("Template not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

async fn find_scoped(
    state: &AppState,
    id: Uuid,
    tenant_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<TemplateModel> {
    let mut query = TemplateEntity::find()
        .filter(TemplateColumn::Id.eq(id))
        .filter(TemplateColumn::TenantId.eq(tenant_id));

    if let Some(workspace_id) = workspace_id {
        query = query.filter(TemplateColumn::WorkspaceId.eq(workspace_id));
    }

    query
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Template not found".into()))
}

fn template_json(template: &TemplateModel) -> Value {
    json!({
        "id": template.id,
        "tenantId": template.tenant_id,
        "workspaceId": template.workspace_id,
        "userId": template.user_id,
        "name": template.name,
        "description": template.description,
        "contentType": template.content_type,
        "body": template.body,
        "platforms": template.platforms,
        "isActive": template.is_active,
        "created_at": template.created_at,
        "updated_at": template.updated_at,
        "deleted_at": template.deleted_at,
    })
}
