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
use crate::modules::whatsapp_contacts::dto::{CreateWhatsappContactDto, UpdateWhatsappContactDto};
use crate::modules::whatsapp_contacts::entity::{
    ActiveModel as ContactActiveModel, Column as ContactColumn, Entity as ContactEntity,
    Model as ContactModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_by_tenant))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct TenantQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

async fn create(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateWhatsappContactDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let opted_in_at = if payload.opted_in {
        Some(
            payload
                .opted_in_at
                .unwrap_or_else(|| Utc::now().fixed_offset()),
        )
    } else {
        payload.opted_in_at
    };

    let contact = ContactActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        workspace_id: Set(payload.workspace_id),
        phone: Set(payload.phone),
        name: Set(payload.name),
        opted_in: Set(payload.opted_in),
        opted_in_at: Set(opted_in_at),
        tags: Set(payload.tags),
        lead_id: Set(payload.lead_id),
        created_at: Set(Utc::now().fixed_offset()),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(contact_json(&contact)))
}

async fn find_by_tenant(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = ContactEntity::find()
        .filter(ContactColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(ContactColumn::CreatedAt);

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(ContactColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(contact_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let contact = find_contact(&state, id, query.tenant_id).await?;
    Ok(Json(contact_json(&contact)))
}

async fn update(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
    Json(payload): Json<UpdateWhatsappContactDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = find_contact(&state, id, query.tenant_id).await?;
    let mut active: ContactActiveModel = existing.into();

    if let Some(v) = payload.phone {
        active.phone = Set(v);
    }
    if let Some(v) = payload.name {
        active.name = Set(Some(v));
    }
    if let Some(v) = payload.opted_in {
        active.opted_in = Set(v);
    }
    if let Some(v) = payload.opted_in_at {
        active.opted_in_at = Set(Some(v));
    }
    if let Some(v) = payload.tags {
        active.tags = Set(Some(v));
    }
    if let Some(v) = payload.lead_id {
        active.lead_id = Set(Some(v));
    }
    if let Some(v) = payload.workspace_id {
        active.workspace_id = Set(Some(v));
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(contact_json(&updated)))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let _ = find_contact(&state, id, query.tenant_id).await?;
    ContactEntity::delete_by_id(id).exec(&state.db).await?;
    Ok(Json(json!({ "success": true })))
}

async fn find_contact(state: &AppState, id: Uuid, tenant_id: Uuid) -> ApiResult<ContactModel> {
    ContactEntity::find_by_id(id)
        .filter(ContactColumn::TenantId.eq(tenant_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Contact not found".into()))
}

fn contact_json(c: &ContactModel) -> Value {
    json!({
        "id": c.id,
        "tenantId": c.tenant_id,
        "workspaceId": c.workspace_id,
        "phone": c.phone,
        "name": c.name,
        "optedIn": c.opted_in,
        "optedInAt": c.opted_in_at,
        "tags": c.tags,
        "leadId": c.lead_id,
        "created_at": c.created_at,
    })
}
