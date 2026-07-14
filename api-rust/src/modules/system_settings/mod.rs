pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, EntityTrait, QueryOrder, Set};
use serde_json::{json, Value};

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::system_settings::dto::UpsertSettingDto;
use crate::modules::system_settings::entity::{
    ActiveModel as SettingActiveModel, Entity as SettingEntity, Model as SettingModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/theme", get(get_theme))
        .route("/", get(find_all))
        .route("/{key}", get(find_one).put(upsert).delete(remove))
}

fn default_theme() -> Value {
    json!({
        "primary": "40 79% 52%",
        "secondary": "278 100% 29%",
        "accent": "162 100% 32%",
        "radius": "0.75rem",
        "mode": "light",
    })
}

async fn get_theme(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let stored = SettingEntity::find_by_id("theme").one(&state.db).await?;

    let mut theme = default_theme();
    if let Some(row) = stored {
        if let Value::Object(stored_map) = row.value {
            if let Value::Object(base) = &mut theme {
                for (k, v) in stored_map {
                    base.insert(k, v);
                }
            }
        }
    }

    Ok(Json(theme))
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let rows = SettingEntity::find()
        .order_by_asc(entity::Column::Key)
        .all(&state.db)
        .await?;

    Ok(Json(json!(rows
        .iter()
        .map(setting_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> ApiResult<Json<Value>> {
    let row = SettingEntity::find_by_id(key.clone())
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Setting \"{key}\" not found")))?;

    Ok(Json(setting_json(&row)))
}

async fn upsert(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(key): Path<String>,
    Json(payload): Json<UpsertSettingDto>,
) -> ApiResult<Json<Value>> {
    let existing = SettingEntity::find_by_id(key.clone())
        .one(&state.db)
        .await?;

    let saved = if let Some(row) = existing {
        let mut active: SettingActiveModel = row.into();
        active.value = Set(payload.value);
        if let Some(description) = payload.description {
            active.description = Set(Some(description));
        }
        active.updated_at = Set(Utc::now().fixed_offset());
        active.update(&state.db).await?
    } else {
        SettingActiveModel {
            key: Set(key),
            value: Set(payload.value),
            description: Set(payload.description),
            updated_at: Set(Utc::now().fixed_offset()),
        }
        .insert(&state.db)
        .await?
    };

    Ok(Json(setting_json(&saved)))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> ApiResult<Json<Value>> {
    let result = SettingEntity::delete_by_id(key.clone())
        .exec(&state.db)
        .await?;

    if result.rows_affected == 0 {
        return Err(ApiError::NotFound(format!("Setting \"{key}\" not found")));
    }

    Ok(Json(json!({ "success": true })))
}

fn setting_json(row: &SettingModel) -> Value {
    json!({
        "key": row.key,
        "value": row.value,
        "description": row.description,
        "updated_at": row.updated_at,
    })
}
