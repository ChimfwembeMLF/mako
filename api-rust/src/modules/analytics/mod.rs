pub mod entity;
pub mod page_insights;

use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use chrono::{Duration, Utc};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::ApiResult;
use crate::modules::analytics::entity::{
    Column as InsightsColumn, Entity as InsightsEntity, Model as InsightsModel,
};
use crate::modules::content_publications::entity::{
    Column as PublicationColumn, Entity as PublicationEntity,
};
use crate::services::mistral::{ChatMessage, MistralService};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/insights", get(get_insights))
        .route("/ai-report", get(get_ai_report))
}

#[derive(Deserialize)]
struct InsightsQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
    days: Option<i64>,
}

#[derive(Deserialize)]
struct AiReportQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

async fn get_insights(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<InsightsQuery>,
) -> ApiResult<Json<Value>> {
    let days = query.days.unwrap_or(30);
    let start_date = (Utc::now() - Duration::days(days)).date_naive();

    let mut db_query = InsightsEntity::find()
        .filter(InsightsColumn::Date.gte(start_date))
        .order_by_asc(InsightsColumn::Date);

    if let Some(tenant_id) = query.tenant_id {
        db_query = db_query.filter(InsightsColumn::TenantId.eq(tenant_id));
    }

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(InsightsColumn::WorkspaceId.eq(workspace_id));
    }

    match db_query.all(&state.db).await {
        Ok(rows) => Ok(Json(json!(rows
            .iter()
            .map(insight_json)
            .collect::<Vec<_>>()))),
        Err(_) => Ok(Json(json!([]))),
    }
}

async fn get_ai_report(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<AiReportQuery>,
) -> ApiResult<Json<Value>> {
    let Some(tenant_id) = query.tenant_id else {
        return Ok(Json(json!({
            "generatedAt": Utc::now().to_rfc3339(),
            "summary": "tenantId is required to generate AI report",
            "highlights": [],
            "recommendations": [],
        })));
    };

    let mut insights_query = InsightsEntity::find().filter(InsightsColumn::TenantId.eq(tenant_id));
    if let Some(workspace_id) = query.workspace_id {
        insights_query = insights_query.filter(InsightsColumn::WorkspaceId.eq(workspace_id));
    }
    let insights = insights_query
        .order_by_desc(InsightsColumn::Date)
        .all(&state.db)
        .await
        .unwrap_or_default();

    let mut pubs_query = PublicationEntity::find()
        .filter(PublicationColumn::TenantId.eq(tenant_id))
        .filter(PublicationColumn::Status.eq("published".to_string()))
        .order_by_desc(PublicationColumn::EngagementScore);
    if let Some(workspace_id) = query.workspace_id {
        pubs_query = pubs_query.filter(PublicationColumn::WorkspaceId.eq(workspace_id));
    }
    let publications = pubs_query.all(&state.db).await.unwrap_or_default();

    let insights_text = insights
        .iter()
        .take(30)
        .map(|i| {
            format!(
                "{} followers={} reach={} impressions={} engagement={}",
                i.date, i.followers_count, i.reach, i.impressions, i.engagement
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let top_posts_text = publications
        .iter()
        .take(10)
        .map(|p| {
            format!(
                "{} score={} likes={} comments={} views={} text={}",
                p.platform,
                p.engagement_score,
                p.like_count,
                p.comment_count,
                p.view_count,
                p.published_content.chars().take(140).collect::<String>()
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let system = "Return JSON only with keys: summary (string), highlights (array of strings), recommendations (array of strings).";
    let user = format!(
        "Tenant analytics digest.\nInsights:\n{}\nTop posts:\n{}",
        insights_text, top_posts_text
    );
    let mistral = &state.config.mistral;
    let ai = MistralService::complete_json(
        mistral,
        vec![
            ChatMessage {
                role: "system".into(),
                content: system.into(),
            },
            ChatMessage {
                role: "user".into(),
                content: user,
            },
        ],
        Some(MistralService::premium_model(mistral)),
    )
    .await
    .ok()
    .map(|(data, _, _)| data);

    if let Some(data) = ai {
        let highlights = data
            .get("highlights")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        let recommendations = data
            .get("recommendations")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        return Ok(Json(json!({
            "tenantId": query.tenant_id,
            "workspaceId": query.workspace_id,
            "generatedAt": Utc::now().to_rfc3339(),
            "summary": data.get("summary").and_then(|v| v.as_str()).unwrap_or("AI report generated"),
            "highlights": highlights,
            "recommendations": recommendations,
        })));
    }

    let total_reach: i64 = insights.iter().map(|i| i.reach as i64).sum();
    let total_impressions: i64 = insights.iter().map(|i| i.impressions as i64).sum();
    let best_platform = publications
        .iter()
        .max_by_key(|p| p.engagement_score)
        .map(|p| p.platform.clone())
        .unwrap_or_else(|| "unknown".into());
    Ok(Json(json!({
        "tenantId": query.tenant_id,
        "workspaceId": query.workspace_id,
        "generatedAt": Utc::now().to_rfc3339(),
        "summary": format!(
            "Reach totaled {} with {} impressions. Best performing platform was {}.",
            total_reach, total_impressions, best_platform
        ),
        "highlights": [
            format!("{} insight rows analyzed", insights.len()),
            format!("{} published posts considered", publications.len()),
        ],
        "recommendations": [
            format!("Replicate content style from {}", best_platform),
            "Review posting cadence for underperforming platforms".to_string(),
        ],
    })))
}

fn insight_json(row: &InsightsModel) -> Value {
    json!({
        "id": row.id,
        "tenantId": row.tenant_id,
        "workspaceId": row.workspace_id,
        "socialAccountId": row.social_account_id,
        "date": row.date,
        "followersCount": row.followers_count,
        "reach": row.reach,
        "impressions": row.impressions,
        "engagement": row.engagement,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    })
}
