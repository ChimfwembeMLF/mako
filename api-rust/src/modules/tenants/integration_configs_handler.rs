use axum::{
    extract::{Path, State},
    routing::{delete, get, put},
    Json, Router,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::encryption::EncryptionService;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::tenants::integration_config_entity::{
    ActiveModel as ConfigActiveModel, Column as ConfigColumn, Entity as ConfigEntity,
    Model as ConfigModel,
};

#[derive(Debug, Deserialize, Validate)]
pub struct UpsertConfigDto {
    pub provider: String,
    pub api_key: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/:tenant_id",
            get(get_configs).put(upsert_config),
        )
        .route("/:tenant_id/:provider", delete(delete_config))
}

async fn get_configs(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let configs = ConfigEntity::find()
        .filter(ConfigColumn::TenantId.eq(tenant_id))
        .all(&state.db)
        .await?;

    let response: Vec<Value> = configs
        .into_iter()
        .map(|config| {
            json!({
                "id": config.id,
                "tenantId": config.tenant_id,
                "provider": config.provider,
                "isConfigured": true,
                "updatedAt": config.updated_at,
            })
        })
        .collect();

    Ok(Json(json!(response)))
}

async fn upsert_config(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
    Json(payload): Json<UpsertConfigDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let enc_key = env::var("ENCRYPTION_KEY").unwrap_or_else(|_| "default-secret-key-32-chars-long".into());
    let enc_service = EncryptionService::new(&enc_key);

    let (encrypted_data, iv, auth_tag) = enc_service
        .encrypt(&payload.api_key)
        .map_err(|e| ApiError::BadRequest(e))?;

    let existing = ConfigEntity::find()
        .filter(ConfigColumn::TenantId.eq(tenant_id))
        .filter(ConfigColumn::Provider.eq(&payload.provider))
        .one(&state.db)
        .await?;

    let provider = payload.provider.clone();

    if let Some(config) = existing {
        let mut active: ConfigActiveModel = config.into();
        active.encrypted_api_key = Set(encrypted_data);
        active.iv = Set(iv);
        active.auth_tag = Set(auth_tag);
        active.updated_at = Set(Utc::now().fixed_offset());
        active.update(&state.db).await?;
    } else {
        let active = ConfigActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(tenant_id),
            provider: Set(payload.provider),
            encrypted_api_key: Set(encrypted_data),
            iv: Set(iv),
            auth_tag: Set(auth_tag),
            created_at: Set(Utc::now().fixed_offset()),
            updated_at: Set(Utc::now().fixed_offset()),
        };
        active.insert(&state.db).await?;
    }

    Ok(Json(json!({
        "success": true,
        "provider": provider,
    })))
}

async fn delete_config(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path((tenant_id, provider)): Path<(Uuid, String)>,
) -> ApiResult<Json<Value>> {
    let result = ConfigEntity::delete_many()
        .filter(ConfigColumn::TenantId.eq(tenant_id))
        .filter(ConfigColumn::Provider.eq(provider))
        .exec(&state.db)
        .await?;

    Ok(Json(json!({ "success": true })))
}
