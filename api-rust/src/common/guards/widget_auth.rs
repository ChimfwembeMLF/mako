use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::app_state::AppState;
use crate::modules::chatbot::entity::api_key::{
    ActiveModel as ApiKeyActiveModel, Column as ApiKeyColumn, Entity as ApiKeyEntity,
    Model as ApiKeyModel,
};
use crate::modules::chatbot::entity::config::{
    Column as ConfigColumn, Entity as ConfigEntity, Model as ConfigModel,
};

pub struct WidgetAuth {
    pub key: ApiKeyModel,
    pub config: ConfigModel,
}

impl FromRequestParts<AppState> for WidgetAuth {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|header| header.to_str().ok())
            .filter(|header| header.starts_with("Bearer "))
            .map(|header| header.trim_start_matches("Bearer ").trim());

        let raw = auth_header.ok_or_else(|| unauthorized("API key required"))?;

        if !raw.starts_with("pk_live_") {
            return Err(unauthorized("Invalid API key"));
        }

        let prefix = raw.split('_').take(3).collect::<Vec<_>>().join("_");
        let key = ApiKeyEntity::find()
            .filter(ApiKeyColumn::KeyPrefix.eq(prefix))
            .one(&state.db)
            .await
            .map_err(|_| unauthorized("Invalid API key"))?
            .filter(|k| k.revoked_at.is_none())
            .ok_or_else(|| unauthorized("Invalid API key"))?;

        if hash_key(raw) != key.key_hash {
            return Err(unauthorized("Invalid API key"));
        }

        let config = ConfigEntity::find()
            .filter(ConfigColumn::Id.eq(key.config_id))
            .filter(ConfigColumn::TenantId.eq(key.tenant_id))
            .one(&state.db)
            .await
            .map_err(|_| unauthorized("Invalid API key"))?
            .filter(|c| c.is_active && c.widget_enabled)
            .ok_or_else(|| unauthorized("Chatbot widget is not enabled"))?;

        let mut active: ApiKeyActiveModel = key.clone().into();
        active.last_used_at = Set(Some(Utc::now().fixed_offset()));
        let _ = active.update(&state.db).await;

        Ok(WidgetAuth { key, config })
    }
}

fn hash_key(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn unauthorized(message: &str) -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({
            "success": false,
            "statusCode": 401,
            "error": message,
        })),
    )
        .into_response()
}
