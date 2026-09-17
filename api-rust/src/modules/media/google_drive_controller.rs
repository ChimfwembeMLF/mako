use axum::{
    extract::{Query, State},
    response::Redirect,
    Json,
};
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    app_state::AppState,
    common::{ApiError, ApiResult, guards::AuthUser},
    modules::{
        system_settings::integrations::get_integration_with_env_fallback,
        media::google_drive_service::GoogleDriveService,
        media::entity::{
            ActiveModel as MediaActiveModel, Column as MediaColumn, Entity as MediaEntity,
        },
        tenants::integration_config_entity::{
            ActiveModel as IntegrationActiveModel, Column as IntegrationColumn,
            Entity as IntegrationEntity,
        },
    },
    services::{
        s3_storage::S3StorageService,
    },
    common::encryption::EncryptionService,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};

#[derive(Deserialize)]
pub struct AuthUrlQuery {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
}

#[derive(Deserialize)]
pub struct CallbackQuery {
    pub code: String,
    pub state: String,
}

#[derive(Serialize, Deserialize)]
pub struct StatePayload {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
}

#[derive(Deserialize)]
pub struct ImportPayload {
    #[serde(rename = "fileId")]
    pub file_id: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
}

pub async fn get_auth_url(
    State(state): State<AppState>,
    Query(query): Query<AuthUrlQuery>
) -> ApiResult<Json<serde_json::Value>> {
    let client_id = get_integration_with_env_fallback(&state, "GOOGLE_CLIENT_ID")
        .await
        .unwrap_or_else(|| state.config.oauth.google_client_id.clone());

    let service = GoogleDriveService::new();
    let auth_url = service.get_auth_url(&client_id);

    let state_payload = StatePayload {
        tenant_id: query.tenant_id,
    };
    let state_json = serde_json::to_string(&state_payload).unwrap();
    let state_b64 = base64::engine::general_purpose::STANDARD.encode(state_json);
    
    // Note: get_auth_url string already contains query params, so we append state.
    // However, my get_auth_url didn't include state so we can just append it:
    let url_with_state = format!("{}&state={}", auth_url, state_b64);

    Ok(Json(json!({ "url": url_with_state })))
}

pub async fn callback(
    State(state): State<AppState>,
    Query(query): Query<CallbackQuery>,
) -> ApiResult<Redirect> {
    let state_json = base64::engine::general_purpose::STANDARD
        .decode(&query.state)
        .map_err(|_| ApiError::BadRequest("Invalid state".into()))?;
    
    let state_payload: StatePayload = serde_json::from_slice(&state_json)
        .map_err(|_| ApiError::BadRequest("Invalid state payload".into()))?;

    let client_id = get_integration_with_env_fallback(&state, "GOOGLE_CLIENT_ID")
        .await
        .unwrap_or_else(|| state.config.oauth.google_client_id.clone());
    let client_secret = get_integration_with_env_fallback(&state, "GOOGLE_CLIENT_SECRET")
        .await
        .unwrap_or_else(|| state.config.oauth.google_client_secret.clone());

    let service = GoogleDriveService::new();
    let tokens = service
        .exchange_code(&query.code, &client_id, &client_secret)
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to exchange code: {}", e)))?;

    let token_json = serde_json::to_string(&tokens).unwrap();
    
    let enc_key = std::env::var("ENCRYPTION_KEY").unwrap_or_else(|_| "default-secret-key-32-chars-long".to_string());
    let encryption_service = EncryptionService::new(&enc_key);
    let (encrypted_data, iv, auth_tag) = encryption_service.encrypt(&token_json)
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("Encryption failed: {}", e)))?;

    let existing = IntegrationEntity::find()
        .filter(IntegrationColumn::TenantId.eq(state_payload.tenant_id))
        .filter(IntegrationColumn::Provider.eq("google_drive"))
        .one(&state.db)
        .await?;

    let now = chrono::Utc::now().into();
    
    if let Some(config) = existing {
        let mut active: IntegrationActiveModel = config.into();
        active.encrypted_api_key = Set(encrypted_data);
        active.iv = Set(iv);
        active.auth_tag = Set(auth_tag);
        active.updated_at = Set(now);
        active.update(&state.db).await?;
    } else {
        let new_config = IntegrationActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(state_payload.tenant_id),
            provider: Set("google_drive".to_string()),
            encrypted_api_key: Set(encrypted_data),
            iv: Set(iv),
            auth_tag: Set(auth_tag),
            created_at: Set(now),
            updated_at: Set(now),
        };
        new_config.insert(&state.db).await?;
    }

    let frontend_url = std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5173".into());
    Ok(Redirect::to(&format!("{}/settings/integrations?success=google_drive", frontend_url)))
}

pub async fn get_files(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<AuthUrlQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let existing = IntegrationEntity::find()
        .filter(IntegrationColumn::TenantId.eq(query.tenant_id))
        .filter(IntegrationColumn::Provider.eq("google_drive"))
        .one(&state.db)
        .await?;

    let config = existing.ok_or_else(|| ApiError::BadRequest("Google Drive is not connected".into()))?;

    let enc_key = std::env::var("ENCRYPTION_KEY").unwrap_or_else(|_| "default-secret-key-32-chars-long".to_string());
    let encryption_service = EncryptionService::new(&enc_key);
    let token_json = encryption_service.decrypt(&config.encrypted_api_key, &config.iv, &config.auth_tag)
        .map_err(|_| ApiError::BadRequest("Failed to decrypt token".into()))?;

    let tokens: serde_json::Value = serde_json::from_str(&token_json)
        .map_err(|_| ApiError::BadRequest("Invalid token format".into()))?;

    let access_token = tokens["access_token"].as_str().unwrap_or_default();

    let client = reqwest::Client::new();
    let response = client
        .get("https://www.googleapis.com/drive/v3/files?q=mimeType%20contains%20'image/'%20or%20mimeType%20contains%20'video/'&fields=files(id,name,mimeType,thumbnailLink,size)&pageSize=50")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(format!("Google API error: {}", e)))?;

    let files: serde_json::Value = response
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(format!("Google API JSON error: {}", e)))?;

    Ok(Json(files["files"].clone()))
}

pub async fn import_file(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<AuthUrlQuery>,
    axum::extract::Json(payload): axum::extract::Json<ImportPayload>,
) -> ApiResult<Json<serde_json::Value>> {
    let existing = IntegrationEntity::find()
        .filter(IntegrationColumn::TenantId.eq(query.tenant_id))
        .filter(IntegrationColumn::Provider.eq("google_drive"))
        .one(&state.db)
        .await?;

    let config = existing.ok_or_else(|| ApiError::BadRequest("Google Drive is not connected".into()))?;

    let enc_key = std::env::var("ENCRYPTION_KEY").unwrap_or_else(|_| "default-secret-key-32-chars-long".to_string());
    let encryption_service = EncryptionService::new(&enc_key);
    let token_json = encryption_service.decrypt(&config.encrypted_api_key, &config.iv, &config.auth_tag)
        .map_err(|_| ApiError::BadRequest("Failed to decrypt token".into()))?;

    let tokens: serde_json::Value = serde_json::from_str(&token_json)
        .map_err(|_| ApiError::BadRequest("Invalid token format".into()))?;

    let access_token = tokens["access_token"].as_str().unwrap_or_default();

    let client = reqwest::Client::new();
    let response = client
        .get(&format!("https://www.googleapis.com/drive/v3/files/{}?alt=media", payload.file_id))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(format!("Google API error: {}", e)))?;

    let buffer = response
        .bytes()
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to download file: {}", e)))?;

    let s3_service = S3StorageService::new(state.config.s3.clone());
    let uploaded = s3_service
        .upload_buffer(
            &query.tenant_id.to_string(),
            &buffer,
            &payload.mime_type,
            Some(&payload.file_name),
            Some("uploads"),
        )
        .await?;

    let media_type = if payload.mime_type.starts_with("video/") { "video" } else { "image" };
    let now = chrono::Utc::now().into();

    let active_model = MediaActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(query.tenant_id),
        workspace_id: Set(payload.workspace_id),
        media_url: Set(uploaded.public_url.clone()),
        media_type: Set(media_type.to_string()),
        name: Set(Some(payload.file_name.clone())),
        uploaded_by: Set(Some(user_id)),
        file_size_bytes: Set(Some(buffer.len() as i64)),
        source: Set(Some("google_drive".to_string())),
        external_id: Set(Some(payload.file_id.clone())),
        created_at: Set(now),
        ..Default::default()
    };

    let inserted = active_model.insert(&state.db).await?;
    
    // In a real app we would map this back to our Media dto, but returning the ID is fine for now
    Ok(Json(json!({ "id": inserted.id, "mediaUrl": inserted.media_url })))
}
