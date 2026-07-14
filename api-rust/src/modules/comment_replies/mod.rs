pub mod ai;
pub mod auto_reply;
pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use reqwest::Client;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::comment_replies::dto::{
    CreateCommentReplyDto, FetchCommentsDto, SendCommentReplyDto, UpdateCommentReplyDto,
};
use crate::modules::comment_replies::entity::{
    ActiveModel as ReplyActiveModel, Column as ReplyColumn, Entity as ReplyEntity,
    Model as ReplyModel,
};
use crate::modules::content_publications::entity::{
    Column as PublicationColumn, Entity as PublicationEntity,
};
use crate::modules::queues::dispatch::QueueDispatch;
use crate::modules::social_accounts::entity::{
    Column as SocialAccountColumn, Entity as SocialAccountEntity, Model as SocialAccountModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/fetch", post(fetch_comments))
        .route("/inbox", get(get_inbox))
        .route("/{id}/suggest", post(suggest_reply))
        .route("/{id}/send", post(send_reply))
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct InboxQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "contentId")]
    content_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

async fn fetch_comments(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(dto): Json<FetchCommentsDto>,
) -> ApiResult<Json<Value>> {
    dto
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let job_payload = json!({
        "tenantId": dto.tenant_id,
        "workspaceId": dto.workspace_id,
        "runAutoReply": true,
    });
    if QueueDispatch::is_enabled(&state.config) {
        let job_id =
            QueueDispatch::enqueue_sync_tenant_comments(&state, user_id, job_payload).await;
        return Ok(Json(json!({
            "queued": true,
            "jobId": job_id,
            "tenantId": dto.tenant_id,
        })));
    }

    let (fetched, _) =
        sync_tenant_comments(&state, dto.tenant_id, user_id, dto.workspace_id, true).await?;

    Ok(Json(json!({
        "fetched": fetched,
        "tenantId": dto.tenant_id,
        "userId": user_id,
        "workspaceId": dto.workspace_id,
    })))
}

async fn suggest_reply(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let _ = ReplyEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Comment reply not found".into()))?;

    let job_payload = json!({ "commentReplyId": id });
    if QueueDispatch::is_enabled(&state.config) {
        let (job_id, queue) =
            QueueDispatch::enqueue_ai_task(&state, "suggest-comment-reply", user_id, job_payload)
                .await;
        return Ok(Json(json!({ "queued": true, "jobId": job_id, "queue": queue })));
    }

    let content = ai::suggest_reply(&state, id, user_id).await?;
    Ok(Json(json!({ "content": content })))
}

async fn send_reply(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SendCommentReplyDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let _existing = ReplyEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Comment reply not found".into()))?;

    let sent = send_comment_reply(
        &state,
        id,
        user_id,
        payload.message.trim(),
        None,
        None,
    )
    .await?;

    let updated = ReplyEntity::find_by_id(id).one(&state.db).await?.unwrap();
    Ok(Json(json!({
        "sent": sent,
        "userId": user_id,
        "commentReply": reply_json(&updated),
    })))
}

async fn create(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateCommentReplyDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let now = Utc::now().fixed_offset();
    let row = ReplyActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        content_id: Set(payload.content_id),
        platform: Set(payload.platform),
        external_comment_id: Set(payload.external_comment_id),
        external_post_id: Set(payload.external_post_id),
        commenter_name: Set(payload.commenter_name),
        commenter_avatar_url: Set(payload.commenter_avatar_url),
        comment_text: Set(payload.comment_text),
        reply_text: Set(payload.reply_text),
        reply_type: Set(payload.reply_type),
        status: Set(payload.status),
        rule_id: Set(payload.rule_id),
        sent_at: Set(payload.sent_at),
        parent_comment_id: Set(payload.parent_comment_id),
        like_count: Set(0),
        is_from_brand: Set(false),
        attachments: Set(json!([])),
        reactions: Set(json!([])),
        created_at: Set(payload.created_at.unwrap_or(now)),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(reply_json(&row)))
}

async fn get_inbox(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<InboxQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = ReplyEntity::find()
        .filter(ReplyColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(ReplyColumn::CreatedAt);

    if let Some(content_id) = query.content_id {
        db_query = db_query.filter(ReplyColumn::ContentId.eq(content_id));
    }

    let rows = db_query.all(&state.db).await?;
    let posts = group_inbox_posts(&rows);

    Ok(Json(json!({ "posts": posts })))
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = ReplyEntity::find().order_by_desc(ReplyColumn::CreatedAt);

    if let Some(tenant_id) = query.tenant_id {
        db_query = db_query.filter(ReplyColumn::TenantId.eq(tenant_id));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows.iter().map(reply_json).collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let row = ReplyEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Comment reply not found".into()))?;

    Ok(Json(reply_json(&row)))
}

async fn update(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCommentReplyDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = ReplyEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Comment reply not found".into()))?;

    let mut active: ReplyActiveModel = existing.into();

    if let Some(v) = payload.tenant_id {
        active.tenant_id = Set(v);
    }
    if let Some(v) = payload.content_id {
        active.content_id = Set(v);
    }
    if let Some(v) = payload.platform {
        active.platform = Set(v);
    }
    if let Some(v) = payload.external_comment_id {
        active.external_comment_id = Set(v);
    }
    if let Some(v) = payload.external_post_id {
        active.external_post_id = Set(v);
    }
    if let Some(v) = payload.commenter_name {
        active.commenter_name = Set(v);
    }
    if let Some(v) = payload.commenter_avatar_url {
        active.commenter_avatar_url = Set(Some(v));
    }
    if let Some(v) = payload.comment_text {
        active.comment_text = Set(v);
    }
    if let Some(v) = payload.reply_text {
        active.reply_text = Set(Some(v));
    }
    if let Some(v) = payload.reply_type {
        active.reply_type = Set(Some(v));
    }
    if let Some(v) = payload.status {
        active.status = Set(Some(v));
    }
    if let Some(v) = payload.rule_id {
        active.rule_id = Set(Some(v));
    }
    if let Some(v) = payload.sent_at {
        active.sent_at = Set(Some(v));
    }
    if let Some(v) = payload.parent_comment_id {
        active.parent_comment_id = Set(Some(v));
    }
    if let Some(v) = payload.created_at {
        active.created_at = Set(v);
    }

    let updated = active.update(&state.db).await?;
    Ok(Json(reply_json(&updated)))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let result = ReplyEntity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("Comment reply not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

fn group_inbox_posts(rows: &[ReplyModel]) -> Vec<Value> {
    use std::collections::HashMap;

    let mut by_content: HashMap<Uuid, Vec<&ReplyModel>> = HashMap::new();
    for row in rows {
        by_content.entry(row.content_id).or_default().push(row);
    }

    let mut posts: Vec<Value> = by_content
        .into_iter()
        .map(|(content_id, comments)| {
            let platform = comments
                .first()
                .map(|c| c.platform.clone())
                .unwrap_or_default();
            let pending_count = comments
                .iter()
                .filter(|c| c.status.as_deref() == Some("pending"))
                .count();

            json!({
                "key": content_id,
                "contentId": content_id,
                "platform": platform,
                "postTitle": format!("Post {content_id}"),
                "postContent": "",
                "totalComments": comments.len(),
                "pendingCount": pending_count,
                "comments": comments.iter().map(|c| reply_json(c)).collect::<Vec<_>>(),
            })
        })
        .collect();

    posts.sort_by(|a, b| {
        let a_count = a.get("totalComments").and_then(|v| v.as_u64()).unwrap_or(0);
        let b_count = b.get("totalComments").and_then(|v| v.as_u64()).unwrap_or(0);
        b_count.cmp(&a_count)
    });

    posts
}

fn reply_json(row: &ReplyModel) -> Value {
    json!({
        "id": row.id,
        "tenantId": row.tenant_id,
        "contentId": row.content_id,
        "platform": row.platform,
        "externalCommentId": row.external_comment_id,
        "externalPostId": row.external_post_id,
        "commenterName": row.commenter_name,
        "commenterAvatarUrl": row.commenter_avatar_url,
        "commentText": row.comment_text,
        "replyText": row.reply_text,
        "replyType": row.reply_type,
        "status": row.status,
        "ruleId": row.rule_id,
        "sentAt": row.sent_at,
        "parentCommentId": row.parent_comment_id,
        "likeCount": row.like_count,
        "isFromBrand": row.is_from_brand,
        "attachments": row.attachments,
        "reactions": row.reactions,
        "created_at": row.created_at,
    })
}

#[derive(Clone)]
struct FetchedComment {
    external_comment_id: String,
    external_post_id: String,
    commenter_name: String,
    comment_text: String,
    parent_comment_id: Option<String>,
    like_count: i32,
    is_from_brand: bool,
}

async fn fetch_comments_for_tenant(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<(usize, Vec<Uuid>)> {
    let mut db_query = PublicationEntity::find()
        .filter(PublicationColumn::TenantId.eq(tenant_id))
        .filter(PublicationColumn::Status.eq("published"))
        .order_by_desc(PublicationColumn::PublishedAt);
    if let Some(workspace_id) = workspace_id {
        db_query = db_query.filter(PublicationColumn::WorkspaceId.eq(workspace_id));
    }
    let publications = db_query.all(&state.db).await?;

    let mut latest_by_platform = std::collections::HashMap::new();
    for pub_row in publications {
        if pub_row.external_post_id.is_none() {
            continue;
        }
        let key = format!("{}:{}", pub_row.content_id, pub_row.platform);
        latest_by_platform.entry(key).or_insert(pub_row);
    }

    let mut fetched = 0usize;
    let mut new_ids = Vec::new();
    for pub_row in latest_by_platform.into_values() {
        let Some(external_post_id) = pub_row.external_post_id.clone() else {
            continue;
        };
        let account = find_social_account(
            state,
            pub_row.tenant_id,
            user_id,
            pub_row.workspace_id,
            &pub_row.platform,
        )
        .await?;
        let Some(account) = account else { continue };
        let comments = pull_comments(&pub_row.platform, &external_post_id, &account).await?;
        for c in comments {
            let exists = ReplyEntity::find()
                .filter(ReplyColumn::TenantId.eq(pub_row.tenant_id))
                .filter(ReplyColumn::ExternalCommentId.eq(c.external_comment_id.clone()))
                .one(&state.db)
                .await?;
            if exists.is_some() {
                continue;
            }
            let row = ReplyActiveModel {
                id: Set(Uuid::new_v4()),
                tenant_id: Set(pub_row.tenant_id),
                content_id: Set(pub_row.content_id),
                platform: Set(pub_row.platform.clone()),
                external_comment_id: Set(c.external_comment_id),
                external_post_id: Set(c.external_post_id),
                commenter_name: Set(c.commenter_name),
                commenter_avatar_url: Set(None),
                comment_text: Set(c.comment_text),
                reply_text: Set(None),
                reply_type: Set(None),
                status: Set(Some(
                    if c.is_from_brand { "sent" } else { "pending" }.into(),
                )),
                rule_id: Set(None),
                sent_at: Set(None),
                parent_comment_id: Set(c.parent_comment_id),
                like_count: Set(c.like_count),
                is_from_brand: Set(c.is_from_brand),
                attachments: Set(json!([])),
                reactions: Set(json!([])),
                created_at: Set(Utc::now().fixed_offset()),
            }
            .insert(&state.db)
            .await?;
            new_ids.push(row.id);
            fetched += 1;
        }
    }
    Ok((fetched, new_ids))
}

async fn pull_comments(
    platform: &str,
    post_id: &str,
    account: &SocialAccountModel,
) -> ApiResult<Vec<FetchedComment>> {
    match platform.to_lowercase().as_str() {
        "facebook" => fetch_facebook_comments(post_id, account).await,
        "instagram" => fetch_instagram_comments(post_id, account).await,
        "linkedin" => fetch_linkedin_comments(post_id, account).await,
        _ => Ok(vec![]),
    }
}

async fn fetch_facebook_comments(
    post_id: &str,
    account: &SocialAccountModel,
) -> ApiResult<Vec<FetchedComment>> {
    let token = page_token_from_account(account).unwrap_or_default();
    if token.trim().is_empty() {
        return Ok(vec![]);
    }
    let client = Client::new();
    let url = format!(
        "https://graph.facebook.com/v19.0/{}/comments",
        urlencoding::encode(post_id)
    );
    let resp = client
        .get(url)
        .query(&[
            (
                "fields",
                "id,message,from,like_count,comments{id,message,from,like_count}",
            ),
            ("limit", "50"),
            ("access_token", token.as_str()),
        ])
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;
    let body = resp.json::<Value>().await.unwrap_or(json!({}));
    let comments = body
        .get("data")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = vec![];
    let brand_id = page_id_from_account(account);
    for c in comments {
        let comment_id = c.get("id").and_then(|v| v.as_str()).unwrap_or_default();
        if comment_id.is_empty() {
            continue;
        }
        let from = c.get("from").cloned().unwrap_or_else(|| json!({}));
        let from_name = from
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Facebook user");
        out.push(FetchedComment {
            external_comment_id: comment_id.to_string(),
            external_post_id: post_id.to_string(),
            commenter_name: from_name.to_string(),
            comment_text: c
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            parent_comment_id: None,
            like_count: c.get("like_count").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            is_from_brand: is_brand_comment(
                from_name,
                from.get("id").and_then(|v| v.as_str()),
                Some(account.account_name.as_str()),
                brand_id.as_deref(),
            ),
        });
    }
    Ok(out)
}

async fn fetch_instagram_comments(
    media_id: &str,
    account: &SocialAccountModel,
) -> ApiResult<Vec<FetchedComment>> {
    let token = page_token_from_account(account).unwrap_or_default();
    if token.trim().is_empty() {
        return Ok(vec![]);
    }
    let client = Client::new();
    let url = format!(
        "https://graph.facebook.com/v19.0/{}/comments",
        urlencoding::encode(media_id)
    );
    let resp = client
        .get(url)
        .query(&[
            ("fields", "id,text,username,from,like_count"),
            ("limit", "50"),
            ("access_token", token.as_str()),
        ])
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;
    let body = resp.json::<Value>().await.unwrap_or(json!({}));
    let comments = body
        .get("data")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = vec![];
    let brand_id = account
        .metadata
        .as_ref()
        .and_then(|m| m.get("instagram_business_account_id"))
        .and_then(|v| v.as_str())
        .or_else(|| account.external_id.as_deref());
    for c in comments {
        let comment_id = c.get("id").and_then(|v| v.as_str()).unwrap_or_default();
        if comment_id.is_empty() {
            continue;
        }
        let from = c.get("from").cloned().unwrap_or_else(|| json!({}));
        let name = from
            .get("username")
            .and_then(|v| v.as_str())
            .or_else(|| c.get("username").and_then(|v| v.as_str()))
            .unwrap_or("Instagram user");
        out.push(FetchedComment {
            external_comment_id: comment_id.to_string(),
            external_post_id: media_id.to_string(),
            commenter_name: name.to_string(),
            comment_text: c
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            parent_comment_id: None,
            like_count: c.get("like_count").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            is_from_brand: is_brand_comment(
                name,
                from.get("id").and_then(|v| v.as_str()),
                account.username.as_deref(),
                brand_id,
            ),
        });
    }
    Ok(out)
}

async fn fetch_linkedin_comments(
    post_urn: &str,
    account: &SocialAccountModel,
) -> ApiResult<Vec<FetchedComment>> {
    let Some(token) = account.access_token.as_deref() else {
        return Ok(vec![]);
    };
    let client = Client::new();
    let url = format!(
        "https://api.linkedin.com/v2/socialActions/{}/comments",
        urlencoding::encode(post_urn)
    );
    let resp = client
        .get(url)
        .header("Authorization", format!("Bearer {token}"))
        .header("X-Restli-Protocol-Version", "2.0.0")
        .query(&[("count", "50")])
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;
    let body = resp.json::<Value>().await.unwrap_or(json!({}));
    let items = body
        .get("elements")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(items
        .into_iter()
        .filter_map(|item| {
            let id = item
                .get("id")
                .and_then(|v| v.as_str())
                .or_else(|| item.get("$URN").and_then(|v| v.as_str()))?;
            let name = item
                .get("actor")
                .and_then(|v| v.as_str())
                .unwrap_or("LinkedIn user");
            let text = item
                .get("message")
                .and_then(|v| v.get("text"))
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            Some(FetchedComment {
                external_comment_id: id.to_string(),
                external_post_id: post_urn.to_string(),
                commenter_name: name.to_string(),
                comment_text: text.to_string(),
                parent_comment_id: None,
                like_count: 0,
                is_from_brand: false,
            })
        })
        .collect())
}

async fn send_platform_comment_reply(
    platform: &str,
    external_comment_id: &str,
    external_post_id: &str,
    parent_comment_id: Option<String>,
    account: &SocialAccountModel,
    message: &str,
) -> ApiResult<()> {
    let client = Client::new();
    match platform.to_lowercase().as_str() {
        "facebook" => {
            let token = page_token_from_account(account).unwrap_or_default();
            let url = format!(
                "https://graph.facebook.com/v20.0/{}/comments",
                urlencoding::encode(external_comment_id)
            );
            let resp = client
                .post(url)
                .query(&[("message", message), ("access_token", token.as_str())])
                .send()
                .await
                .map_err(|e| ApiError::BadRequest(e.to_string()))?;
            let data = resp.json::<Value>().await.unwrap_or(json!({}));
            if data.get("error").is_some() {
                return Err(ApiError::BadRequest(graph_error_summary(&data)));
            }
            Ok(())
        }
        "instagram" => {
            let token = page_token_from_account(account).unwrap_or_default();
            let url = format!(
                "https://graph.facebook.com/v20.0/{}/replies",
                urlencoding::encode(external_comment_id)
            );
            let resp = client
                .post(url)
                .query(&[("message", message), ("access_token", token.as_str())])
                .send()
                .await
                .map_err(|e| ApiError::BadRequest(e.to_string()))?;
            let data = resp.json::<Value>().await.unwrap_or(json!({}));
            if data.get("error").is_some() {
                return Err(ApiError::BadRequest(graph_error_summary(&data)));
            }
            Ok(())
        }
        "linkedin" => {
            let token = account.access_token.clone().unwrap_or_default();
            let url = format!(
                "https://api.linkedin.com/v2/socialActions/{}/comments",
                urlencoding::encode(external_post_id)
            );
            let mut payload = json!({
                "message": { "text": message },
                "object": external_post_id,
            });
            if let Some(parent_comment_id) = parent_comment_id {
                payload["parentComment"] = json!(format!(
                    "urn:li:comment:({},{})",
                    external_post_id, parent_comment_id
                ));
            }
            let resp = client
                .post(url)
                .header("Authorization", format!("Bearer {token}"))
                .header("Content-Type", "application/json")
                .header("X-Restli-Protocol-Version", "2.0.0")
                .json(&payload)
                .send()
                .await
                .map_err(|e| ApiError::BadRequest(e.to_string()))?;
            if !resp.status().is_success() {
                return Err(ApiError::BadRequest(format!(
                    "LinkedIn reply failed with status {}",
                    resp.status()
                )));
            }
            Ok(())
        }
        _ => Err(ApiError::BadRequest(format!(
            "Replies not supported for {platform}"
        ))),
    }
}

async fn find_social_account(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
    platform: &str,
) -> ApiResult<Option<SocialAccountModel>> {
    let mut user_query = SocialAccountEntity::find()
        .filter(SocialAccountColumn::TenantId.eq(tenant_id))
        .filter(SocialAccountColumn::Platform.eq(platform))
        .filter(SocialAccountColumn::Connected.eq(true))
        .filter(SocialAccountColumn::UserId.eq(user_id));
    if let Some(workspace_id) = workspace_id {
        user_query = user_query.filter(SocialAccountColumn::WorkspaceId.eq(workspace_id));
    }
    if let Some(account) = user_query.one(&state.db).await? {
        return Ok(Some(account));
    }
    let mut tenant_query = SocialAccountEntity::find()
        .filter(SocialAccountColumn::TenantId.eq(tenant_id))
        .filter(SocialAccountColumn::Platform.eq(platform))
        .filter(SocialAccountColumn::Connected.eq(true));
    if let Some(workspace_id) = workspace_id {
        tenant_query = tenant_query.filter(SocialAccountColumn::WorkspaceId.eq(workspace_id));
    }
    Ok(tenant_query.one(&state.db).await?)
}

fn page_token_from_account(account: &SocialAccountModel) -> Option<String> {
    account
        .metadata
        .as_ref()
        .and_then(|m| m.get("page_token"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| account.access_token.clone())
}

fn page_id_from_account(account: &SocialAccountModel) -> Option<String> {
    account
        .metadata
        .as_ref()
        .and_then(|m| m.get("page_id"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| account.external_id.clone())
}

fn is_brand_comment(
    from_name: &str,
    from_id: Option<&str>,
    brand_name: Option<&str>,
    brand_id: Option<&str>,
) -> bool {
    if let (Some(from_id), Some(brand_id)) = (from_id, brand_id) {
        if from_id == brand_id {
            return true;
        }
    }
    if let Some(brand_name) = brand_name {
        return from_name.eq_ignore_ascii_case(brand_name);
    }
    false
}

pub async fn sync_tenant_comments(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
    run_auto_reply: bool,
) -> ApiResult<(usize, usize)> {
    let (fetched, new_ids) =
        fetch_comments_for_tenant(state, tenant_id, user_id, workspace_id).await?;
    let mut auto_sent = 0usize;
    if run_auto_reply {
        let (sent, _) = auto_reply::process_new_comments(state, &new_ids, user_id).await?;
        auto_sent += sent;
        let (sent_pending, _) =
            auto_reply::process_pending_for_tenant(state, tenant_id, user_id, workspace_id).await?;
        auto_sent += sent_pending;
    }
    Ok((fetched, auto_sent))
}

#[allow(dead_code)]
pub async fn comment_sync_for_tenant(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<usize> {
    let (fetched, _) = sync_tenant_comments(state, tenant_id, user_id, workspace_id, true).await?;
    Ok(fetched)
}

pub async fn send_comment_reply(
    state: &AppState,
    comment_id: Uuid,
    user_id: Uuid,
    message: &str,
    reply_type: Option<&str>,
    rule_id: Option<Uuid>,
) -> ApiResult<bool> {
    let existing = ReplyEntity::find_by_id(comment_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Comment reply not found".into()))?;

    let platform = existing.platform.clone();
    let external_comment_id = existing.external_comment_id.clone();
    let external_post_id = existing.external_post_id.clone();
    let parent_comment_id = existing.parent_comment_id.clone();

    let account =
        find_social_account(state, existing.tenant_id, user_id, None, &platform).await?;
    let Some(account) = account else {
        return Err(ApiError::BadRequest(format!(
            "No connected {} account for this tenant",
            existing.platform
        )));
    };

    match send_platform_comment_reply(
        &platform,
        &external_comment_id,
        &external_post_id,
        parent_comment_id,
        &account,
        message,
    )
    .await
    {
        Ok(()) => {
            auto_reply::mark_sent(state, comment_id, message, reply_type, rule_id).await?;
            Ok(true)
        }
        Err(err) => {
            let mut active: ReplyActiveModel = existing.into();
            active.status = Set(Some("failed".into()));
            active.update(&state.db).await?;
            tracing::warn!(comment_id = %comment_id, error = %err, "Comment reply send failed");
            Ok(false)
        }
    }
}

fn graph_error_summary(data: &Value) -> String {
    let code = data
        .get("error")
        .and_then(|e| e.get("code"))
        .and_then(|v| v.as_i64())
        .map(|v| format!("#{v} "))
        .unwrap_or_default();
    let message = data
        .get("error")
        .and_then(|e| e.get("message"))
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown Graph API error");
    format!("{code}{message}")
}
