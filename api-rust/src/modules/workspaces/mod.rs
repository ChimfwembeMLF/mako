pub mod dto;
pub mod entity;
pub mod workspace_automation_config_entity;

use axum::{
    extract::{Path, Query, State},
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
use crate::modules::tenant_members::entity::{Column as MemberColumn, Entity as MemberEntity};
use crate::modules::workspaces::dto::{CreateWorkspaceDto, UpdateWorkspaceDto};
use crate::modules::brand_profiles::seed::BrandProfileSeedService;
use crate::modules::workspaces::entity::{
    ActiveModel as WorkspaceActiveModel, Column as WorkspaceColumn, Entity as WorkspaceEntity,
    Model as WorkspaceModel,
};
use crate::modules::workspaces::workspace_automation_config_entity::{
    ActiveModel as ConfigActiveModel, Column as ConfigColumn, Entity as ConfigEntity,
    Model as ConfigModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
        .route("/{id}/automation-config", get(get_automation_config).patch(update_automation_config))
}

#[derive(Deserialize)]
struct WorkspaceQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
}

async fn create(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateWorkspaceDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    assert_tenant_access(&state, id, payload.tenant_id).await?;

    let now = Utc::now().fixed_offset();
    let workspace = WorkspaceActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        name: Set(payload.name),
        slug: Set(payload.slug),
        logo_url: Set(payload.logo_url),
        created_at: Set(now),
        updated_at: Set(now),
    }
    .insert(&state.db)
    .await?;

    BrandProfileSeedService::ensure_for_workspace(&state, payload.tenant_id, workspace.id, id)
        .await?;

    Ok(Json(json!(workspace_json(&workspace))))
}

async fn find_all(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<WorkspaceQuery>,
) -> ApiResult<Json<Value>> {
    let rows = if let Some(tenant_id) = query.tenant_id {
        assert_tenant_access(&state, id, tenant_id).await?;
        WorkspaceEntity::find()
            .filter(WorkspaceColumn::TenantId.eq(tenant_id))
            .all(&state.db)
            .await?
    } else {
        let memberships = MemberEntity::find()
            .filter(MemberColumn::UserId.eq(id))
            .filter(MemberColumn::IsActive.eq(true))
            .all(&state.db)
            .await?;

        if memberships.is_empty() {
            return Ok(Json(json!([])));
        }

        let tenant_ids: Vec<Uuid> = memberships.iter().map(|m| m.tenant_id).collect();
        WorkspaceEntity::find()
            .filter(WorkspaceColumn::TenantId.is_in(tenant_ids))
            .all(&state.db)
            .await?
    };

    Ok(Json(json!(rows
        .iter()
        .map(workspace_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(workspace_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let workspace = WorkspaceEntity::find_by_id(workspace_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Workspaces not found".into()))?;

    assert_tenant_access(&state, id, workspace.tenant_id).await?;
    Ok(Json(json!(workspace_json(&workspace))))
}

async fn update(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<UpdateWorkspaceDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let workspace = WorkspaceEntity::find_by_id(workspace_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Workspaces not found".into()))?;

    assert_tenant_access(&state, id, workspace.tenant_id).await?;

    if let Some(tenant_id) = payload.tenant_id {
        assert_tenant_access(&state, id, tenant_id).await?;
    }

    let mut active: WorkspaceActiveModel = workspace.into();

    if let Some(tenant_id) = payload.tenant_id {
        active.tenant_id = Set(tenant_id);
    }
    if let Some(name) = payload.name {
        active.name = Set(name);
    }
    if let Some(slug) = payload.slug {
        active.slug = Set(slug);
    }
    if let Some(logo_url) = payload.logo_url {
        active.logo_url = Set(Some(logo_url));
    }
    active.updated_at = Set(Utc::now().fixed_offset());

    let updated = active.update(&state.db).await?;
    Ok(Json(json!(workspace_json(&updated))))
}

async fn remove(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(workspace_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let workspace = WorkspaceEntity::find_by_id(workspace_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Workspaces not found".into()))?;

    assert_tenant_access(&state, id, workspace.tenant_id).await?;

    let result = WorkspaceEntity::delete_by_id(workspace_id)
        .exec(&state.db)
        .await?;

    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("Workspaces not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

async fn assert_tenant_access(state: &AppState, user_id: Uuid, tenant_id: Uuid) -> ApiResult<()> {
    let allowed = MemberEntity::find()
        .filter(MemberColumn::TenantId.eq(tenant_id))
        .filter(MemberColumn::UserId.eq(user_id))
        .filter(MemberColumn::IsActive.eq(true))
        .one(&state.db)
        .await?
        .is_some();

    if allowed {
        Ok(())
    } else {
        Err(ApiError::Forbidden(
            "You are not a member of this workspace".into(),
        ))
    }
}

fn workspace_json(workspace: &WorkspaceModel) -> Value {
    json!({
        "id": workspace.id,
        "tenantId": workspace.tenant_id,
        "name": workspace.name,
        "slug": workspace.slug,
        "logoUrl": workspace.logo_url,
        "created_at": workspace.created_at,
        "updated_at": workspace.updated_at,
    })
}

async fn get_automation_config(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(workspace_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let workspace = WorkspaceEntity::find_by_id(workspace_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Workspaces not found".into()))?;

    assert_tenant_access(&state, id, workspace.tenant_id).await?;

    let config = ConfigEntity::find()
        .filter(ConfigColumn::WorkspaceId.eq(workspace_id))
        .one(&state.db)
        .await?;

    let config = match config {
        Some(c) => c,
        None => {
            // Create default
            let now = Utc::now().fixed_offset();
            let new_config = ConfigActiveModel {
                id: Set(Uuid::new_v4()),
                workspace_id: Set(workspace_id),
                is_active: Set(false),
                timezone: Set("America/New_York".to_string()),
                generate_at: Set("19:00".to_string()),
                posts_per_cycle: Set(3),
                plan_ahead_days: Set(1),
                publishing_days: Set(json!([])),
                posting_times: Set(json!([])),
                platforms: Set(json!([])),
                created_at: Set(now),
                updated_at: Set(now),
            };
            new_config.insert(&state.db).await?
        }
    };

    Ok(Json(config_json(&config)))
}

async fn update_automation_config(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<crate::modules::workspaces::dto::UpdateAutomationConfigDto>,
) -> ApiResult<Json<Value>> {
    payload.validate().map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let workspace = WorkspaceEntity::find_by_id(workspace_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Workspaces not found".into()))?;

    assert_tenant_access(&state, id, workspace.tenant_id).await?;

    let config = ConfigEntity::find()
        .filter(ConfigColumn::WorkspaceId.eq(workspace_id))
        .one(&state.db)
        .await?;

    let mut active: ConfigActiveModel = if let Some(c) = config {
        c.into()
    } else {
        let now = Utc::now().fixed_offset();
        ConfigActiveModel {
            id: Set(Uuid::new_v4()),
            workspace_id: Set(workspace_id),
            is_active: Set(false),
            timezone: Set("America/New_York".to_string()),
            generate_at: Set("19:00".to_string()),
            posts_per_cycle: Set(3),
            plan_ahead_days: Set(1),
            publishing_days: Set(json!([])),
            posting_times: Set(json!([])),
            platforms: Set(json!([])),
            created_at: Set(now),
            updated_at: Set(now),
        }
    };

    if let Some(val) = payload.is_active {
        active.is_active = Set(val);
    }
    if let Some(val) = payload.timezone {
        active.timezone = Set(val);
    }
    if let Some(val) = payload.generate_at {
        active.generate_at = Set(val);
    }
    if let Some(val) = payload.posts_per_cycle {
        active.posts_per_cycle = Set(val);
    }
    if let Some(val) = payload.plan_ahead_days {
        active.plan_ahead_days = Set(val);
    }
    if let Some(val) = payload.publishing_days {
        active.publishing_days = Set(val);
    }
    if let Some(val) = payload.posting_times {
        active.posting_times = Set(val);
    }
    if let Some(val) = payload.platforms {
        active.platforms = Set(val);
    }

    active.updated_at = Set(Utc::now().fixed_offset());
    let updated = active.save(&state.db).await?;
    
    // fetch fresh
    let fresh = ConfigEntity::find_by_id(updated.id.unwrap())
        .one(&state.db)
        .await?
        .unwrap();

    Ok(Json(config_json(&fresh)))
}

fn config_json(config: &ConfigModel) -> Value {
    json!({
        "id": config.id,
        "workspaceId": config.workspace_id,
        "isActive": config.is_active,
        "timezone": config.timezone,
        "generateAt": config.generate_at,
        "postsPerCycle": config.posts_per_cycle,
        "planAheadDays": config.plan_ahead_days,
        "publishingDays": config.publishing_days,
        "postingTimes": config.posting_times,
        "platforms": config.platforms,
        "created_at": config.created_at,
        "updated_at": config.updated_at,
    })
}
