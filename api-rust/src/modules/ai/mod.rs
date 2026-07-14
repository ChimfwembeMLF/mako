use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::ai_usage::entity::ActiveModel as AiUsageActiveModel;
use crate::modules::brand_profiles::entity::{
    Column as BrandProfileColumn, Entity as BrandProfileEntity,
};
use crate::services::mistral::{ChatMessage, MistralService};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/models", get(models))
        .route("/form-suggestions", post(form_suggestions))
}

#[derive(Deserialize, Validate)]
struct FormSuggestionsDto {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
    form: String,
    fields: Option<Vec<String>>,
}

async fn health(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
) -> Json<Value> {
    let mistral = &state.config.mistral;
    let (ok, model) = MistralService::health_check(mistral)
        .await
        .unwrap_or((false, MistralService::default_model(mistral)));
    Json(json!({ "status": if ok { "ok" } else { "degraded" }, "model": model }))
}

async fn models(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let data = MistralService::list_models(&state.config.mistral).await?;
    Ok(Json(data))
}

async fn form_suggestions(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(dto): Json<FormSuggestionsDto>,
) -> ApiResult<Json<Value>> {
    dto.validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let fields = dto.fields.unwrap_or_else(default_fields);
    if fields.is_empty() {
        return Ok(Json(json!({ "suggestions": {} })));
    }

    let brand = resolve_brand_profile(&state, dto.tenant_id, user_id, dto.workspace_id).await?;
    let brand_block = match brand {
        Some(v) => format!(
            "Brand profile:\ncompanyName: {}\nindustry: {}\ndescription: {}\ntoneOfVoice: {}\nkeywords: {}",
            v.company_name.unwrap_or_default(),
            v.industry.unwrap_or_default(),
            v.description.unwrap_or_default(),
            v.tone_of_voice.unwrap_or_default(),
            v.keywords.unwrap_or_default()
        ),
        None => "No brand profile yet — use neutral professional examples.".into(),
    };

    let system_prompt = "You write varied placeholder suggestions for marketing form fields.
Return ONLY JSON: { \"suggestions\": { \"fieldKey\": [\"suggestion1\", \"suggestion2\", \"suggestion3\"] } }
Rules:
- Exactly 3 suggestions per field key.
- Keep each suggestion realistic and concise.
- Vary structure: one short phrase, one sentence, one multi-line or bullet-like entry.
- No markdown headers or code fences.";

    let user_prompt = format!(
        "{brand_block}\n\nForm type: {}\nFields: {}",
        dto.form,
        fields.join(", ")
    );

    let mistral = &state.config.mistral;
    let (raw, tokens_used, _model) = MistralService::complete_json(
        mistral,
        vec![
            ChatMessage {
                role: "system".into(),
                content: system_prompt.into(),
            },
            ChatMessage {
                role: "user".into(),
                content: user_prompt,
            },
        ],
        Some(MistralService::default_model(mistral)),
    )
    .await
    .unwrap_or((
        json!({ "suggestions": {} }),
        0,
        MistralService::default_model(mistral),
    ));

    let suggestions = normalize_suggestions(&dto.form, &fields, raw.get("suggestions"));
    if tokens_used > 0 {
        let _ = AiUsageActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(dto.tenant_id),
            user_id: Set(user_id),
            function_name: Set("form-suggestions".into()),
            tokens_used: Set(tokens_used.to_string()),
            created_at: Set(Utc::now().fixed_offset()),
        }
        .insert(&state.db)
        .await;
    }

    Ok(Json(json!({
        "suggestions": suggestions,
    })))
}

fn default_fields() -> Vec<String> {
    vec![
        "companyName".into(),
        "industry".into(),
        "description".into(),
        "services".into(),
        "targetAudience".into(),
        "toneOfVoice".into(),
        "keywords".into(),
    ]
}

fn fallback_for_field(form: &str, field: &str) -> Vec<String> {
    if form == "campaign" && field == "theme" {
        return vec![
            "7-day product launch content sequence".into(),
            "Educate audience on the problem, then reveal our solution and CTA.".into(),
            "- Tease pain point\n- Share proof\n- Offer limited-time action".into(),
        ];
    }
    match field {
        "companyName" => vec![
            "Acme Labs".into(),
            "Pulse Digital Studio".into(),
            "GreenHarvest Logistics".into(),
        ],
        "industry" => vec![
            "SaaS".into(),
            "Retail and e-commerce".into(),
            "B2B professional services".into(),
        ],
        "description" => vec![
            "We help growing teams simplify marketing execution.".into(),
            "A practical platform for creating and publishing social content at scale.".into(),
            "Note: lead with outcomes, not features.".into(),
        ],
        _ => vec![
            format!("Short {field} example"),
            format!("A medium-length {field} suggestion with context."),
            format!("- Point one for {field}\n- Point two for {field}"),
        ],
    }
}

fn normalize_suggestions(form: &str, fields: &[String], raw: Option<&Value>) -> Value {
    let mut out = serde_json::Map::new();
    for field in fields {
        let items = raw
            .and_then(|v| v.get(field))
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
                    .filter(|s| !s.is_empty())
                    .take(3)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        if items.len() >= 2 {
            out.insert(field.clone(), json!(items));
        } else {
            out.insert(field.clone(), json!(fallback_for_field(form, field)));
        }
    }
    Value::Object(out)
}

async fn resolve_brand_profile(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<Option<crate::modules::brand_profiles::entity::Model>> {
    if let Some(workspace_id) = workspace_id {
        let workspace_profile = BrandProfileEntity::find()
            .filter(BrandProfileColumn::TenantId.eq(tenant_id))
            .filter(BrandProfileColumn::WorkspaceId.eq(workspace_id))
            .one(&state.db)
            .await?;
        if workspace_profile.is_some() {
            return Ok(workspace_profile);
        }
    }

    let tenant_profile = BrandProfileEntity::find()
        .filter(BrandProfileColumn::TenantId.eq(tenant_id))
        .filter(BrandProfileColumn::UserId.eq(user_id))
        .one(&state.db)
        .await?;
    Ok(tenant_profile)
}
