pub mod dto;
pub mod entity;
pub mod seed;

use axum::{
    extract::{FromRequest, Multipart, Path, Query, Request, State},
    http::header::CONTENT_TYPE,
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
use crate::modules::brand_profiles::dto::{CreateBrandProfileDto, UpdateBrandProfileDto};
use crate::modules::brand_profiles::entity::{
    ActiveModel as BrandProfileActiveModel, Column as BrandProfileColumn,
    Entity as BrandProfileEntity, Model as BrandProfileModel,
};
use crate::modules::workspaces::entity::{Column as WorkspaceColumn, Entity as WorkspaceEntity};
use crate::services::mistral::{ChatMessage, MistralService};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/scrape-website", post(scrape_website))
        .route("/parse-document", post(parse_document))
        .route("/", post(create).get(find_all))
        .route("/mine", get(find_mine))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct BrandProfileListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct BrandProfileMineQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

async fn scrape_website(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<ScrapeWebsiteDto>,
) -> ApiResult<Json<Value>> {
    if payload.url.trim().is_empty() {
        return Err(ApiError::BadRequest("url is required".into()));
    }

    let normalized_url = normalize_url(&payload.url);
    let client = reqwest::Client::new();
    let body = client
        .get(&normalized_url)
        .header(
            reqwest::header::USER_AGENT,
            "MakoBot/1.0 (+https://mako.test; brand onboarding)",
        )
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(format!("Could not fetch website: {e}")))?
        .text()
        .await
        .map_err(|e| ApiError::BadRequest(format!("Could not read website content: {e}")))?;
    let text = html_to_text(&body);
    if text.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Could not extract text from the website".into(),
        ));
    }

    let clipped = text.chars().take(24_000).collect::<String>();
    let mistral = &state.config.mistral;
    let (data, tokens_used, _model) = MistralService::complete_json(
        mistral,
        vec![
            ChatMessage {
                role: "system".into(),
                content: brand_extraction_system_prompt().into(),
            },
            ChatMessage {
                role: "user".into(),
                content: format!(
                    "Website URL: {normalized_url}\n\nExtract a complete brand profile from this content. Fill every JSON key.\n\nPage content:\n{clipped}"
                ),
            },
        ],
        Some(MistralService::premium_model(mistral)),
    )
    .await?;

    let _ = AiUsageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        user_id: Set(user_id),
        function_name: Set("scrape-brand".into()),
        tokens_used: Set(tokens_used.to_string()),
        created_at: Set(Utc::now().fixed_offset()),
    }
    .insert(&state.db)
    .await;

    let mut normalized = normalize_brand_extraction(&data);
    normalized["websiteUrl"] = json!(normalized_url);
    Ok(Json(normalized))
}

async fn parse_document(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    request: Request,
) -> ApiResult<Json<Value>> {
    let content_type = request
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_lowercase();
    if !content_type.starts_with("multipart/form-data") {
        return Err(ApiError::BadRequest(
            "multipart/form-data is required".into(),
        ));
    }

    let mut multipart = Multipart::from_request(request, &state)
        .await
        .map_err(|_| ApiError::BadRequest("Invalid multipart upload".into()))?;
    let mut tenant_id: Option<Uuid> = None;
    let mut file_name: Option<String> = None;
    let mut mime_type = "application/octet-stream".to_string();
    let mut file_bytes: Option<Vec<u8>> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::BadRequest("Invalid multipart field".into()))?
    {
        match field.name() {
            Some("tenantId") => {
                let raw = field
                    .text()
                    .await
                    .map_err(|_| ApiError::BadRequest("tenantId is invalid".into()))?;
                tenant_id = Uuid::parse_str(raw.trim()).ok();
            }
            Some("file") => {
                file_name = field.file_name().map(str::to_string);
                mime_type = field
                    .content_type()
                    .map(str::to_string)
                    .unwrap_or_else(|| mime_type.clone());
                file_bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|_| ApiError::BadRequest("Failed to read file".into()))?
                        .to_vec(),
                );
            }
            _ => {}
        }
    }

    let tenant_id = tenant_id.ok_or_else(|| ApiError::BadRequest("tenantId is required".into()))?;
    let file_name = file_name.unwrap_or_else(|| "document.txt".into());
    let bytes = file_bytes.ok_or_else(|| ApiError::BadRequest("file is required".into()))?;
    let extracted = extract_document_text(&bytes, &mime_type, &file_name)?;
    if extracted.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "No readable text found in document".into(),
        ));
    }

    let clipped = extracted.chars().take(24_000).collect::<String>();
    let mistral = &state.config.mistral;
    let (data, tokens_used, _model) = MistralService::complete_json(
        mistral,
        vec![
            ChatMessage {
                role: "system".into(),
                content: brand_extraction_system_prompt().into(),
            },
            ChatMessage {
                role: "user".into(),
                content: format!(
                    "Document: {file_name}\n\nExtract a complete brand profile. Fill every JSON key.\n\n{clipped}"
                ),
            },
        ],
        Some(MistralService::premium_model(mistral)),
    )
    .await?;

    let _ = AiUsageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        user_id: Set(user_id),
        function_name: Set("parse-brand-document".into()),
        tokens_used: Set(tokens_used.to_string()),
        created_at: Set(Utc::now().fixed_offset()),
    }
    .insert(&state.db)
    .await;

    Ok(Json(normalize_brand_extraction(&data)))
}

async fn create(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(mut payload): Json<CreateBrandProfileDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    payload.user_id = Some(user_id);

    if let Some(workspace_id) = payload.workspace_id {
        let workspace = WorkspaceEntity::find()
            .filter(WorkspaceColumn::Id.eq(workspace_id))
            .filter(WorkspaceColumn::TenantId.eq(payload.tenant_id))
            .one(&state.db)
            .await?;

        if workspace.is_none() {
            return Err(ApiError::BadRequest(
                "workspaceId does not belong to this tenant".into(),
            ));
        }
    }

    let existing = if let Some(workspace_id) = payload.workspace_id {
        find_for_workspace(&state, workspace_id, Some(payload.tenant_id)).await?
    } else {
        find_for_tenant_user(&state, payload.tenant_id, user_id).await?
    };

    if let Some(existing) = existing {
        if let Some(workspace_id) = payload.workspace_id {
            if existing.workspace_id != Some(workspace_id) {
                return Err(ApiError::BadRequest(
                    "Brand profile belongs to a different workspace".into(),
                ));
            }
        }

        let update_dto = UpdateBrandProfileDto {
            tenant_id: None,
            user_id: None,
            workspace_id: None,
            brand_type: payload.brand_type,
            company_name: payload.company_name,
            industry: payload.industry,
            description: payload.description,
            services: payload.services,
            target_audience: payload.target_audience,
            audience_pain_points: payload.audience_pain_points,
            tone_of_voice: payload.tone_of_voice,
            brand_personality: payload.brand_personality,
            current_offers: payload.current_offers,
            unique_selling_points: payload.unique_selling_points,
            faqs: payload.faqs,
            case_studies: payload.case_studies,
            banned_words: payload.banned_words,
            banned_topics: payload.banned_topics,
            competitors: payload.competitors,
            keywords: payload.keywords,
            website_url: payload.website_url,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        };

        let updated = apply_update(&state, existing, update_dto).await?;
        return Ok(Json(brand_profile_json(&updated)));
    }

    let now = Utc::now().fixed_offset();
    let profile = BrandProfileActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        user_id: Set(user_id),
        workspace_id: Set(payload.workspace_id),
        brand_type: Set(payload.brand_type.unwrap_or_else(|| "business".into())),
        company_name: Set(payload.company_name),
        industry: Set(payload.industry),
        description: Set(payload.description),
        services: Set(payload.services),
        target_audience: Set(payload.target_audience),
        audience_pain_points: Set(payload.audience_pain_points),
        tone_of_voice: Set(payload.tone_of_voice),
        brand_personality: Set(payload.brand_personality),
        current_offers: Set(payload.current_offers),
        unique_selling_points: Set(payload.unique_selling_points),
        faqs: Set(payload.faqs),
        case_studies: Set(payload.case_studies),
        banned_words: Set(payload.banned_words),
        banned_topics: Set(payload.banned_topics),
        competitors: Set(payload.competitors),
        keywords: Set(payload.keywords),
        website_url: Set(payload.website_url),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(brand_profile_json(&profile)))
}

async fn find_all(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<BrandProfileListQuery>,
) -> ApiResult<Json<Value>> {
    let rows = if let Some(tenant_id) = query.tenant_id {
        BrandProfileEntity::find()
            .filter(BrandProfileColumn::TenantId.eq(tenant_id))
            .all(&state.db)
            .await?
    } else {
        BrandProfileEntity::find().all(&state.db).await?
    };

    Ok(Json(json!(rows
        .iter()
        .map(brand_profile_json)
        .collect::<Vec<_>>())))
}

async fn find_mine(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<BrandProfileMineQuery>,
) -> ApiResult<Json<Value>> {
    let profile = if let Some(workspace_id) = query.workspace_id {
        find_for_workspace(&state, workspace_id, Some(query.tenant_id)).await?
    } else {
        find_for_tenant_user(&state, query.tenant_id, user_id).await?
    };

    Ok(Json(match profile {
        Some(row) => brand_profile_json(&row),
        None => Value::Null,
    }))
}

async fn find_one(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let profile = BrandProfileEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("BrandProfiles not found".into()))?;

    Ok(Json(brand_profile_json(&profile)))
}

async fn update(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateBrandProfileDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = BrandProfileEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("BrandProfiles not found".into()))?;

    if existing.user_id != user_id {
        return Err(ApiError::NotFound("BrandProfiles not found".into()));
    }

    let updated = apply_update(&state, existing, payload).await?;
    Ok(Json(brand_profile_json(&updated)))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let result = BrandProfileEntity::delete_by_id(id).exec(&state.db).await?;

    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("BrandProfiles not found".into()));
    }

    Ok(Json(json!({ "success": true })))
}

async fn find_for_tenant_user(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
) -> ApiResult<Option<BrandProfileModel>> {
    Ok(BrandProfileEntity::find()
        .filter(BrandProfileColumn::TenantId.eq(tenant_id))
        .filter(BrandProfileColumn::UserId.eq(user_id))
        .filter(BrandProfileColumn::WorkspaceId.is_null())
        .one(&state.db)
        .await?)
}

async fn find_for_workspace(
    state: &AppState,
    workspace_id: Uuid,
    tenant_id: Option<Uuid>,
) -> ApiResult<Option<BrandProfileModel>> {
    let mut query =
        BrandProfileEntity::find().filter(BrandProfileColumn::WorkspaceId.eq(workspace_id));

    if let Some(tenant_id) = tenant_id {
        query = query.filter(BrandProfileColumn::TenantId.eq(tenant_id));
    }

    Ok(query.one(&state.db).await?)
}

async fn apply_update(
    state: &AppState,
    profile: BrandProfileModel,
    payload: UpdateBrandProfileDto,
) -> ApiResult<BrandProfileModel> {
    let mut active: BrandProfileActiveModel = profile.into();

    if let Some(tenant_id) = payload.tenant_id {
        active.tenant_id = Set(tenant_id);
    }
    if let Some(user_id) = payload.user_id {
        active.user_id = Set(user_id);
    }
    if let Some(workspace_id) = payload.workspace_id {
        active.workspace_id = Set(Some(workspace_id));
    }
    if let Some(brand_type) = payload.brand_type {
        active.brand_type = Set(brand_type);
    }
    if let Some(company_name) = payload.company_name {
        active.company_name = Set(Some(company_name));
    }
    if let Some(industry) = payload.industry {
        active.industry = Set(Some(industry));
    }
    if let Some(description) = payload.description {
        active.description = Set(Some(description));
    }
    if let Some(services) = payload.services {
        active.services = Set(Some(services));
    }
    if let Some(target_audience) = payload.target_audience {
        active.target_audience = Set(Some(target_audience));
    }
    if let Some(audience_pain_points) = payload.audience_pain_points {
        active.audience_pain_points = Set(Some(audience_pain_points));
    }
    if let Some(tone_of_voice) = payload.tone_of_voice {
        active.tone_of_voice = Set(Some(tone_of_voice));
    }
    if let Some(brand_personality) = payload.brand_personality {
        active.brand_personality = Set(Some(brand_personality));
    }
    if let Some(current_offers) = payload.current_offers {
        active.current_offers = Set(Some(current_offers));
    }
    if let Some(unique_selling_points) = payload.unique_selling_points {
        active.unique_selling_points = Set(Some(unique_selling_points));
    }
    if let Some(faqs) = payload.faqs {
        active.faqs = Set(Some(faqs));
    }
    if let Some(case_studies) = payload.case_studies {
        active.case_studies = Set(Some(case_studies));
    }
    if let Some(banned_words) = payload.banned_words {
        active.banned_words = Set(Some(banned_words));
    }
    if let Some(banned_topics) = payload.banned_topics {
        active.banned_topics = Set(Some(banned_topics));
    }
    if let Some(competitors) = payload.competitors {
        active.competitors = Set(Some(competitors));
    }
    if let Some(keywords) = payload.keywords {
        active.keywords = Set(Some(keywords));
    }
    if let Some(website_url) = payload.website_url {
        active.website_url = Set(Some(website_url));
    }
    if let Some(created_at) = payload.created_at {
        active.created_at = Set(created_at);
    }
    if let Some(updated_at) = payload.updated_at {
        active.updated_at = Set(updated_at);
    } else {
        active.updated_at = Set(Utc::now().fixed_offset());
    }
    if let Some(deleted_at) = payload.deleted_at {
        active.deleted_at = Set(Some(deleted_at));
    }

    Ok(active.update(&state.db).await?)
}

fn brand_profile_json(profile: &BrandProfileModel) -> Value {
    json!({
        "id": profile.id,
        "tenantId": profile.tenant_id,
        "userId": profile.user_id,
        "workspaceId": profile.workspace_id,
        "brandType": profile.brand_type,
        "companyName": profile.company_name,
        "industry": profile.industry,
        "description": profile.description,
        "services": profile.services,
        "targetAudience": profile.target_audience,
        "audiencePainPoints": profile.audience_pain_points,
        "toneOfVoice": profile.tone_of_voice,
        "brandPersonality": profile.brand_personality,
        "currentOffers": profile.current_offers,
        "uniqueSellingPoints": profile.unique_selling_points,
        "faqs": profile.faqs,
        "caseStudies": profile.case_studies,
        "bannedWords": profile.banned_words,
        "bannedTopics": profile.banned_topics,
        "competitors": profile.competitors,
        "keywords": profile.keywords,
        "websiteUrl": profile.website_url,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
        "deleted_at": profile.deleted_at,
    })
}

#[derive(Deserialize)]
struct ScrapeWebsiteDto {
    url: String,
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
}

fn normalize_url(url: &str) -> String {
    let trimmed = url.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    }
}

fn html_to_text(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut in_tag = false;
    let mut previous_space = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if in_tag => {}
            c => {
                let val = if c.is_whitespace() { ' ' } else { c };
                if val == ' ' {
                    if !previous_space {
                        out.push(' ');
                    }
                    previous_space = true;
                } else {
                    out.push(val);
                    previous_space = false;
                }
            }
        }
    }
    out.trim().chars().take(24_000).collect()
}

fn extract_document_text(bytes: &[u8], mime_type: &str, file_name: &str) -> ApiResult<String> {
    let lower = file_name.to_lowercase();
    if mime_type.starts_with("text/") || lower.ends_with(".txt") {
        return Ok(String::from_utf8_lossy(bytes).to_string());
    }
    if mime_type == "application/pdf"
        || lower.ends_with(".pdf")
        || lower.ends_with(".docx")
        || mime_type.contains("wordprocessingml")
    {
        return Ok(String::from_utf8_lossy(bytes).to_string());
    }
    Err(ApiError::BadRequest(
        "Unsupported file type. Use PDF, DOCX, or TXT.".into(),
    ))
}

fn brand_extraction_system_prompt() -> &'static str {
    "You extract structured brand profiles for marketing systems.
Return ONLY JSON object with keys:
companyName, industry, description, services, targetAudience, audiencePainPoints, toneOfVoice, brandPersonality, currentOffers, uniqueSellingPoints, faqs, caseStudies, bannedWords, bannedTopics, competitors, keywords.
Use empty string when unknown."
}

fn normalize_brand_extraction(data: &Value) -> Value {
    let get_str = |key: &str| -> String {
        data.get(key)
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .trim()
            .to_string()
    };
    json!({
        "companyName": get_str("companyName"),
        "industry": get_str("industry"),
        "description": get_str("description"),
        "services": get_str("services"),
        "targetAudience": get_str("targetAudience"),
        "audiencePainPoints": get_str("audiencePainPoints"),
        "toneOfVoice": get_str("toneOfVoice"),
        "brandPersonality": get_str("brandPersonality"),
        "currentOffers": get_str("currentOffers"),
        "uniqueSellingPoints": get_str("uniqueSellingPoints"),
        "faqs": get_str("faqs"),
        "caseStudies": get_str("caseStudies"),
        "bannedWords": get_str("bannedWords"),
        "bannedTopics": get_str("bannedTopics"),
        "competitors": get_str("competitors"),
        "keywords": get_str("keywords"),
    })
}
