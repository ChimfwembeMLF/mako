pub mod dto;

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use sea_orm::sea_query::extension::postgres::PgExpr;
use sea_orm::sea_query::Expr;
use sea_orm::Condition;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect, Set,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::ApiResult;
use crate::modules::ai_usage::entity::ActiveModel as AiUsageActiveModel;
use crate::modules::brand_profiles::entity::{
    Column as BrandProfileColumn, Entity as BrandProfileEntity,
};
use crate::modules::content_items::entity::{Column as ContentColumn, Entity as ContentEntity};
use crate::modules::leads::entity::{Column as LeadColumn, Entity as LeadEntity};
use crate::modules::search::dto::SearchAskDto;
use crate::modules::templates::entity::{Column as TemplateColumn, Entity as TemplateEntity};
use crate::services::mistral::{ChatMessage, MistralService};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(query))
        .route("/ask", post(ask))
}

#[derive(Deserialize)]
struct SearchQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    q: String,
}

async fn query(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<SearchQuery>,
) -> ApiResult<Json<Value>> {
    let term = params.q.trim();
    if term.is_empty() {
        return Ok(Json(json!([])));
    }

    let pattern = format!("%{term}%");
    let per_type = 5;

    let leads = LeadEntity::find()
        .filter(LeadColumn::TenantId.eq(params.tenant_id))
        .filter(
            Condition::any()
                .add(Expr::col(LeadColumn::Name).ilike(&pattern))
                .add(Expr::col(LeadColumn::Email).ilike(&pattern))
                .add(Expr::col(LeadColumn::Message).ilike(&pattern)),
        )
        .order_by_desc(LeadColumn::CreatedAt)
        .limit(per_type)
        .all(&state.db)
        .await?;

    let templates = TemplateEntity::find()
        .filter(TemplateColumn::TenantId.eq(params.tenant_id))
        .filter(
            Condition::any()
                .add(Expr::col(TemplateColumn::Name).ilike(&pattern))
                .add(Expr::col(TemplateColumn::Description).ilike(&pattern)),
        )
        .order_by_desc(TemplateColumn::CreatedAt)
        .limit(per_type)
        .all(&state.db)
        .await?;

    let content_items = ContentEntity::find()
        .filter(ContentColumn::TenantId.eq(params.tenant_id))
        .filter(
            Condition::any()
                .add(Expr::col(ContentColumn::Title).ilike(&pattern))
                .add(Expr::col(ContentColumn::Content).ilike(&pattern)),
        )
        .order_by_desc(ContentColumn::CreatedAt)
        .limit(per_type)
        .all(&state.db)
        .await?;

    let mut results: Vec<Value> = Vec::new();

    for item in content_items {
        results.push(json!({
            "type": "content",
            "id": item.id,
            "title": item.title,
            "subtitle": item.status,
            "url": format!("/content/{}", item.id),
        }));
    }

    for lead in leads {
        results.push(json!({
            "type": "lead",
            "id": lead.id,
            "title": lead.name,
            "subtitle": lead.email,
            "url": "/leads",
        }));
    }

    for tpl in templates {
        results.push(json!({
            "type": "template",
            "id": tpl.id,
            "title": tpl.name,
            "subtitle": tpl.content_type,
            "url": "/templates",
        }));
    }

    Ok(Json(json!(results)))
}

async fn ask(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<SearchAskDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| crate::common::ApiError::BadRequest(e.to_string()))?;

    let term = payload.q.trim();
    let pattern = format!("%{term}%");

    let content_items = ContentEntity::find()
        .filter(ContentColumn::TenantId.eq(payload.tenant_id))
        .filter(
            Condition::any()
                .add(Expr::col(ContentColumn::Title).ilike(&pattern))
                .add(Expr::col(ContentColumn::Content).ilike(&pattern)),
        )
        .order_by_desc(ContentColumn::CreatedAt)
        .limit(6)
        .all(&state.db)
        .await?;

    let leads = LeadEntity::find()
        .filter(LeadColumn::TenantId.eq(payload.tenant_id))
        .filter(
            Condition::any()
                .add(Expr::col(LeadColumn::Name).ilike(&pattern))
                .add(Expr::col(LeadColumn::Email).ilike(&pattern)),
        )
        .order_by_desc(LeadColumn::CreatedAt)
        .limit(6)
        .all(&state.db)
        .await?;

    let templates = TemplateEntity::find()
        .filter(TemplateColumn::TenantId.eq(payload.tenant_id))
        .filter(
            Condition::any()
                .add(Expr::col(TemplateColumn::Name).ilike(&pattern))
                .add(Expr::col(TemplateColumn::Description).ilike(&pattern)),
        )
        .order_by_desc(TemplateColumn::CreatedAt)
        .limit(6)
        .all(&state.db)
        .await?;

    let brand = BrandProfileEntity::find()
        .filter(BrandProfileColumn::TenantId.eq(payload.tenant_id))
        .one(&state.db)
        .await?;
    let brand_context = brand
        .map(|b| {
            format!(
                "companyName: {}\ndescription: {}\nkeywords: {}\ntoneOfVoice: {}",
                b.company_name.unwrap_or_default(),
                b.description.unwrap_or_default(),
                b.keywords.unwrap_or_default(),
                b.tone_of_voice.unwrap_or_default()
            )
        })
        .unwrap_or_else(|| "No brand profile configured.".into());

    let links: Vec<Value> = content_items
        .iter()
        .map(|item| json!({ "title": item.title, "url": format!("/content/{}", item.id) }))
        .chain(
            leads
                .iter()
                .map(|lead| json!({ "title": lead.name, "url": "/leads" })),
        )
        .chain(
            templates
                .iter()
                .map(|tpl| json!({ "title": tpl.name, "url": "/templates" })),
        )
        .take(4)
        .collect();

    let context = format!(
        "Brand profile:\n{}\n\nMatching records:\n{}\n\nApp pages:\n- Dashboard: /dashboard\n- Brand Brain: /brand-brain\n- Content Engine: /content\n- Scheduler: /scheduler\n- Publisher: /publisher\n- Analytics: /analytics\n- Leads: /leads\n- Templates: /templates\n- Settings: /settings",
        brand_context,
        links
            .iter()
            .map(|v| {
                format!(
                    "- {} -> {}",
                    v.get("title").and_then(|x| x.as_str()).unwrap_or("Item"),
                    v.get("url").and_then(|x| x.as_str()).unwrap_or("/")
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    );

    let mistral = &state.config.mistral;
    let (data, tokens_used, _model) = MistralService::complete_json(
        mistral,
        vec![
            ChatMessage {
                role: "system".into(),
                content: "You are Mako's in-app assistant. Return ONLY JSON: {\"answer\":\"...\",\"links\":[{\"title\":\"...\",\"url\":\"/path\"}]}. Keep the answer concise (2-5 sentences).".into(),
            },
            ChatMessage {
                role: "user".into(),
                content: format!("User question: {term}\n\nContext:\n{context}"),
            },
        ],
        Some(MistralService::default_model(mistral)),
    )
    .await
    .unwrap_or((json!({"answer": ""}), 0, MistralService::default_model(mistral)));

    if tokens_used > 0 {
        let _ = AiUsageActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(payload.tenant_id),
            user_id: Set(user_id),
            function_name: Set("global-search-ask".into()),
            tokens_used: Set(tokens_used.to_string()),
            created_at: Set(Utc::now().fixed_offset()),
        }
        .insert(&state.db)
        .await;
    }

    let answer = data
        .get("answer")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let ai_links = data
        .get("links")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|entry| {
                    let title = entry.get("title")?.as_str()?;
                    let url = entry.get("url")?.as_str()?;
                    if !url.starts_with('/') {
                        return None;
                    }
                    Some(json!({ "title": title, "url": url }))
                })
                .take(4)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(Json(json!({
        "answer": if answer.is_empty() {
            "I could not find an answer. Try rephrasing or browse search results."
        } else {
            &answer
        },
        "links": if ai_links.is_empty() { links } else { ai_links },
    })))
}
