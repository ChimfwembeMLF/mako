pub mod dto;
pub mod entity;

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
use crate::common::{ApiError, ApiResult};
use crate::modules::profiles::dto::{CreateProfileDto, UpdateProfileDto};
use crate::modules::profiles::entity::{
    ActiveModel as ProfileActiveModel, Column as ProfileColumn, Entity as ProfileEntity,
    Model as ProfileModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct ProfileQuery {
    #[serde(rename = "userId")]
    user_id: Option<Uuid>,
}

async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreateProfileDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let profile = ProfileActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(payload.user_id),
        display_name: Set(payload.display_name),
        full_name: Set(payload.full_name),
        avatar_url: Set(payload.avatar_url),
        is_system_admin: Set(payload.is_system_admin),
        created_at: Set(payload.created_at),
        updated_at: Set(payload.updated_at),
    }
    .insert(&state.db)
    .await?;

    Ok(Json(profile_json(&profile)))
}

async fn find_all(
    State(state): State<AppState>,
    Query(query): Query<ProfileQuery>,
) -> ApiResult<Json<Value>> {
    let rows = if let Some(user_id) = query.user_id {
        ProfileEntity::find()
            .filter(ProfileColumn::UserId.eq(user_id))
            .all(&state.db)
            .await?
    } else {
        ProfileEntity::find().all(&state.db).await?
    };

    Ok(Json(json!(rows
        .iter()
        .map(profile_json)
        .collect::<Vec<_>>())))
}

async fn find_one(State(state): State<AppState>, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    let profile = ProfileEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Profiles not found".into()))?;

    Ok(Json(profile_json(&profile)))
}

async fn update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProfileDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let profile = ProfileEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Profiles not found".into()))?;

    let mut active: ProfileActiveModel = profile.into();

    if let Some(user_id) = payload.user_id {
        active.user_id = Set(user_id);
    }
    if let Some(display_name) = payload.display_name {
        active.display_name = Set(Some(display_name));
    }
    if let Some(full_name) = payload.full_name {
        active.full_name = Set(Some(full_name));
    }
    if let Some(avatar_url) = payload.avatar_url {
        active.avatar_url = Set(Some(avatar_url));
    }
    if let Some(is_system_admin) = payload.is_system_admin {
        active.is_system_admin = Set(Some(is_system_admin));
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
    Ok(Json(profile_json(&updated)))
}

async fn remove(State(state): State<AppState>, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    let result = ProfileEntity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("Profiles not found".into()));
    }
    Ok(Json(json!({ "success": true })))
}

fn profile_json(profile: &ProfileModel) -> Value {
    json!({
        "id": profile.id,
        "userId": profile.user_id,
        "displayName": profile.display_name,
        "fullName": profile.full_name,
        "avatarUrl": profile.avatar_url,
        "isSystemAdmin": profile.is_system_admin,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    })
}
