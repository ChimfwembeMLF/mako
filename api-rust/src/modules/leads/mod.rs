pub mod dto;
pub mod entity;
pub mod lead_email;

use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::lead_sources::entity::{Entity as SourceEntity, Model as SourceModel};
use crate::modules::leads::entity::{
    ActiveModel as LeadActiveModel, Column as LeadColumn, Entity as LeadEntity, Model as LeadModel,
};

use self::dto::{CreateLeadDto, UpdateLeadDto, WebhookLeadDto};
use self::lead_email::{LeadEmailService, SendLeadEmailDto};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/webhook", post(webhook))
        .route("/send-email", post(send_email))
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

async fn webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<WebhookLeadDto>,
) -> ApiResult<Json<Value>> {
    let secret = headers
        .get("x-webhook-secret")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let source_id = payload.source_id;

    if source_id.is_none() || secret.is_none() {
        return Err(ApiError::Unauthorized(
            "sourceId and X-Webhook-Secret required".into(),
        ));
    }

    let source_id = source_id.unwrap();
    let secret = secret.unwrap();

    let source = SourceEntity::find_by_id(source_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::Unauthorized("Invalid webhook secret".into()))?;

    if source.webhook_secret.as_deref() != Some(secret) {
        return Err(ApiError::Unauthorized("Invalid webhook secret".into()));
    }

    let lead = create_lead_from_webhook(&state, &source, &payload).await?;

    Ok(Json(json!({
        "ok": true,
        "leadId": lead.id,
    })))
}

async fn create_lead_from_webhook(
    state: &AppState,
    source: &SourceModel,
    payload: &WebhookLeadDto,
) -> ApiResult<LeadModel> {
    let now = Utc::now().fixed_offset();

    let lead = LeadActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(source.tenant_id),
        workspace_id: Set(None),
        user_id: Set(source.user_id),
        name: Set(payload.name.clone().unwrap_or_else(|| "Unknown".into())),
        email: Set(payload.email.clone().unwrap_or_default()),
        source: Set(payload
            .source
            .clone()
            .unwrap_or_else(|| source.label.clone())),
        message: Set(payload.message.clone()),
        classification: Set(None),
        status: Set(Some("new".into())),
        ai_reply: Set(None),
        unsubscribed: Set(None),
        unsubscribe_token: Set(None),
        deleted_at: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    }
    .insert(&state.db)
    .await?;

    Ok(lead)
}

async fn send_email(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<SendLeadEmailDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let result = LeadEmailService::send_lead_email(&state, id, payload).await?;
    Ok(Json(result))
}

async fn create(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateLeadDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let lead = LeadActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        workspace_id: Set(payload.workspace_id),
        user_id: Set(payload.user_id),
        name: Set(payload.name),
        email: Set(payload.email),
        source: Set(payload.source),
        message: Set(payload.message),
        classification: Set(payload.classification),
        status: Set(payload.status),
        ai_reply: Set(payload.ai_reply),
        unsubscribed: Set(payload.unsubscribed),
        unsubscribe_token: Set(payload.unsubscribe_token),
        deleted_at: Set(payload.deleted_at),
        created_at: Set(payload.created_at),
        updated_at: Set(payload.updated_at),
    }
    .insert(&state.db)
    .await?;

    Ok(Json(lead_json(&lead)))
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> ApiResult<Json<Value>> {
    let mut finder = LeadEntity::find();

    if let Some(tenant_id) = query.tenant_id {
        finder = finder.filter(LeadColumn::TenantId.eq(tenant_id));
    }
    if let Some(workspace_id) = query.workspace_id {
        finder = finder.filter(LeadColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = finder.all(&state.db).await?;
    Ok(Json(json!(rows.iter().map(lead_json).collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(lead_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let lead = LeadEntity::find_by_id(lead_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Leads not found".into()))?;

    Ok(Json(lead_json(&lead)))
}

async fn update(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(lead_id): Path<Uuid>,
    Json(payload): Json<UpdateLeadDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let lead = LeadEntity::find_by_id(lead_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Leads not found".into()))?;

    let mut active: LeadActiveModel = lead.into();

    if let Some(tenant_id) = payload.tenant_id {
        active.tenant_id = Set(tenant_id);
    }
    if let Some(user_id) = payload.user_id {
        active.user_id = Set(user_id);
    }
    if let Some(name) = payload.name {
        active.name = Set(name);
    }
    if let Some(email) = payload.email {
        active.email = Set(email);
    }
    if let Some(source) = payload.source {
        active.source = Set(source);
    }
    if let Some(message) = payload.message {
        active.message = Set(Some(message));
    }
    if let Some(classification) = payload.classification {
        active.classification = Set(Some(classification));
    }
    if let Some(status) = payload.status {
        active.status = Set(Some(status));
    }
    if let Some(ai_reply) = payload.ai_reply {
        active.ai_reply = Set(Some(ai_reply));
    }
    if let Some(unsubscribed) = payload.unsubscribed {
        active.unsubscribed = Set(Some(unsubscribed));
    }
    if let Some(unsubscribe_token) = payload.unsubscribe_token {
        active.unsubscribe_token = Set(Some(unsubscribe_token));
    }
    if let Some(deleted_at) = payload.deleted_at {
        active.deleted_at = Set(Some(deleted_at));
    }
    if let Some(created_at) = payload.created_at {
        active.created_at = Set(created_at);
    }
    if let Some(updated_at) = payload.updated_at {
        active.updated_at = Set(updated_at);
    } else {
        active.updated_at = Set(Utc::now().fixed_offset());
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(lead_json(&updated)))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(lead_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let result = LeadEntity::delete_by_id(lead_id).exec(&state.db).await?;

    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("Leads not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

fn lead_json(lead: &LeadModel) -> Value {
    json!({
        "id": lead.id,
        "tenantId": lead.tenant_id,
        "workspaceId": lead.workspace_id,
        "userId": lead.user_id,
        "name": lead.name,
        "email": lead.email,
        "source": lead.source,
        "message": lead.message,
        "classification": lead.classification,
        "status": lead.status,
        "aiReply": lead.ai_reply,
        "unsubscribed": lead.unsubscribed,
        "unsubscribeToken": lead.unsubscribe_token,
        "deleted_at": lead.deleted_at,
        "created_at": lead.created_at,
        "updated_at": lead.updated_at,
    })
}
