pub mod dto;
pub mod entity;

use axum::{
    body::Bytes,
    extract::{FromRequest, Multipart, Path, Query, Request, State},
    http::header::CONTENT_TYPE,
    routing::{delete, get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::media::dto::Base64UploadDto;
use crate::modules::media::entity::{
    ActiveModel as MediaActiveModel, Column as MediaColumn, Entity as MediaEntity,
    Model as MediaModel,
};
use crate::services::s3_storage::S3StorageService;
use crate::services::supabase_storage::SupabaseStorageService;

const MAX_UPLOAD_BYTES: usize = 50 * 1024 * 1024;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(find_all))
        .route("/upload", post(upload))
        .route("/{id}", delete(remove))
}

#[derive(Deserialize)]
struct MediaListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct MediaScopedQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
}

#[derive(Deserialize)]
struct UploadQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "contentId")]
    content_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

pub fn s3_is_configured(state: &AppState) -> bool {
    S3StorageService::new(state.config.s3.clone()).is_enabled()
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<MediaListQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = MediaEntity::find()
        .filter(MediaColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(MediaColumn::CreatedAt);

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(MediaColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows.iter().map(media_json).collect::<Vec<_>>())))
}

async fn upload(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<UploadQuery>,
    request: Request,
) -> ApiResult<Json<Value>> {
    let content_type = request
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_lowercase();

    if content_type.starts_with("multipart/form-data") {
        let multipart = Multipart::from_request(request, &state)
            .await
            .map_err(|_| ApiError::BadRequest("Invalid multipart upload".into()))?;
        return handle_multipart_upload(&state, query, user_id, multipart).await;
    }

    let bytes = Bytes::from_request(request, &state)
        .await
        .map_err(|_| ApiError::BadRequest("Invalid request body".into()))?;

    if bytes.len() > MAX_UPLOAD_BYTES {
        return Err(ApiError::BadRequest("Request body too large".into()));
    }

    let payload: Base64UploadDto = serde_json::from_slice(&bytes)
        .map_err(|_| ApiError::BadRequest("Expected multipart file or base64 JSON body".into()))?;

    if payload.data.trim().is_empty() {
        return Err(ApiError::BadRequest("data is required".into()));
    }

    let decoded = STANDARD
        .decode(payload.data.as_bytes())
        .map_err(|_| ApiError::BadRequest("Invalid base64 data".into()))?;

    if decoded.len() > MAX_UPLOAD_BYTES {
        return Err(ApiError::BadRequest("File exceeds 50 MB limit".into()));
    }

    let file_name = payload.file_name.unwrap_or_else(|| "upload.bin".into());
    let mime = payload
        .content_type
        .unwrap_or_else(|| "application/octet-stream".into());
    let media_type = if mime.starts_with("video/") {
        "video"
    } else {
        "image"
    };

    let asset = save_media_asset(
        &state,
        SaveMediaParams {
            tenant_id: payload.tenant_id,
            workspace_id: payload.workspace_id.or(query.workspace_id),
            content_id: payload.content_id.or(query.content_id),
            user_id,
            media_type: media_type.into(),
            content_type: mime.clone(),
            name: Some(file_name),
            file_size_bytes: Some(decoded.len() as i64),
            original_bytes: Some(decoded),
        },
    )
    .await?;

    Ok(Json(media_json(&asset)))
}

async fn handle_multipart_upload(
    state: &AppState,
    query: UploadQuery,
    user_id: Uuid,
    mut multipart: Multipart,
) -> ApiResult<Json<Value>> {
    let mut file_name: Option<String> = None;
    let mut mime_type = "application/octet-stream".to_string();
    let mut file_bytes: Option<Vec<u8>> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::BadRequest("Invalid multipart field".into()))?
    {
        if field.name() != Some("file") {
            continue;
        }

        file_name = field.file_name().map(str::to_string);
        mime_type = field
            .content_type()
            .map(str::to_string)
            .unwrap_or_else(|| mime_type.clone());

        let data = field
            .bytes()
            .await
            .map_err(|_| ApiError::BadRequest("Failed to read uploaded file".into()))?;

        if data.len() > MAX_UPLOAD_BYTES {
            return Err(ApiError::BadRequest("File exceeds 50 MB limit".into()));
        }

        file_bytes = Some(data.to_vec());
        break;
    }

    let bytes = file_bytes.ok_or_else(|| ApiError::BadRequest("file is required".into()))?;
    let media_type = if mime_type.starts_with("video/") {
        "video"
    } else {
        "image"
    };

    let asset = save_media_asset(
        state,
        SaveMediaParams {
            tenant_id: query.tenant_id,
            workspace_id: query.workspace_id,
            content_id: query.content_id,
            user_id,
            media_type: media_type.into(),
            content_type: mime_type,
            name: file_name,
            file_size_bytes: Some(bytes.len() as i64),
            original_bytes: Some(bytes),
        },
    )
    .await?;

    Ok(Json(media_json(&asset)))
}

struct SaveMediaParams {
    tenant_id: Uuid,
    workspace_id: Option<Uuid>,
    content_id: Option<Uuid>,
    user_id: Uuid,
    media_type: String,
    content_type: String,
    name: Option<String>,
    file_size_bytes: Option<i64>,
    original_bytes: Option<Vec<u8>>,
}

async fn save_media_asset(state: &AppState, params: SaveMediaParams) -> ApiResult<MediaModel> {
    let bytes = params
        .original_bytes
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("file is required".into()))?;

    let s3 = S3StorageService::new(state.config.s3.clone());
    let supabase = SupabaseStorageService::new(state.config.supabase.clone());

    let (media_url, tags) = if s3.is_enabled() {
        let uploaded = s3
            .upload_buffer(
                &params.tenant_id.to_string(),
                bytes,
                &params.content_type,
                params.name.as_deref(),
                Some("uploads"),
            )
            .await?;
        tracing::debug!(storage_path = %uploaded.storage_path, "Uploaded media to S3");
        (
            uploaded.public_url,
            Some(vec![format!("storage_path:{}", uploaded.storage_path)]),
        )
    } else if supabase.is_enabled() {
        let uploaded = supabase
            .upload_buffer(
                &params.tenant_id.to_string(),
                bytes,
                &params.content_type,
                params.name.as_deref(),
                Some("uploads"),
            )
            .await?;
        tracing::debug!(storage_path = %uploaded.storage_path, "Uploaded media to Supabase");
        (
            uploaded.public_url,
            Some(vec![format!("storage_path:{}", uploaded.storage_path)]),
        )
    } else {
        tracing::warn!(
            "Storage not configured; saving media record with placeholder URL for tenant {}",
            params.tenant_id
        );
        (
            format!("placeholder://media/{}", Uuid::new_v4()),
            None,
        )
    };

    let now = Utc::now().fixed_offset();
    let asset = MediaActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(params.tenant_id),
        workspace_id: Set(params.workspace_id),
        content_id: Set(params.content_id),
        media_url: Set(media_url),
        media_type: Set(params.media_type),
        name: Set(params.name),
        tags: Set(tags),
        uploaded_by: Set(Some(params.user_id)),
        file_size_bytes: Set(params.file_size_bytes),
        width_px: Set(None),
        height_px: Set(None),
        alt_text: Set(None),
        created_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(asset)
}

pub async fn attach_to_content(
    state: &AppState,
    tenant_id: Uuid,
    content_id: Uuid,
    items: Vec<(String, Option<String>, Option<Uuid>)>,
    user_id: Uuid,
) -> ApiResult<Vec<MediaModel>> {
    let mut saved = Vec::new();

    for (url, media_type, asset_id) in items {
        if let Some(existing) = find_existing_asset(state, tenant_id, &url, asset_id).await? {
            if existing.content_id != Some(content_id) {
                let mut active: MediaActiveModel = existing.clone().into();
                active.content_id = Set(Some(content_id));
                saved.push(active.update(&state.db).await?);
            } else {
                saved.push(existing);
            }
            continue;
        }

        let media_url = if s3_is_configured(state) {
            url.clone()
        } else {
            if url.starts_with("placeholder://") || url.starts_with("http") {
                url.clone()
            } else {
                tracing::warn!(
                    "S3 storage not configured; using provided URL as-is for content {}",
                    content_id
                );
                url.clone()
            }
        };

        if let Some(linked) = MediaEntity::find()
            .filter(MediaColumn::TenantId.eq(tenant_id))
            .filter(MediaColumn::ContentId.eq(content_id))
            .filter(MediaColumn::MediaUrl.eq(&media_url))
            .one(&state.db)
            .await?
        {
            saved.push(linked);
            continue;
        }

        let now = Utc::now().fixed_offset();
        let asset = MediaActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(tenant_id),
            workspace_id: Set(None),
            content_id: Set(Some(content_id)),
            media_url: Set(media_url),
            media_type: Set(media_type.unwrap_or_else(|| "image".into())),
            name: Set(None),
            tags: Set(None),
            uploaded_by: Set(Some(user_id)),
            file_size_bytes: Set(None),
            width_px: Set(None),
            height_px: Set(None),
            alt_text: Set(None),
            created_at: Set(now),
            ..Default::default()
        }
        .insert(&state.db)
        .await?;

        saved.push(asset);
    }

    Ok(saved)
}

async fn find_existing_asset(
    state: &AppState,
    tenant_id: Uuid,
    url: &str,
    asset_id: Option<Uuid>,
) -> ApiResult<Option<MediaModel>> {
    if let Some(asset_id) = asset_id {
        if let Some(by_id) = MediaEntity::find()
            .filter(MediaColumn::Id.eq(asset_id))
            .filter(MediaColumn::TenantId.eq(tenant_id))
            .one(&state.db)
            .await?
        {
            return Ok(Some(by_id));
        }
    }

    Ok(MediaEntity::find()
        .filter(MediaColumn::TenantId.eq(tenant_id))
        .filter(MediaColumn::MediaUrl.eq(url))
        .one(&state.db)
        .await?)
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<MediaScopedQuery>,
) -> ApiResult<Json<Value>> {
    let asset = MediaEntity::find()
        .filter(MediaColumn::Id.eq(id))
        .filter(MediaColumn::TenantId.eq(query.tenant_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Media not found".into()))?;

    let s3 = S3StorageService::new(state.config.s3.clone());
    let supabase = SupabaseStorageService::new(state.config.supabase.clone());

    if s3.is_enabled() && s3.is_s3_url(&asset.media_url) {
        let storage_path = asset.tags.as_ref().and_then(|tags| {
            tags.iter()
                .find_map(|tag| tag.strip_prefix("storage_path:").map(str::to_string))
        });
        let delete_result = if let Some(path) = storage_path {
            s3.delete_object(&path).await
        } else {
            s3.delete_by_public_url(&asset.media_url).await
        };
        if let Err(err) = delete_result {
            tracing::warn!(
                media_id = %asset.id,
                media_url = %asset.media_url,
                error = %err,
                "Failed to delete S3 media object"
            );
        }
    } else if supabase.is_enabled() && supabase.is_supabase_url(&asset.media_url) {
        let storage_path = asset
            .tags
            .as_ref()
            .and_then(|tags| {
                tags.iter()
                    .find_map(|tag| tag.strip_prefix("storage_path:").map(str::to_string))
            });
        if let Some(path) = storage_path {
            if let Err(err) = supabase.delete_object(&path).await {
                tracing::warn!(
                    media_id = %asset.id,
                    storage_path = %path,
                    error = %err,
                    "Failed to delete Supabase media object"
                );
            }
        }
    }

    let result = MediaEntity::delete_by_id(asset.id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("Media not found".into()));
    }

    Ok(Json(json!({ "deleted": true })))
}

pub fn media_json(asset: &MediaModel) -> Value {
    json!({
        "id": asset.id,
        "tenantId": asset.tenant_id,
        "workspaceId": asset.workspace_id,
        "contentId": asset.content_id,
        "mediaUrl": asset.media_url,
        "mediaType": asset.media_type,
        "name": asset.name,
        "tags": asset.tags,
        "uploadedBy": asset.uploaded_by,
        "fileSizeBytes": asset.file_size_bytes,
        "widthPx": asset.width_px,
        "heightPx": asset.height_px,
        "altText": asset.alt_text,
        "created_at": asset.created_at,
    })
}
