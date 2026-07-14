pub mod bootstrap;
pub mod dto;
pub mod entity;
pub mod tenant_seeds;

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use rust_decimal::Decimal;
use sea_orm::{ActiveModelTrait, EntityTrait, Set};
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::tenants::bootstrap::TenantBootstrapService;
use crate::modules::tenants::dto::{CreateTenantDto, UpdateTenantDto};
use crate::modules::tenants::entity::{
    ActiveModel as TenantActiveModel, Entity as TenantEntity, Model as TenantModel,
};
use crate::modules::users::entity::Entity as UserEntity;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/mine", get(find_mine))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreateTenantDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let tenant = TenantActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(payload.name),
        slug: Set(payload.slug),
        logo_url: Set(payload.logo_url),
        owner_id: Set(payload.owner_id),
        ads_balance: Set(Decimal::ZERO),
        created_at: Set(payload.created_at),
        updated_at: Set(payload.updated_at),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(json!(tenant_json(&tenant))))
}

async fn find_mine(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let user = UserEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("User not found".into()))?;

    let tenant = TenantBootstrapService::bootstrap_for_user(&state, &user).await?;
    Ok(Json(json!([tenant_json(&tenant)])))
}

async fn find_all(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let rows = TenantEntity::find().all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(tenant_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let tenant = TenantEntity::find_by_id(tenant_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Tenants not found".into()))?;

    Ok(Json(json!(tenant_json(&tenant))))
}

async fn update(
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
    Json(payload): Json<UpdateTenantDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let tenant = TenantEntity::find_by_id(tenant_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Tenants not found".into()))?;

    let mut active: TenantActiveModel = tenant.into();

    if let Some(name) = payload.name {
        active.name = Set(name);
    }
    if let Some(slug) = payload.slug {
        active.slug = Set(slug);
    }
    if let Some(logo_url) = payload.logo_url {
        active.logo_url = Set(Some(logo_url));
    }
    if let Some(owner_id) = payload.owner_id {
        active.owner_id = Set(owner_id);
    }
    if let Some(theme_config) = payload.theme_config {
        active.theme_config = Set(Some(theme_config));
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
    Ok(Json(json!(tenant_json(&updated))))
}

async fn remove(
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let result = TenantEntity::delete_by_id(tenant_id)
        .exec(&state.db)
        .await?;

    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("Tenants not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

fn tenant_json(tenant: &TenantModel) -> Value {
    json!({
        "id": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
        "logoUrl": tenant.logo_url,
        "ownerId": tenant.owner_id,
        "themeConfig": tenant.theme_config,
        "adsBalance": tenant.ads_balance,
        "created_at": tenant.created_at,
        "updated_at": tenant.updated_at,
    })
}
