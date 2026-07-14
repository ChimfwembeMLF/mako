pub mod dto;
pub mod entity;
pub mod schedule;
pub mod timetz;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use sea_orm::{
    sea_query::Expr, ActiveModelTrait, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, Set,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::brand_profiles::entity::{
    Column as BrandProfileColumn, Entity as BrandProfileEntity,
};
use crate::modules::content_items::dto::{
    AttachMediaDto, BulkDeleteDto, CreateContentItemDto, UpdateContentItemDto,
};
use crate::modules::content_items::entity::{
    ActiveModel as ContentItemActiveModel, Column as ContentItemColumn,
    Entity as ContentItemEntity, Model as ContentItemModel,
};
use crate::modules::content_publications::entity::{
    Column as PublicationColumn, Entity as PublicationEntity,
};
use crate::modules::content_items::schedule::{
    format_scheduled_time, parse_scheduled_time_str,
};
use crate::modules::media::{self, entity::Column as MediaColumn, entity::Entity as MediaEntity};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/bulk-delete", post(bulk_delete))
        .route("/{id}/details", get(get_details))
        .route("/{id}/media", post(attach_media))
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct ContentItemListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
    page: Option<u64>,
    limit: Option<u64>,
    search: Option<String>,
    platform: Option<String>,
}

async fn create(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(mut payload): Json<CreateContentItemDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    payload.user_id = Some(payload.user_id.unwrap_or(user_id));

    if payload.brand_profile_id.is_none() {
        payload.brand_profile_id = resolve_brand_profile_id(
            &state,
            payload.tenant_id,
            payload.user_id.unwrap(),
            Some(payload.workspace_id),
        )
        .await?;
    }

    let now = Utc::now().fixed_offset();
    let platform_payloads = normalize_platform_payloads(payload.platform_payloads);

    let item = ContentItemActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        workspace_id: Set(payload.workspace_id),
        user_id: Set(payload.user_id.unwrap()),
        brand_profile_id: Set(payload.brand_profile_id),
        content_type: Set(payload.content_type),
        title: Set(payload.title),
        content: Set(payload.content),
        campaign_theme: Set(payload.campaign_theme),
        campaign_id: Set(None),
        status: Set(payload.status),
        platforms: Set(payload.platforms),
        platform_payloads: Set(platform_payloads),
        scheduled_date: Set(payload.scheduled_date),
        scheduled_time: Set(parse_scheduled_time_str(payload.scheduled_time)),
        published_at: Set(payload.published_at),
        external_post_id: Set(payload.external_post_id),
        publish_failed_reason: Set(payload.publish_failed_reason),
        publish_attempts: Set(0),
        deleted_at: Set(payload.deleted_at),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(content_item_json(&item)))
}

async fn find_all(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ContentItemListQuery>,
) -> ApiResult<Json<Value>> {
    let paginated = query.page.is_some()
        || query.limit.is_some()
        || query
            .search
            .as_ref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false)
        || query
            .platform
            .as_ref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);

    if paginated {
        let page = query.page.unwrap_or(1).max(1);
        let limit = query.limit.unwrap_or(6).clamp(1, 50);
        let skip = (page - 1) * limit;

        let mut db_query = ContentItemEntity::find().order_by_desc(ContentItemColumn::CreatedAt);

        if let Some(tenant_id) = query.tenant_id {
            db_query = db_query.filter(ContentItemColumn::TenantId.eq(tenant_id));
        }
        db_query = db_query.filter(ContentItemColumn::UserId.eq(user_id));

        if let Some(workspace_id) = query.workspace_id {
            db_query = db_query.filter(ContentItemColumn::WorkspaceId.eq(workspace_id));
        }
        if let Some(search) = query.search.as_ref().and_then(|s| {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }) {
            db_query = db_query.filter(ContentItemColumn::Title.contains(search));
        }
        if let Some(platform) = query.platform.as_ref().and_then(|s| {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }) {
            db_query = db_query.filter(Expr::cust_with_values("? = ANY(platforms)", [platform]));
        }

        let paginator = db_query.paginate(&state.db, limit);
        let total = paginator.num_items().await?;
        let rows = paginator.fetch_page(skip / limit).await?;
        let total_pages = ((total as f64) / (limit as f64)).ceil().max(1.0) as u64;

        return Ok(Json(json!({
            "items": rows.iter().map(content_item_json).collect::<Vec<_>>(),
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": total_pages,
        })));
    }

    let mut db_query = ContentItemEntity::find().order_by_desc(ContentItemColumn::CreatedAt);

    if let Some(tenant_id) = query.tenant_id {
        db_query = db_query.filter(ContentItemColumn::TenantId.eq(tenant_id));
    }
    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(ContentItemColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(content_item_json)
        .collect::<Vec<_>>())))
}

async fn get_details(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let item = find_one_model(&state, id).await?;
    let publications = PublicationEntity::find()
        .filter(PublicationColumn::ContentId.eq(id))
        .order_by_desc(PublicationColumn::CreatedAt)
        .all(&state.db)
        .await?;
    let media = MediaEntity::find()
        .filter(MediaColumn::ContentId.eq(id))
        .filter(MediaColumn::TenantId.eq(item.tenant_id))
        .order_by_asc(MediaColumn::CreatedAt)
        .all(&state.db)
        .await?;

    Ok(Json(json!({
        "item": content_item_json(&item),
        "publications": publications
            .iter()
            .map(crate::modules::content_publications::publication_json)
            .collect::<Vec<_>>(),
        "media": media.iter().map(media::media_json).collect::<Vec<_>>(),
    })))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let item = find_one_model(&state, id).await?;
    Ok(Json(content_item_json(&item)))
}

async fn update(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(mut payload): Json<UpdateContentItemDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    payload.user_id = Some(payload.user_id.unwrap_or(user_id));

    if payload.brand_profile_id.is_none() {
        if let Some(tenant_id) = payload.tenant_id {
            payload.brand_profile_id = resolve_brand_profile_id(
                &state,
                tenant_id,
                payload.user_id.unwrap(),
                payload.workspace_id,
            )
            .await?;
        }
    }

    let existing = find_one_model(&state, id).await?;
    let mut active: ContentItemActiveModel = existing.into();

    if let Some(tenant_id) = payload.tenant_id {
        active.tenant_id = Set(tenant_id);
    }
    if let Some(workspace_id) = payload.workspace_id {
        active.workspace_id = Set(workspace_id);
    }
    if let Some(user_id) = payload.user_id {
        active.user_id = Set(user_id);
    }
    if let Some(brand_profile_id) = payload.brand_profile_id {
        active.brand_profile_id = Set(Some(brand_profile_id));
    }
    if let Some(content_type) = payload.content_type {
        active.content_type = Set(content_type);
    }
    if let Some(title) = payload.title {
        active.title = Set(title);
    }
    if let Some(content) = payload.content {
        active.content = Set(content);
    }
    if let Some(campaign_theme) = payload.campaign_theme {
        active.campaign_theme = Set(Some(campaign_theme));
    }
    if let Some(status) = payload.status {
        active.status = Set(Some(status));
    }
    if let Some(platforms) = payload.platforms {
        active.platforms = Set(Some(platforms));
    }
    if let Some(platform_payloads) = payload.platform_payloads {
        active.platform_payloads = Set(normalize_platform_payloads(Some(platform_payloads)));
    }
    if let Some(scheduled_date) = payload.scheduled_date {
        active.scheduled_date = Set(Some(scheduled_date));
    }
    if let Some(scheduled_time) = payload.scheduled_time {
        active.scheduled_time = Set(parse_scheduled_time_str(Some(scheduled_time)));
    }
    if let Some(published_at) = payload.published_at {
        active.published_at = Set(Some(published_at));
    }
    if let Some(external_post_id) = payload.external_post_id {
        active.external_post_id = Set(Some(external_post_id));
    }
    if let Some(publish_failed_reason) = payload.publish_failed_reason {
        active.publish_failed_reason = Set(Some(publish_failed_reason));
    }
    if let Some(deleted_at) = payload.deleted_at {
        active.deleted_at = Set(Some(deleted_at));
    }
    active.updated_at = Set(Utc::now().fixed_offset());

    let updated = active.update(&state.db).await?;
    Ok(Json(content_item_json(&updated)))
}

async fn attach_media(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AttachMediaDto>,
) -> ApiResult<Json<Value>> {
    let _ = find_one_model(&state, id).await?;

    let items = payload
        .items
        .into_iter()
        .map(|item| (item.url, item.media_type, item.asset_id))
        .collect();

    let saved = media::attach_to_content(&state, payload.tenant_id, id, items, user_id).await?;
    Ok(Json(json!(saved
        .iter()
        .map(media::media_json)
        .collect::<Vec<_>>())))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let result = ContentItemEntity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("ContentItems not found".into()));
    }
    Ok(Json(json!({ "success": true })))
}

async fn bulk_delete(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<BulkDeleteDto>,
) -> ApiResult<Json<Value>> {
    if payload.ids.is_empty() {
        return Ok(Json(json!({ "success": true, "affected": 0 })));
    }

    let mut affected = 0u64;
    for id in payload.ids {
        let result = ContentItemEntity::delete_by_id(id).exec(&state.db).await?;
        affected += result.rows_affected;
    }

    Ok(Json(json!({ "success": true, "affected": affected })))
}

async fn find_one_model(state: &AppState, id: Uuid) -> ApiResult<ContentItemModel> {
    ContentItemEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("ContentItems not found".into()))
}

async fn resolve_brand_profile_id(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<Option<Uuid>> {
    if let Some(workspace_id) = workspace_id {
        let profile = BrandProfileEntity::find()
            .filter(BrandProfileColumn::WorkspaceId.eq(workspace_id))
            .filter(BrandProfileColumn::TenantId.eq(tenant_id))
            .one(&state.db)
            .await?;
        return Ok(profile.map(|row| row.id));
    }

    let profile = BrandProfileEntity::find()
        .filter(BrandProfileColumn::TenantId.eq(tenant_id))
        .filter(BrandProfileColumn::UserId.eq(user_id))
        .filter(BrandProfileColumn::WorkspaceId.is_null())
        .one(&state.db)
        .await?;

    Ok(profile.map(|row| row.id))
}

fn normalize_platform_payloads(value: Option<Value>) -> Option<sea_orm::prelude::Json> {
    let raw = value?;
    if raw.is_string() {
        let parsed: Result<Value, _> = serde_json::from_str(raw.as_str().unwrap_or_default());
        return parsed.ok().map(Into::into);
    }
    Some(raw.into())
}

pub fn content_item_json(item: &ContentItemModel) -> Value {
    json!({
        "id": item.id,
        "tenantId": item.tenant_id,
        "workspaceId": item.workspace_id,
        "userId": item.user_id,
        "brandProfileId": item.brand_profile_id,
        "contentType": item.content_type,
        "title": item.title,
        "content": item.content,
        "campaignTheme": item.campaign_theme,
        "campaignId": item.campaign_id,
        "status": item.status,
        "platforms": item.platforms,
        "platformPayloads": item.platform_payloads,
        "scheduledDate": item.scheduled_date,
        "scheduledTime": format_scheduled_time(item.scheduled_time.as_ref()),
        "publishedAt": item.published_at,
        "externalPostId": item.external_post_id,
        "publishFailedReason": item.publish_failed_reason,
        "publishAttempts": item.publish_attempts,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "deleted_at": item.deleted_at,
    })
}
