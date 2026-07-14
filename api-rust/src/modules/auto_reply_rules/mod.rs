pub mod dto;
pub mod entity;
pub mod service;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, Condition, EntityTrait, QueryFilter, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::auto_reply_rules::dto::{CreateAutoReplyRuleDto, UpdateAutoReplyRuleDto};
use crate::modules::auto_reply_rules::entity::{
    ActiveModel as AutoReplyRuleActiveModel, Column as AutoReplyRuleColumn,
    Entity as AutoReplyRuleEntity, Model as AutoReplyRuleModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct AutoReplyRuleListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreateAutoReplyRuleDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let now = Utc::now().fixed_offset();
    let rule = AutoReplyRuleActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        workspace_id: Set(payload.workspace_id),
        platform: Set(payload.platform),
        name: Set(payload.name),
        trigger_keywords: Set(payload.trigger_keywords),
        trigger_sentiment: Set(payload.trigger_sentiment),
        response_template: Set(payload.response_template),
        ai_generate: Set(payload.ai_generate),
        is_active: Set(payload.is_active),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(auto_reply_rule_json(&rule)))
}

async fn find_all(
    State(state): State<AppState>,
    Query(query): Query<AutoReplyRuleListQuery>,
) -> ApiResult<Json<Value>> {
    let rows = if let Some(tenant_id) = query.tenant_id {
        let mut db_query =
            AutoReplyRuleEntity::find().filter(AutoReplyRuleColumn::TenantId.eq(tenant_id));

        if let Some(workspace_id) = query.workspace_id {
            db_query = db_query.filter(
                Condition::any()
                    .add(Condition::all().add(AutoReplyRuleColumn::WorkspaceId.eq(workspace_id)))
                    .add(AutoReplyRuleColumn::WorkspaceId.is_null()),
            );
        }

        db_query.all(&state.db).await?
    } else {
        AutoReplyRuleEntity::find().all(&state.db).await?
    };

    Ok(Json(json!(rows
        .iter()
        .map(auto_reply_rule_json)
        .collect::<Vec<_>>())))
}

async fn find_one(State(state): State<AppState>, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    let rule = AutoReplyRuleEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("AutoReplyRules not found".into()))?;

    Ok(Json(auto_reply_rule_json(&rule)))
}

async fn update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAutoReplyRuleDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = AutoReplyRuleEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("AutoReplyRules not found".into()))?;

    let mut active: AutoReplyRuleActiveModel = existing.into();

    if let Some(tenant_id) = payload.tenant_id {
        active.tenant_id = Set(tenant_id);
    }
    if let Some(workspace_id) = payload.workspace_id {
        active.workspace_id = Set(Some(workspace_id));
    }
    if let Some(platform) = payload.platform {
        active.platform = Set(platform);
    }
    if let Some(name) = payload.name {
        active.name = Set(name);
    }
    if let Some(trigger_keywords) = payload.trigger_keywords {
        active.trigger_keywords = Set(Some(trigger_keywords));
    }
    if let Some(trigger_sentiment) = payload.trigger_sentiment {
        active.trigger_sentiment = Set(Some(trigger_sentiment));
    }
    if let Some(response_template) = payload.response_template {
        active.response_template = Set(Some(response_template));
    }
    if let Some(ai_generate) = payload.ai_generate {
        active.ai_generate = Set(ai_generate);
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
    Ok(Json(auto_reply_rule_json(&updated)))
}

async fn remove(State(state): State<AppState>, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    let result = AutoReplyRuleEntity::delete_by_id(id)
        .exec(&state.db)
        .await?;

    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("AutoReplyRules not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

fn auto_reply_rule_json(rule: &AutoReplyRuleModel) -> Value {
    json!({
        "id": rule.id,
        "tenantId": rule.tenant_id,
        "workspaceId": rule.workspace_id,
        "platform": rule.platform,
        "name": rule.name,
        "triggerKeywords": rule.trigger_keywords,
        "triggerSentiment": rule.trigger_sentiment,
        "responseTemplate": rule.response_template,
        "aiGenerate": rule.ai_generate,
        "isActive": rule.is_active,
        "created_at": rule.created_at,
        "updated_at": rule.updated_at,
        "deleted_at": rule.deleted_at,
    })
}
