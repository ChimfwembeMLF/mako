#[allow(dead_code)]
pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::ApiResult;
use crate::modules::content_publications::dto::SyncEngagementDto;
use crate::modules::content_publications::entity::{
    Column as PublicationColumn, Entity as PublicationEntity, Model as PublicationModel,
};
use crate::modules::content_publishing::engagement::PublicationEngagementService;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/content/{content_id}", get(find_by_content))
        .route("/top-performing", get(top_performing))
        .route("/sync-engagement", post(sync_engagement))
        .route("/", get(find_all))
}

#[derive(Deserialize)]
struct PublicationListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct TopPerformingQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    limit: Option<u64>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<PublicationListQuery>,
) -> ApiResult<Json<Value>> {
    let Some(tenant_id) = query.tenant_id else {
        return Ok(Json(json!([])));
    };

    let mut db_query = PublicationEntity::find()
        .filter(PublicationColumn::TenantId.eq(tenant_id))
        .filter(PublicationColumn::Status.eq("published"))
        .order_by_desc(PublicationColumn::PublishedAt);

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(PublicationColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(publication_json)
        .collect::<Vec<_>>())))
}

async fn find_by_content(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(content_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let rows = PublicationEntity::find()
        .filter(PublicationColumn::ContentId.eq(content_id))
        .order_by_desc(PublicationColumn::CreatedAt)
        .all(&state.db)
        .await?;

    Ok(Json(json!(rows
        .iter()
        .map(publication_json)
        .collect::<Vec<_>>())))
}

async fn top_performing(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TopPerformingQuery>,
) -> ApiResult<Json<Value>> {
    let limit = query.limit.unwrap_or(5).min(20);

    let mut db_query = PublicationEntity::find()
        .filter(PublicationColumn::TenantId.eq(query.tenant_id))
        .filter(PublicationColumn::Status.eq("published"))
        .order_by_desc(PublicationColumn::EngagementScore)
        .order_by_desc(PublicationColumn::PublishedAt);

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(PublicationColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    let filtered: Vec<Value> = rows
        .into_iter()
        .filter(|row| row.engagement_score > 0 || row.like_count > 0 || row.comment_count > 0)
        .take(limit as usize)
        .map(top_performing_json)
        .collect();

    Ok(Json(json!(filtered)))
}

async fn sync_engagement(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<SyncEngagementDto>,
) -> ApiResult<Json<Value>> {
    let updated = PublicationEngagementService::sync_for_tenant(
        &state,
        payload.tenant_id,
        id,
        payload.workspace_id,
    )
    .await?;

    Ok(Json(json!({ "updated": updated })))
}

pub fn publication_json(publication: &PublicationModel) -> Value {
    json!({
        "id": publication.id,
        "tenantId": publication.tenant_id,
        "workspaceId": publication.workspace_id,
        "contentId": publication.content_id,
        "userId": publication.user_id,
        "platform": publication.platform,
        "externalPostId": publication.external_post_id,
        "publishedContent": publication.published_content,
        "publishedTitle": publication.published_title,
        "publishedMedia": publication.published_media,
        "socialAccountId": publication.social_account_id,
        "status": publication.status,
        "errorMessage": publication.error_message,
        "publishedAt": publication.published_at,
        "likeCount": publication.like_count,
        "commentCount": publication.comment_count,
        "shareCount": publication.share_count,
        "viewCount": publication.view_count,
        "engagementScore": publication.engagement_score,
        "engagementSyncedAt": publication.engagement_synced_at,
        "created_at": publication.created_at,
        "updated_at": publication.updated_at,
    })
}

fn top_performing_json(publication: PublicationModel) -> Value {
    json!({
        "id": publication.id,
        "contentId": publication.content_id,
        "platform": publication.platform,
        "publishedTitle": publication.published_title,
        "publishedContent": strip_html(&publication.published_content)
            .chars()
            .take(400)
            .collect::<String>(),
        "likeCount": publication.like_count,
        "commentCount": publication.comment_count,
        "shareCount": publication.share_count,
        "viewCount": publication.view_count,
        "engagementScore": publication.engagement_score,
        "publishedAt": publication.published_at,
    })
}

fn strip_html(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }
    result.split_whitespace().collect::<Vec<_>>().join(" ")
}
