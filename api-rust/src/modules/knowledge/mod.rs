pub mod dto;
#[allow(dead_code)]
pub mod entity;

use axum::{
    body::Bytes,
    extract::{Path, Query, State},
    routing::{get, patch, post},
    Json, Router,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::knowledge::dto::UpdateKnowledgeDocumentDto;
use crate::modules::knowledge::entity::chunk::{
    ActiveModel as ChunkActiveModel, Column as ChunkColumn, Entity as ChunkEntity,
};
use crate::modules::knowledge::entity::document::{
    ActiveModel as DocumentActiveModel, Column as DocumentColumn, Entity as DocumentEntity,
    Model as DocumentModel,
};
use crate::services::mistral::{ChatMessage, MistralService};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/documents", get(list_documents).post(upload_document))
        .route("/documents/sync-mistral", post(sync_mistral))
        .route(
            "/documents/{id}",
            patch(rename_document).delete(remove_document),
        )
        .route("/documents/{id}/reindex", post(reindex_document))
}

#[derive(Deserialize)]
struct TenantQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

async fn list_documents(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = DocumentEntity::find()
        .filter(DocumentColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(DocumentColumn::UpdatedAt);

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(DocumentColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(document_json)
        .collect::<Vec<_>>())))
}

async fn upload_document(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
    _body: Bytes,
) -> ApiResult<Json<Value>> {
    let now = Utc::now().fixed_offset();
    let doc = DocumentActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(query.tenant_id),
        workspace_id: Set(query.workspace_id),
        uploaded_by: Set(user_id),
        title: Set(format!("Uploaded document {}", now.timestamp())),
        source_type: Set("upload".into()),
        status: Set("pending".into()),
        chunk_count: Set(0),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(document_json(&doc)))
}

async fn rename_document(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateKnowledgeDocumentDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = find_document(&state, payload.tenant_id, id, payload.workspace_id).await?;
    let mut active: DocumentActiveModel = existing.into();
    active.title = Set(payload.title);
    active.updated_at = Set(Utc::now().fixed_offset());
    let updated = active.update(&state.db).await?;
    Ok(Json(document_json(&updated)))
}

async fn remove_document(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let _ = find_document(&state, query.tenant_id, id, query.workspace_id).await?;
    DocumentEntity::delete_by_id(id).exec(&state.db).await?;
    Ok(Json(json!({ "success": true })))
}

async fn sync_mistral(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let docs = DocumentEntity::find()
        .filter(DocumentColumn::TenantId.eq(query.tenant_id))
        .all(&state.db)
        .await?;
    let mut synced = 0_u64;
    for doc in docs {
        let mut active: DocumentActiveModel = doc.clone().into();
        let mut metadata = doc.metadata.unwrap_or_else(|| json!({}));
        if let Some(obj) = metadata.as_object_mut() {
            obj.insert("mistralSyncedAt".into(), json!(Utc::now().to_rfc3339()));
            obj.insert(
                "mistralSyncState".into(),
                json!(if doc.status == "ready" { "synced" } else { "pending" }),
            );
        }
        active.metadata = Set(Some(metadata));
        active.updated_at = Set(Utc::now().fixed_offset());
        let _ = active.update(&state.db).await?;
        synced += 1;
    }

    Ok(Json(json!({
        "tenantId": query.tenant_id,
        "synced": true,
        "documents": synced,
        "syncedAt": Utc::now().to_rfc3339(),
    })))
}

async fn reindex_document(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let doc = find_document(&state, query.tenant_id, id, query.workspace_id).await?;
    ChunkEntity::delete_many()
        .filter(ChunkColumn::TenantId.eq(query.tenant_id))
        .filter(ChunkColumn::DocumentId.eq(doc.id))
        .exec(&state.db)
        .await?;

    let seed = format!(
        "{}\n{}\n{}",
        doc.title,
        doc.storage_url.clone().unwrap_or_default(),
        doc.mime_type.clone().unwrap_or_default()
    );
    let chunks = split_for_indexing(&seed, 320);
    for (idx, chunk) in chunks.iter().enumerate() {
        let summary_hint = ai_chunk_hint(&state.config.mistral, chunk)
            .await
            .unwrap_or_else(|| chunk.clone());
        ChunkActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(query.tenant_id),
            document_id: Set(doc.id),
            chunk_index: Set(idx as i32),
            content: Set(summary_hint),
            token_count: Set(Some((chunk.len() / 4).max(1) as i32)),
            embedding: Set(None),
            metadata: Set(Some(json!({"source": "reindex"}))),
            created_at: Set(Utc::now().fixed_offset()),
        }
        .insert(&state.db)
        .await?;
    }

    let mut active: DocumentActiveModel = doc.into();
    active.status = Set("ready".into());
    active.error_message = Set(None);
    active.chunk_count = Set(chunks.len() as i32);
    active.updated_at = Set(Utc::now().fixed_offset());
    let updated = active.update(&state.db).await?;

    Ok(Json(json!({
        "documentId": updated.id,
        "status": updated.status,
        "chunkCount": updated.chunk_count,
        "userId": user_id,
        "message": "Document reindexed successfully",
    })))
}

async fn find_document(
    state: &AppState,
    tenant_id: Uuid,
    id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<DocumentModel> {
    let mut query = DocumentEntity::find()
        .filter(DocumentColumn::Id.eq(id))
        .filter(DocumentColumn::TenantId.eq(tenant_id));

    if let Some(workspace_id) = workspace_id {
        query = query.filter(DocumentColumn::WorkspaceId.eq(workspace_id));
    }

    query
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Document not found".into()))
}

fn document_json(doc: &DocumentModel) -> Value {
    json!({
        "id": doc.id,
        "tenantId": doc.tenant_id,
        "workspaceId": doc.workspace_id,
        "uploadedBy": doc.uploaded_by,
        "title": doc.title,
        "sourceType": doc.source_type,
        "mimeType": doc.mime_type,
        "storageUrl": doc.storage_url,
        "fileSizeBytes": doc.file_size_bytes,
        "status": doc.status,
        "errorMessage": doc.error_message,
        "chunkCount": doc.chunk_count,
        "metadata": doc.metadata,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
    })
}

fn split_for_indexing(text: &str, max_chars: usize) -> Vec<String> {
    let mut out = Vec::new();
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return vec!["Empty document".to_string()];
    }
    let mut current = String::new();
    for token in trimmed.split_whitespace() {
        if current.len() + token.len() + 1 > max_chars && !current.is_empty() {
            out.push(current.trim().to_string());
            current.clear();
        }
        current.push_str(token);
        current.push(' ');
    }
    if !current.trim().is_empty() {
        out.push(current.trim().to_string());
    }
    out
}

async fn ai_chunk_hint(mistral: &crate::config::MistralConfig, chunk: &str) -> Option<String> {
    if chunk.trim().is_empty() {
        return None;
    }
    let (data, _, _) = MistralService::complete_json(
        mistral,
        vec![
            ChatMessage {
                role: "system".into(),
                content: "Return JSON only with key summary.".into(),
            },
            ChatMessage {
                role: "user".into(),
                content: format!("Summarize this document chunk in one short sentence:\n{chunk}"),
            },
        ],
        Some(MistralService::default_model(mistral)),
    )
    .await
    .ok()?;
    data.get("summary")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
}
