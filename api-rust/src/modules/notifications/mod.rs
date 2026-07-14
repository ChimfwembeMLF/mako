pub mod cron_service;
pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, Query, State},
    routing::{get, patch, post},
    Json, Router,
};
use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder, Set,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::ai_usage::entity::{Column as AiUsageColumn, Entity as AiUsageEntity};
use crate::modules::chatbot::entity::config::{Column as ChatbotConfigColumn, Entity as ChatbotConfigEntity};
use crate::modules::chatbot::entity::message::{Column as ChatMessageColumn, Entity as ChatMessageEntity};
use crate::modules::chatbot::entity::session::{Column as ChatSessionColumn, Entity as ChatSessionEntity};
use crate::modules::content_items::entity::{Column as ContentItemColumn, Entity as ContentItemEntity};
use crate::modules::content_publications::entity::{
    Column as PublicationColumn, Entity as PublicationEntity,
};
use crate::modules::deposits::entity::{Column as DepositColumn, Entity as DepositEntity};
use crate::modules::leads::entity::{Column as LeadColumn, Entity as LeadEntity};
use crate::modules::payments::entity::{Column as RefundColumn, Entity as RefundEntity};
use crate::modules::subscriptions::entity::{Column as SubscriptionColumn, Entity as SubscriptionEntity};
use crate::modules::notifications::dto::{MarkAllReadDto, UpdatePreferencesDto};
use crate::modules::notifications::entity::notification_preferences::{
    ActiveModel as PreferencesActiveModel, Column as PreferencesColumn,
    Entity as PreferencesEntity, Model as PreferencesModel,
};
use crate::modules::notifications::entity::notifications::{
    Column as NotificationColumn, Entity as NotificationEntity, Model as NotificationModel,
};

const REPORT_CATALOG: &[(&str, &str, &str, &str)] = &[
    (
        "content-performance",
        "Content Performance",
        "Top posts by engagement, likes, comments, and shares across platforms.",
        "content",
    ),
    (
        "engagement-weekly",
        "Weekly Engagement",
        "Week-over-week interaction trends on published content.",
        "content",
    ),
    (
        "publishing-activity",
        "Publishing Activity",
        "Posts published, failed, and scheduled per platform.",
        "content",
    ),
    (
        "lead-pipeline",
        "Lead Pipeline",
        "Hot, warm, and cold leads captured this period.",
        "leads",
    ),
    (
        "ai-usage",
        "AI Usage",
        "AI calls by function and remaining quota for the billing period.",
        "billing",
    ),
    (
        "subscription-billing",
        "Billing Summary",
        "Plan status, recent payments, and billing period dates.",
        "billing",
    ),
    (
        "comment-inbox",
        "Comment & Reply Activity",
        "Pending replies, auto-replies sent, and comment volume.",
        "engagement",
    ),
    (
        "chatbot-conversations",
        "Chatbot Conversations",
        "Sessions and messages by channel — playground, widget embed, and API.",
        "chatbot",
    ),
    (
        "chatbot-knowledge",
        "Knowledge Library",
        "Uploaded documents, indexing status, chunk counts, and failures.",
        "chatbot",
    ),
    (
        "chatbot-ai-usage",
        "Chatbot AI Usage",
        "Token usage for chat replies and knowledge document ingestion.",
        "chatbot",
    ),
];

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/unread-count", get(unread_count))
        .route(
            "/preferences",
            get(get_preferences).patch(update_preferences),
        )
        .route("/mark-all-read", post(mark_all_read))
        .route("/reports/catalog", get(report_catalog))
        .route("/reports/{report_id}/export", get(export_report))
        .route("/reports/{report_id}", get(generate_report))
        .route("/{id}/read", patch(mark_read))
        .route("/", get(list))
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "unreadOnly")]
    unread_only: Option<String>,
}

#[derive(Deserialize)]
struct TenantQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
}

#[derive(Deserialize)]
struct ExportQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    format: Option<String>,
}

async fn list(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = NotificationEntity::find()
        .filter(NotificationColumn::UserId.eq(user_id))
        .filter(NotificationColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(NotificationColumn::CreatedAt);

    if query.unread_only.as_deref() == Some("true") {
        db_query = db_query.filter(NotificationColumn::IsRead.eq(false));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(notification_json)
        .collect::<Vec<_>>())))
}

async fn unread_count(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let count: u64 = NotificationEntity::find()
        .filter(NotificationColumn::UserId.eq(user_id))
        .filter(NotificationColumn::TenantId.eq(query.tenant_id))
        .filter(NotificationColumn::IsRead.eq(false))
        .count(&state.db)
        .await?;

    Ok(Json(json!({ "count": count })))
}

async fn mark_read(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    NotificationEntity::update_many()
        .col_expr(NotificationColumn::IsRead, true.into())
        .filter(NotificationColumn::Id.eq(id))
        .filter(NotificationColumn::UserId.eq(user_id))
        .exec(&state.db)
        .await?;

    Ok(Json(json!({ "success": true })))
}

async fn mark_all_read(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<MarkAllReadDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    NotificationEntity::update_many()
        .col_expr(NotificationColumn::IsRead, true.into())
        .filter(NotificationColumn::UserId.eq(user_id))
        .filter(NotificationColumn::TenantId.eq(payload.tenant_id))
        .filter(NotificationColumn::IsRead.eq(false))
        .exec(&state.db)
        .await?;

    Ok(Json(json!({ "success": true })))
}

async fn get_preferences(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let prefs = ensure_preferences(&state, user_id, query.tenant_id).await?;
    Ok(Json(preferences_json(&prefs)))
}

async fn update_preferences(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<UpdatePreferencesDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = ensure_preferences(&state, user_id, payload.tenant_id).await?;
    let mut active: PreferencesActiveModel = existing.into();

    if let Some(v) = payload.email_publish_success {
        active.email_publish_success = Set(v);
    }
    if let Some(v) = payload.email_billing {
        active.email_billing = Set(v);
    }
    if let Some(v) = payload.email_weekly_digest {
        active.email_weekly_digest = Set(v);
    }
    if let Some(v) = payload.email_hot_leads {
        active.email_hot_leads = Set(v);
    }
    if let Some(v) = payload.in_app_enabled {
        active.in_app_enabled = Set(v);
    }
    active.updated_at = Set(Utc::now().fixed_offset());

    let updated = active.update(&state.db).await?;
    Ok(Json(preferences_json(&updated)))
}

async fn report_catalog(AuthUser { .. }: AuthUser) -> ApiResult<Json<Value>> {
    let catalog: Vec<Value> = REPORT_CATALOG
        .iter()
        .map(|(id, name, description, category)| {
            json!({
                "id": id,
                "name": name,
                "description": description,
                "category": category,
            })
        })
        .collect();
    Ok(Json(json!(catalog)))
}

async fn generate_report(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
    Path(report_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let data = build_report_data(&state, query.tenant_id, &report_id).await?;
    Ok(Json(data))
}

async fn export_report(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ExportQuery>,
    Path(report_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let fmt = query.format.as_deref().unwrap_or("csv").to_lowercase();
    if fmt != "pdf" && fmt != "csv" && fmt != "xlsx" {
        return Err(ApiError::BadRequest(
            "format must be pdf, csv, or xlsx".into(),
        ));
    }

    let data = build_report_data(&state, query.tenant_id, &report_id).await?;
    let filename = format!("mako-{report_id}-{}.{}", Utc::now().format("%Y-%m-%d"), fmt);
    let payload = if fmt == "csv" {
        json!({
            "csv": as_csv(&data),
        })
    } else {
        json!({
            "json": data,
        })
    };

    Ok(Json(json!({
        "reportId": report_id,
        "tenantId": query.tenant_id,
        "format": fmt,
        "filename": filename,
        "data": payload,
    })))
}

async fn ensure_preferences(
    state: &AppState,
    user_id: Uuid,
    tenant_id: Uuid,
) -> ApiResult<PreferencesModel> {
    if let Some(prefs) = PreferencesEntity::find()
        .filter(PreferencesColumn::UserId.eq(user_id))
        .filter(PreferencesColumn::TenantId.eq(tenant_id))
        .one(&state.db)
        .await?
    {
        return Ok(prefs);
    }

    let now = Utc::now().fixed_offset();
    PreferencesActiveModel {
        user_id: Set(user_id),
        tenant_id: Set(tenant_id),
        email_publish_success: Set(true),
        email_billing: Set(true),
        email_weekly_digest: Set(true),
        email_hot_leads: Set(true),
        in_app_enabled: Set(true),
        updated_at: Set(now),
    }
    .insert(&state.db)
    .await
    .map_err(Into::into)
}

fn notification_json(row: &NotificationModel) -> Value {
    json!({
        "id": row.id,
        "tenantId": row.tenant_id,
        "userId": row.user_id,
        "type": row.notification_type,
        "title": row.title,
        "body": row.body,
        "link": row.link,
        "read": row.is_read,
        "emailSent": row.email_sent,
        "metadata": row.metadata,
        "created_at": row.created_at,
    })
}

fn preferences_json(row: &PreferencesModel) -> Value {
    json!({
        "userId": row.user_id,
        "tenantId": row.tenant_id,
        "emailPublishSuccess": row.email_publish_success,
        "emailBilling": row.email_billing,
        "emailWeeklyDigest": row.email_weekly_digest,
        "emailHotLeads": row.email_hot_leads,
        "inAppEnabled": row.in_app_enabled,
        "updated_at": row.updated_at,
    })
}

async fn build_report_data(state: &AppState, tenant_id: Uuid, report_id: &str) -> ApiResult<Value> {
    let generated_at = Utc::now().to_rfc3339();
    match report_id {
        "content-performance" => {
            let rows = PublicationEntity::find()
                .filter(PublicationColumn::TenantId.eq(tenant_id))
                .filter(PublicationColumn::Status.eq("published".to_string()))
                .order_by_desc(PublicationColumn::EngagementScore)
                .all(&state.db)
                .await?;
            Ok(json!({
                "reportId": report_id,
                "generatedAt": generated_at,
                "rows": rows.into_iter().take(20).map(|p| json!({
                    "platform": p.platform,
                    "contentId": p.content_id,
                    "likes": p.like_count,
                    "comments": p.comment_count,
                    "shares": p.share_count,
                    "views": p.view_count,
                    "score": p.engagement_score,
                    "publishedAt": p.published_at,
                })).collect::<Vec<_>>(),
            }))
        }
        "engagement-weekly" => {
            let week_ago = Utc::now().fixed_offset() - chrono::Duration::days(7);
            let prev_week = week_ago - chrono::Duration::days(7);
            let rows = PublicationEntity::find()
                .filter(PublicationColumn::TenantId.eq(tenant_id))
                .filter(PublicationColumn::Status.eq("published".to_string()))
                .all(&state.db)
                .await?;
            let this_week: Vec<_> = rows
                .iter()
                .filter(|p| p.published_at.map(|d| d >= week_ago).unwrap_or(false))
                .collect();
            let last_week: Vec<_> = rows
                .iter()
                .filter(|p| {
                    p.published_at
                        .map(|d| d >= prev_week && d < week_ago)
                        .unwrap_or(false)
                })
                .collect();
            let score = |items: &[&crate::modules::content_publications::entity::Model]| {
                items.iter().map(|p| p.engagement_score as i64).sum::<i64>()
            };
            Ok(json!({
                "reportId": report_id,
                "generatedAt": generated_at,
                "thisWeek": { "posts": this_week.len(), "engagement": score(&this_week) },
                "lastWeek": { "posts": last_week.len(), "engagement": score(&last_week) },
            }))
        }
        "publishing-activity" => {
            let rows = ContentItemEntity::find()
                .filter(ContentItemColumn::TenantId.eq(tenant_id))
                .all(&state.db)
                .await?;
            let mut by_status = serde_json::Map::new();
            let mut by_platform = serde_json::Map::new();
            for row in rows {
                let status = row.status.unwrap_or_else(|| "draft".into());
                let count = by_status
                    .get(status.as_str())
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0)
                    + 1;
                by_status.insert(status, json!(count));
                for p in row.platforms.unwrap_or_default() {
                    let c = by_platform.get(&p).and_then(|v| v.as_i64()).unwrap_or(0) + 1;
                    by_platform.insert(p, json!(c));
                }
            }
            Ok(json!({
                "reportId": report_id,
                "generatedAt": generated_at,
                "byStatus": by_status,
                "byPlatform": by_platform,
            }))
        }
        "lead-pipeline" => {
            let leads = LeadEntity::find()
                .filter(LeadColumn::TenantId.eq(tenant_id))
                .all(&state.db)
                .await?;
            let mut counts = json!({"hot": 0, "warm": 0, "cold": 0, "other": 0});
            for lead in &leads {
                let tier = lead
                    .classification
                    .as_deref()
                    .unwrap_or("other")
                    .to_lowercase();
                let key = if ["hot", "warm", "cold"].contains(&tier.as_str()) {
                    tier
                } else {
                    "other".into()
                };
                let next = counts.get(&key).and_then(|v| v.as_i64()).unwrap_or(0) + 1;
                counts[key] = json!(next);
            }
            Ok(json!({
                "reportId": report_id,
                "generatedAt": generated_at,
                "counts": counts,
                "total": leads.len(),
            }))
        }
        "ai-usage" | "chatbot-ai-usage" => {
            let rows = AiUsageEntity::find()
                .filter(AiUsageColumn::TenantId.eq(tenant_id))
                .all(&state.db)
                .await?;
            let mut by_function = serde_json::Map::new();
            let mut total_tokens = 0_i64;
            for row in rows {
                let tokens = row.tokens_used.parse::<i64>().unwrap_or(0);
                total_tokens += tokens;
                let prev = by_function
                    .get(row.function_name.as_str())
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                by_function.insert(row.function_name, json!(prev + tokens));
            }
            Ok(json!({
                "reportId": report_id,
                "generatedAt": generated_at,
                "totalTokens": total_tokens,
                "byFunction": by_function,
            }))
        }
        "subscription-billing" => {
            let sub = SubscriptionEntity::find()
                .filter(SubscriptionColumn::TenantId.eq(tenant_id))
                .one(&state.db)
                .await?;
            let deposits = DepositEntity::find()
                .filter(DepositColumn::TenantId.eq(tenant_id))
                .order_by_desc(DepositColumn::CreatedAt)
                .all(&state.db)
                .await?;
            Ok(json!({
                "reportId": report_id,
                "generatedAt": generated_at,
                "subscription": sub,
                "recentPayments": deposits.into_iter().take(10).map(|d| json!({
                    "depositId": d.deposit_id,
                    "plan": d.plan,
                    "status": d.status,
                    "amount": d.amount,
                    "createdAt": d.created_at,
                })).collect::<Vec<_>>(),
            }))
        }
        "comment-inbox" => {
            let pending = crate::modules::comment_replies::entity::Entity::find()
                .filter(crate::modules::comment_replies::entity::Column::TenantId.eq(tenant_id))
                .filter(crate::modules::comment_replies::entity::Column::Status.eq("pending".to_string()))
                .count(&state.db)
                .await?;
            let sent = crate::modules::comment_replies::entity::Entity::find()
                .filter(crate::modules::comment_replies::entity::Column::TenantId.eq(tenant_id))
                .filter(crate::modules::comment_replies::entity::Column::Status.eq("sent".to_string()))
                .count(&state.db)
                .await?;
            Ok(json!({
                "reportId": report_id,
                "generatedAt": generated_at,
                "pending": pending,
                "sent": sent,
            }))
        }
        "chatbot-conversations" => {
            let sessions = ChatSessionEntity::find()
                .filter(ChatSessionColumn::TenantId.eq(tenant_id))
                .all(&state.db)
                .await?;
            let messages = ChatMessageEntity::find()
                .filter(ChatMessageColumn::TenantId.eq(tenant_id))
                .count(&state.db)
                .await?;
            Ok(json!({
                "reportId": report_id,
                "generatedAt": generated_at,
                "totalSessions": sessions.len(),
                "totalMessages": messages,
                "byChannel": sessions.iter().fold(serde_json::Map::new(), |mut acc, s| {
                    let prev = acc.get(&s.channel).and_then(|v| v.as_i64()).unwrap_or(0) + 1;
                    acc.insert(s.channel.clone(), json!(prev));
                    acc
                }),
            }))
        }
        "chatbot-knowledge" => {
            let docs = crate::modules::knowledge::entity::document::Entity::find()
                .filter(crate::modules::knowledge::entity::document::Column::TenantId.eq(tenant_id))
                .all(&state.db)
                .await?;
            let config = ChatbotConfigEntity::find()
                .filter(ChatbotConfigColumn::TenantId.eq(tenant_id))
                .one(&state.db)
                .await?;
            let total_chunks: i32 = docs.iter().map(|d| d.chunk_count).sum();
            Ok(json!({
                "reportId": report_id,
                "generatedAt": generated_at,
                "ragEnabled": config.as_ref().map(|c| c.rag_enabled).unwrap_or(true),
                "useMistralLibrary": config.as_ref().map(|c| c.use_mistral_library).unwrap_or(false),
                "totalDocuments": docs.len(),
                "totalChunks": total_chunks,
                "documents": docs.into_iter().map(|d| json!({
                    "id": d.id,
                    "title": d.title,
                    "status": d.status,
                    "chunkCount": d.chunk_count,
                    "errorMessage": d.error_message,
                })).collect::<Vec<_>>(),
            }))
        }
        _ => {
            let refunds = RefundEntity::find()
                .filter(RefundColumn::TenantId.eq(tenant_id))
                .count(&state.db)
                .await?;
            Ok(json!({
                "reportId": report_id,
                "generatedAt": generated_at,
                "error": "Unknown report type",
                "refundRequests": refunds,
            }))
        }
    }
}

fn as_csv(data: &Value) -> String {
    if let Some(rows) = data.get("rows").and_then(|v| v.as_array()) {
        if rows.is_empty() {
            return "reportId,generatedAt\n".to_string();
        }
        let first = rows[0].as_object().cloned().unwrap_or_default();
        let headers = first.keys().cloned().collect::<Vec<_>>();
        let mut out = String::new();
        out.push_str(&headers.join(","));
        out.push('\n');
        for row in rows {
            let values = headers
                .iter()
                .map(|k| row.get(k).cloned().unwrap_or(Value::Null))
                .map(|v| {
                    if let Some(s) = v.as_str() {
                        format!("\"{}\"", s.replace('"', "\"\""))
                    } else {
                        v.to_string()
                    }
                })
                .collect::<Vec<_>>();
            out.push_str(&values.join(","));
            out.push('\n');
        }
        return out;
    }
    data.to_string()
}
