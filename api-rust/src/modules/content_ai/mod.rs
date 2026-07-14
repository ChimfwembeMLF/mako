#[allow(dead_code)]
pub mod dto;

use std::collections::HashMap;

use axum::{
    extract::{Path, State},
    routing::post,
    Json, Router,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::ai_usage::entity::ActiveModel as AiUsageActiveModel;
use crate::modules::brand_profiles::entity::{
    Column as BrandProfileColumn, Entity as BrandProfileEntity,
};
use crate::modules::content_ai::dto::{
    AdaptPlatformsDto, DailyWorkflowDto, GenerateContentDto, GenerateImageDto,
    GenerateSlideshowDto, PublishContentDto, RepurposeContentDto,
};
use crate::modules::content_items::entity::{
    ActiveModel as ContentItemActiveModel, Entity as ContentItemEntity,
};
use crate::modules::content_publishing::publications::PublicationsService;
use crate::modules::content_publishing::{
    PlatformPayloadStored, PublishContentService, PublishParams,
};
use crate::modules::jobs::auto_publish::AutoPublishService;
use crate::modules::media::entity::ActiveModel as MediaAssetActiveModel;
use crate::modules::queues::dispatch::QueueDispatch;
use crate::modules::subscriptions::entity::{
    Column as SubscriptionColumn, Entity as SubscriptionEntity,
};
use crate::modules::tenants::entity::Entity as TenantEntity;
use crate::modules::workspaces::entity::{Column as WorkspaceColumn, Entity as WorkspaceEntity};
use crate::services::mistral::{ChatMessage, MistralService};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/generate", post(generate))
        .route("/repurpose", post(repurpose))
        .route("/adapt-platforms", post(adapt_platforms))
        .route("/generate-image", post(generate_image))
        .route("/generate-slideshow", post(generate_slideshow))
        .route("/auto-publish", post(auto_publish))
        .route("/daily-workflow", post(daily_workflow))
        .route("/{content_id}/publish", post(publish))
}

async fn generate(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(dto): Json<GenerateContentDto>,
) -> ApiResult<Json<Value>> {
    let workspace_id = dto.workspace_id;
    let tenant_id = resolve_tenant_id(&state, dto.tenant_id, workspace_id).await?;
    let theme = dto
        .theme
        .as_deref()
        .or(dto.draft.as_deref())
        .map(str::trim)
        .unwrap_or_default()
        .to_string();
    if theme.is_empty() {
        return Err(ApiError::BadRequest(
            "theme or draft content is required".into(),
        ));
    }

    let payload = json!({
        "tenantId": tenant_id,
        "workspaceId": workspace_id,
        "theme": dto.theme,
        "draft": dto.draft,
        "contentType": dto.content_type,
        "platform": dto.platform,
        "templateId": dto.template_id,
        "save": dto.save,
    });
    if QueueDispatch::is_enabled(&state.config) {
        let (job_id, queue) =
            QueueDispatch::enqueue_ai_task(&state, "generate-content", user_id, payload).await;
        return Ok(Json(
            json!({ "queued": true, "jobId": job_id, "queue": queue }),
        ));
    }

    let result = execute_generate_content(&state, user_id, &payload).await?;
    Ok(Json(result))
}

async fn repurpose(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(dto): Json<RepurposeContentDto>,
) -> ApiResult<Json<Value>> {
    let _ = ContentItemEntity::find_by_id(dto.content_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Content item not found".into()))?;
    let payload = json!({ "contentId": dto.content_id });
    if QueueDispatch::is_enabled(&state.config) {
        let (job_id, queue) =
            QueueDispatch::enqueue_ai_task(&state, "repurpose-content", user_id, payload).await;
        return Ok(Json(
            json!({ "queued": true, "jobId": job_id, "queue": queue }),
        ));
    }

    let result = execute_repurpose_content(&state, user_id, dto.content_id, None).await?;
    Ok(Json(result))
}

async fn adapt_platforms(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(dto): Json<AdaptPlatformsDto>,
) -> ApiResult<Json<Value>> {
    if dto.platforms.is_empty() {
        return Err(ApiError::BadRequest("platforms is required".into()));
    }
    if dto.content.trim().is_empty() {
        return Err(ApiError::BadRequest("content is required".into()));
    }
    let payload = json!({
        "tenantId": dto.tenant_id,
        "workspaceId": dto.workspace_id,
        "platforms": dto.platforms,
        "title": dto.title,
        "content": dto.content,
    });
    if QueueDispatch::is_enabled(&state.config) {
        let (job_id, queue) =
            QueueDispatch::enqueue_ai_task(&state, "adapt-platforms", user_id, payload).await;
        return Ok(Json(
            json!({ "queued": true, "jobId": job_id, "queue": queue }),
        ));
    }

    let result = execute_adapt_platforms(&state, user_id, &payload).await?;
    Ok(Json(result))
}

async fn generate_image(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(dto): Json<GenerateImageDto>,
) -> ApiResult<Json<Value>> {
    let payload = json!({
        "tenantId": dto.tenant_id,
        "prompt": dto.prompt,
        "contentId": dto.content_id,
        "contentType": dto.content_type,
    });
    if QueueDispatch::is_enabled(&state.config) {
        let (job_id, queue) =
            QueueDispatch::enqueue_ai_task(&state, "generate-image", user_id, payload).await;
        return Ok(Json(
            json!({ "queued": true, "jobId": job_id, "queue": queue }),
        ));
    }

    let result = execute_generate_image(&state, user_id, &payload).await?;
    Ok(Json(result))
}

async fn generate_slideshow(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(dto): Json<GenerateSlideshowDto>,
) -> ApiResult<Json<Value>> {
    if dto.theme.trim().is_empty() {
        return Err(ApiError::BadRequest("theme is required".into()));
    }
    let payload = json!({
        "tenantId": dto.tenant_id,
        "theme": dto.theme,
        "slideCount": dto.slide_count,
        "contentId": dto.content_id,
    });
    if QueueDispatch::is_enabled(&state.config) {
        let (job_id, queue) =
            QueueDispatch::enqueue_ai_task(&state, "generate-slideshow", user_id, payload).await;
        return Ok(Json(
            json!({ "queued": true, "jobId": job_id, "queue": queue }),
        ));
    }

    let result = execute_generate_slideshow(&state, user_id, &payload).await?;
    Ok(Json(result))
}

async fn auto_publish(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let result = AutoPublishService::publish_due_items(&state).await?;
    Ok(Json(json!({
        "attempted": result.attempted,
        "published": result.published,
        "failed": result.failed,
        "errors": result.errors,
        "queued": result.queued,
    })))
}

async fn daily_workflow(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(dto): Json<DailyWorkflowDto>,
) -> ApiResult<Json<Value>> {
    let payload = json!({
        "tenantId": dto.tenant_id,
        "workspaceId": dto.workspace_id,
    });
    if QueueDispatch::is_enabled(&state.config) {
        let (job_id, queue) =
            QueueDispatch::enqueue_ai_task(&state, "daily-workflow", user_id, payload).await;
        return Ok(Json(
            json!({ "queued": true, "jobId": job_id, "queue": queue }),
        ));
    }

    let result = execute_daily_workflow(&state, user_id, &payload).await?;
    Ok(Json(result))
}

async fn publish(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(content_id): Path<Uuid>,
    Json(payload): Json<PublishContentDto>,
) -> ApiResult<Json<Value>> {
    let item = ContentItemEntity::find_by_id(content_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Content item not found".into()))?;

    let platforms = match payload.platforms.clone() {
        Some(platforms) if !platforms.is_empty() => platforms,
        _ => item
            .platforms
            .clone()
            .unwrap_or_else(|| vec!["facebook".into()]),
    };

    let mut active: ContentItemActiveModel = item.clone().into();
    active.publish_attempts = Set(0);
    active.publish_failed_reason = Set(None);
    active.status = Set(Some("approved".into()));
    active.platforms = Set(Some(platforms.clone()));
    if let Some(platform_payloads) = payload.platform_payloads.clone() {
        active.platform_payloads = Set(Some(platform_payloads.into()));
    }
    if let Some(content_type) = payload.content_type.clone() {
        active.content_type = Set(content_type);
    }
    active.updated_at = Set(Utc::now().fixed_offset());
    active.update(&state.db).await?;

    let platform_payloads = parse_platform_payloads(payload.platform_payloads);

    if QueueDispatch::is_enabled(&state.config) {
        let (job_id, queue) = QueueDispatch::enqueue_publish(
            &state,
            item.tenant_id,
            content_id,
            user_id,
            Some(platforms.clone()),
        )
        .await;

        return Ok(Json(json!({
            "queued": true,
            "jobId": job_id,
            "queue": queue,
            "message": "Added to publish queue",
        })));
    }

    let result = PublishContentService::publish(
        &state,
        PublishParams {
            content_id,
            user_id,
            platforms: Some(platforms.clone()),
            platform_payloads,
        },
    )
    .await?;

    let publications = PublicationsService::find_by_content_id(&state, content_id).await?;

    Ok(Json(json!({
        "published": result.published,
        "results": result.results,
        "contentId": content_id,
        "platforms": platforms,
        "publications": publications
            .iter()
            .map(crate::modules::content_publications::publication_json)
            .collect::<Vec<_>>(),
    })))
}

fn parse_platform_payloads(raw: Option<Value>) -> Option<HashMap<String, PlatformPayloadStored>> {
    let val = raw?;
    serde_json::from_value(val).ok()
}

async fn resolve_tenant_id(
    state: &AppState,
    tenant_id: Option<Uuid>,
    workspace_id: Option<Uuid>,
) -> ApiResult<Uuid> {
    if let Some(tenant_id) = tenant_id {
        return Ok(tenant_id);
    }
    if let Some(workspace_id) = workspace_id {
        if let Some(ws) = WorkspaceEntity::find_by_id(workspace_id)
            .one(&state.db)
            .await?
        {
            return Ok(ws.tenant_id);
        }
    }
    Err(ApiError::BadRequest(
        "tenantId or workspaceId is required".into(),
    ))
}

async fn resolve_brand_profile(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<Option<crate::modules::brand_profiles::entity::Model>> {
    if let Some(workspace_id) = workspace_id {
        let profile = BrandProfileEntity::find()
            .filter(BrandProfileColumn::TenantId.eq(tenant_id))
            .filter(BrandProfileColumn::WorkspaceId.eq(workspace_id))
            .one(&state.db)
            .await?;
        if profile.is_some() {
            return Ok(profile);
        }
    }
    Ok(BrandProfileEntity::find()
        .filter(BrandProfileColumn::TenantId.eq(tenant_id))
        .filter(BrandProfileColumn::UserId.eq(user_id))
        .one(&state.db)
        .await?)
}

async fn generate_content_with_ai(
    mistral: &crate::config::MistralConfig,
    theme: &str,
    draft: Option<&str>,
    content_type: Option<&str>,
    platform: Option<&str>,
    brand: Option<&crate::modules::brand_profiles::entity::Model>,
) -> ApiResult<(String, String, i32)> {
    let is_reply = content_type == Some("reply");
    let system = if is_reply {
        format!(
            "You write high-quality reply copy for {}. Return ONLY JSON {{\"title\":\"...\",\"content\":\"...\"}}. {}",
            platform.unwrap_or("social"),
            brand_prompt_suffix(brand)
        )
    } else {
        format!(
            "You are a marketing copywriter. Return ONLY JSON {{\"title\":\"...\",\"content\":\"...\"}}. {}",
            brand_prompt_suffix(brand)
        )
    };
    let user = if is_reply {
        format!(
            "Post context:\n{}\n\nComment text:\n{}\n\nDraft a short helpful reply.",
            draft.unwrap_or("No post context provided."),
            theme
        )
    } else {
        format!(
            "Theme: {theme}\nDraft context: {}\nContent type: {}\nPlatform: {}\nCreate publish-ready copy.",
            draft.unwrap_or(""),
            content_type.unwrap_or("content"),
            platform.unwrap_or("social")
        )
    };
    let (data, tokens_used, _model) = MistralService::complete_json(
        mistral,
        vec![
            ChatMessage {
                role: "system".into(),
                content: system,
            },
            ChatMessage {
                role: "user".into(),
                content: user,
            },
        ],
        Some(if is_reply {
            MistralService::default_model(mistral)
        } else {
            MistralService::premium_model(mistral)
        }),
    )
    .await?;
    let title = data
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or(theme)
        .chars()
        .take(120)
        .collect::<String>();
    let content = data
        .get("content")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| format!("<p>{}</p>", escape_html(theme)));
    Ok((title, content, tokens_used))
}

fn brand_prompt_suffix(brand: Option<&crate::modules::brand_profiles::entity::Model>) -> String {
    if let Some(brand) = brand {
        format!(
            "Brand context: companyName={}, toneOfVoice={}, targetAudience={}, keywords={}",
            brand.company_name.as_deref().unwrap_or(""),
            brand.tone_of_voice.as_deref().unwrap_or(""),
            brand.target_audience.as_deref().unwrap_or(""),
            brand.keywords.as_deref().unwrap_or("")
        )
    } else {
        "No brand profile yet; use neutral professional tone.".into()
    }
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

async fn record_ai_usage(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    function_name: &str,
    tokens_used: i32,
) {
    let _ = AiUsageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        user_id: Set(user_id),
        function_name: Set(function_name.to_string()),
        tokens_used: Set(tokens_used.to_string()),
        created_at: Set(Utc::now().fixed_offset()),
    }
    .insert(&state.db)
    .await;
}

pub async fn process_queued_task(
    state: &AppState,
    task_type: &str,
    user_id: Uuid,
    payload: Value,
) -> ApiResult<()> {
    match task_type {
        "generate-content" => {
            execute_generate_content(state, user_id, &payload).await?;
            Ok(())
        }
        "repurpose-content" => {
            let content_id = parse_uuid(&payload, "contentId")
                .ok_or_else(|| ApiError::BadRequest("contentId is required".into()))?;
            let target_platform = payload
                .get("targetPlatform")
                .and_then(|v| v.as_str())
                .map(str::to_string);
            execute_repurpose_content(state, user_id, content_id, target_platform).await?;
            Ok(())
        }
        "adapt-platforms" => {
            execute_adapt_platforms(state, user_id, &payload).await?;
            Ok(())
        }
        "generate-image" => {
            execute_generate_image(state, user_id, &payload).await?;
            Ok(())
        }
        "generate-slideshow" => {
            execute_generate_slideshow(state, user_id, &payload).await?;
            Ok(())
        }
        "daily-workflow" => {
            execute_daily_workflow(state, user_id, &payload).await?;
            Ok(())
        }
        "suggest-comment-reply" => {
            let comment_id = parse_uuid(&payload, "commentReplyId")
                .ok_or_else(|| ApiError::BadRequest("commentReplyId is required".into()))?;
            let content =
                crate::modules::comment_replies::ai::suggest_reply(state, comment_id, user_id)
                    .await?;
            tracing::info!(
                comment_id = %comment_id,
                chars = content.len(),
                "Comment reply suggestion generated"
            );
            Ok(())
        }
        other => Err(ApiError::BadRequest(format!(
            "Unsupported AI task type: {other}"
        ))),
    }
}

pub async fn run_daily_workflow_for_tenants(
    state: &AppState,
    tenant_ids: &[Uuid],
) -> ApiResult<Value> {
    let mut generated = 0usize;
    let mut skipped = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for tenant_id in tenant_ids {
        let payload = json!({ "tenantId": tenant_id });
        match execute_daily_workflow(state, Uuid::nil(), &payload).await {
            Ok(result) => {
                generated += result
                    .get("generated")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as usize;
                skipped += result
                    .get("skipped")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as usize;
                if let Some(errs) = result.get("errors").and_then(|v| v.as_array()) {
                    for e in errs {
                        if let Some(s) = e.as_str() {
                            errors.push(s.to_string());
                        }
                    }
                }
            }
            Err(err) => errors.push(format!("{tenant_id}: {err}")),
        }
    }

    Ok(json!({
        "generated": generated,
        "skipped": skipped,
        "errors": errors,
    }))
}

async fn execute_generate_content(
    state: &AppState,
    user_id: Uuid,
    payload: &Value,
) -> ApiResult<Value> {
    let tenant_id = parse_uuid(payload, "tenantId");
    let workspace_id = parse_uuid(payload, "workspaceId");
    let tenant_id = resolve_tenant_id(state, tenant_id, workspace_id).await?;
    let theme = payload
        .get("theme")
        .or_else(|| payload.get("draft"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| ApiError::BadRequest("theme or draft content is required".into()))?;
    let brand = resolve_brand_profile(state, tenant_id, user_id, workspace_id).await?;
    let mistral = &state.config.mistral;
    let (title, content, tokens_used) = generate_content_with_ai(
        mistral,
        theme,
        payload.get("draft").and_then(|v| v.as_str()),
        payload.get("contentType").and_then(|v| v.as_str()),
        payload.get("platform").and_then(|v| v.as_str()),
        brand.as_ref(),
    )
    .await?;

    let mut content_item_id: Option<Uuid> = None;
    if payload
        .get("save")
        .and_then(|v| v.as_bool())
        .unwrap_or(true)
        && workspace_id.is_some()
        && payload.get("contentType").and_then(|v| v.as_str()) != Some("reply")
    {
        let brand_id = brand
            .as_ref()
            .map(|b| b.id)
            .ok_or_else(|| ApiError::BadRequest("Brand profile required".into()))?;
        let now = Utc::now().fixed_offset();
        let item = ContentItemActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(tenant_id),
            workspace_id: Set(workspace_id.unwrap()),
            user_id: Set(user_id),
            brand_profile_id: Set(Some(brand_id)),
            content_type: Set(
                payload
                    .get("contentType")
                    .and_then(|v| v.as_str())
                    .unwrap_or("content")
                    .to_string(),
            ),
            title: Set(title.clone()),
            content: Set(content.clone()),
            campaign_theme: Set(Some(theme.to_string())),
            status: Set(Some("draft".into())),
            platforms: Set(
                payload
                    .get("platform")
                    .and_then(|v| v.as_str())
                    .map(|p| vec![p.to_string()]),
            ),
            publish_attempts: Set(0),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&state.db)
        .await?;
        content_item_id = Some(item.id);
    }

    record_ai_usage(state, tenant_id, user_id, "generate-content", tokens_used).await;
    Ok(json!({
        "title": title,
        "content": content,
        "contentItemId": content_item_id,
        "tokensUsed": tokens_used,
    }))
}

async fn execute_repurpose_content(
    state: &AppState,
    user_id: Uuid,
    content_id: Uuid,
    target_platform: Option<String>,
) -> ApiResult<Value> {
    let source = ContentItemEntity::find_by_id(content_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Content item not found".into()))?;

    let brand =
        resolve_brand_profile(&state, source.tenant_id, user_id, Some(source.workspace_id)).await?;
    let mistral = &state.config.mistral;
    let targets = if let Some(platform) = target_platform {
        vec![platform]
    } else {
        ["linkedin", "instagram", "facebook", "twitter"]
            .iter()
            .filter(|p| {
                !source
                    .platforms
                    .as_ref()
                    .map(|ps| ps.iter().any(|v| v == **p))
                    .unwrap_or(false)
            })
            .map(|s| s.to_string())
            .collect()
    };

    let mut repurposed = 0;
    let mut tokens_total = 0;
    for platform in targets {
        let system = format!(
            "You adapt social content for {}. Return ONLY JSON {{\"title\":\"...\",\"content\":\"...\"}}.\n{}",
            platform,
            brand_prompt_suffix(brand.as_ref())
        );
        let user = format!(
            "Original title: {}\nOriginal content:\n{}\n\nAdapt for {}.",
            source.title, source.content, platform
        );
        let (data, tokens_used, _model) = MistralService::complete_json(
            mistral,
            vec![
                ChatMessage {
                    role: "system".into(),
                    content: system,
                },
                ChatMessage {
                    role: "user".into(),
                    content: user,
                },
            ],
            Some(MistralService::default_model(mistral)),
        )
        .await?;
        tokens_total += tokens_used;
        let now = Utc::now().fixed_offset();
        let title = data
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or(&format!("{} ({})", source.title, platform))
            .to_string();
        let content = data
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or(&source.content)
            .to_string();
        ContentItemActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(source.tenant_id),
            workspace_id: Set(source.workspace_id),
            user_id: Set(user_id),
            brand_profile_id: Set(source.brand_profile_id),
            content_type: Set(source.content_type.clone()),
            title: Set(title),
            content: Set(content),
            campaign_theme: Set(source.campaign_theme.clone()),
            status: Set(Some("draft".into())),
            platforms: Set(Some(vec![platform])),
            publish_attempts: Set(0),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&state.db)
        .await?;
        repurposed += 1;
    }

    record_ai_usage(
        state,
        source.tenant_id,
        user_id,
        "repurpose-content",
        tokens_total,
    )
    .await;
    Ok(json!({ "repurposed": repurposed, "tokensUsed": tokens_total }))
}

async fn execute_adapt_platforms(
    state: &AppState,
    user_id: Uuid,
    payload: &Value,
) -> ApiResult<Value> {
    let tenant_id = parse_uuid(payload, "tenantId")
        .ok_or_else(|| ApiError::BadRequest("tenantId is required".into()))?;
    let workspace_id = parse_uuid(payload, "workspaceId");
    let platforms = payload
        .get("platforms")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect::<Vec<_>>()
        })
        .filter(|p| !p.is_empty())
        .ok_or_else(|| ApiError::BadRequest("platforms is required".into()))?;
    let title = payload
        .get("title")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let content = payload
        .get("content")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| ApiError::BadRequest("content is required".into()))?;

    let brand = resolve_brand_profile(state, tenant_id, user_id, workspace_id).await?;
    let mistral = &state.config.mistral;
    let mut payloads = serde_json::Map::new();
    let mut tokens_total = 0;
    for platform in platforms {
        let system = format!(
            "Adapt copy for {} platform trends. Return ONLY JSON {{\"title\":\"...\",\"content\":\"...\"}}.\n{}",
            platform,
            brand_prompt_suffix(brand.as_ref())
        );
        let user = format!(
            "Original title: {}\nOriginal content:\n{}\n\nAdapt specifically for {}.",
            title.clone().unwrap_or_else(|| "Untitled".into()),
            content,
            platform
        );
        let (data, tokens_used, _model) = MistralService::complete_json(
            mistral,
            vec![
                ChatMessage {
                    role: "system".into(),
                    content: system,
                },
                ChatMessage {
                    role: "user".into(),
                    content: user,
                },
            ],
            Some(MistralService::default_model(mistral)),
        )
        .await?;
        tokens_total += tokens_used;
        payloads.insert(
            platform.clone(),
            json!({
                "title": data.get("title").and_then(|v| v.as_str()).unwrap_or(title.as_deref().unwrap_or(&platform)),
                "content": data.get("content").and_then(|v| v.as_str()).unwrap_or(content),
            }),
        );
    }

    record_ai_usage(state, tenant_id, user_id, "adapt-platforms", tokens_total).await;
    Ok(json!({
        "payloads": payloads,
        "tokensUsed": tokens_total,
    }))
}

async fn execute_generate_image(
    state: &AppState,
    user_id: Uuid,
    payload: &Value,
) -> ApiResult<Value> {
    let tenant_id = parse_uuid(payload, "tenantId")
        .ok_or_else(|| ApiError::BadRequest("tenantId is required".into()))?;
    let prompt = payload
        .get("prompt")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| ApiError::BadRequest("prompt is required".into()))?;
    let content_id = parse_uuid(payload, "contentId");

    let workspace_id = if let Some(content_id) = content_id {
        ContentItemEntity::find_by_id(content_id)
            .one(&state.db)
            .await?
            .map(|item| item.workspace_id)
    } else {
        None
    };
    let brand = resolve_brand_profile(state, tenant_id, user_id, workspace_id).await?;
    let mistral = &state.config.mistral;
    let full_prompt = [
        "Create a professional marketing image.".to_string(),
        prompt.to_string(),
        brand
            .as_ref()
            .and_then(|b| b.company_name.clone())
            .map(|v| format!("Brand: {v}"))
            .unwrap_or_default(),
        brand
            .as_ref()
            .and_then(|b| b.tone_of_voice.clone())
            .map(|v| format!("Tone: {v}"))
            .unwrap_or_default(),
    ]
    .into_iter()
    .filter(|s| !s.trim().is_empty())
    .collect::<Vec<_>>()
    .join(" ");

    let generated = MistralService::generate_image(mistral, &full_prompt).await?;
    let asset = MediaAssetActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        workspace_id: Set(workspace_id),
        content_id: Set(content_id),
        media_url: Set(generated.url.clone()),
        media_type: Set("image".into()),
        name: Set(Some(prompt.chars().take(120).collect())),
        uploaded_by: Set(Some(user_id)),
        created_at: Set(Utc::now().fixed_offset()),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    record_ai_usage(state, tenant_id, user_id, "generate-image", 100).await;
    Ok(json!({
        "media_url": generated.url,
        "media_type": "image",
        "mediaAssetId": asset.id,
    }))
}

async fn execute_generate_slideshow(
    state: &AppState,
    user_id: Uuid,
    payload: &Value,
) -> ApiResult<Value> {
    let tenant_id = parse_uuid(payload, "tenantId")
        .ok_or_else(|| ApiError::BadRequest("tenantId is required".into()))?;
    let theme = payload
        .get("theme")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| ApiError::BadRequest("theme is required".into()))?;
    let content_id = parse_uuid(payload, "contentId");
    let count = payload
        .get("slideCount")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(4)
        .clamp(2, 8);

    let mistral = &state.config.mistral;
    let mut slides = Vec::new();
    for i in 1..=count {
        let prompt = format!("{theme} - slide {i} of {count}, cohesive brand slideshow");
        let generated = MistralService::generate_image(mistral, &prompt).await?;
        let _asset = MediaAssetActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(tenant_id),
            workspace_id: Set(None),
            content_id: Set(content_id),
            media_url: Set(generated.url.clone()),
            media_type: Set("image".into()),
            name: Set(Some(prompt.chars().take(120).collect())),
            uploaded_by: Set(Some(user_id)),
            created_at: Set(Utc::now().fixed_offset()),
            ..Default::default()
        }
        .insert(&state.db)
        .await?;
        slides.push(generated.url);
    }

    record_ai_usage(state, tenant_id, user_id, "generate-slideshow", count * 100).await;
    Ok(json!({ "slides": slides }))
}

async fn execute_daily_workflow(
    state: &AppState,
    user_id: Uuid,
    payload: &Value,
) -> ApiResult<Value> {
    let tenant_id = parse_uuid(payload, "tenantId");
    let workspace_id = parse_uuid(payload, "workspaceId");

    let mut targets: Vec<(Uuid, Uuid, Option<Uuid>)> = Vec::new();
    if let Some(tenant_id) = tenant_id {
        let effective_user_id = if user_id.is_nil() {
            TenantEntity::find_by_id(tenant_id)
                .one(&state.db)
                .await?
                .map(|t| t.owner_id)
                .ok_or_else(|| ApiError::BadRequest("Tenant not found".into()))?
        } else {
            user_id
        };
        targets.push((tenant_id, effective_user_id, workspace_id));
    } else {
        let enabled = SubscriptionEntity::find()
            .filter(SubscriptionColumn::DailyWorkflowEnabled.eq(true))
            .filter(SubscriptionColumn::Status.eq("active"))
            .all(&state.db)
            .await?;
        for sub in enabled {
            if let Some(tenant) = TenantEntity::find_by_id(sub.tenant_id)
                .one(&state.db)
                .await?
            {
                targets.push((sub.tenant_id, tenant.owner_id, None));
            }
        }
    }

    let weekday = Utc::now().format("%A").to_string();
    let mut generated = 0usize;
    let mut skipped = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for (tenant_id, target_user_id, preferred_workspace_id) in targets {
        let workspace = if let Some(ws_id) = preferred_workspace_id {
            WorkspaceEntity::find()
                .filter(WorkspaceColumn::Id.eq(ws_id))
                .filter(WorkspaceColumn::TenantId.eq(tenant_id))
                .one(&state.db)
                .await?
        } else {
            WorkspaceEntity::find()
                .filter(WorkspaceColumn::TenantId.eq(tenant_id))
                .one(&state.db)
                .await?
        };
        let Some(workspace) = workspace else {
            skipped += 1;
            errors.push(format!("{tenant_id}: no workspace found"));
            continue;
        };

        let brand =
            resolve_brand_profile(state, tenant_id, target_user_id, Some(workspace.id)).await?;
        let Some(brand) = brand else {
            skipped += 1;
            errors.push(format!("{tenant_id}: brand profile incomplete"));
            continue;
        };
        if brand.company_name.is_none() && brand.description.is_none() {
            skipped += 1;
            errors.push(format!("{tenant_id}: brand profile incomplete"));
            continue;
        }

        let theme = [
            format!(
                "{} social post for {}",
                weekday,
                brand.company_name.as_deref().unwrap_or("your brand")
            ),
            brand
                .keywords
                .as_ref()
                .map(|v| format!("Keywords: {v}"))
                .unwrap_or_default(),
            brand
                .current_offers
                .as_ref()
                .map(|v| format!("Promote: {v}"))
                .unwrap_or_default(),
            brand
                .target_audience
                .as_ref()
                .map(|v| format!("Audience: {v}"))
                .unwrap_or_default(),
        ]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(". ");

        match generate_content_with_ai(
            &state.config.mistral,
            &theme,
            None,
            Some("content"),
            None,
            Some(&brand),
        )
        .await
        {
            Ok((title, content, tokens_used)) => {
                let now = Utc::now().fixed_offset();
                ContentItemActiveModel {
                    id: Set(Uuid::new_v4()),
                    tenant_id: Set(tenant_id),
                    workspace_id: Set(workspace.id),
                    user_id: Set(target_user_id),
                    brand_profile_id: Set(Some(brand.id)),
                    content_type: Set("content".into()),
                    title: Set(title),
                    content: Set(content),
                    campaign_theme: Set(Some(theme.clone())),
                    status: Set(Some("draft".into())),
                    publish_attempts: Set(0),
                    created_at: Set(now),
                    updated_at: Set(now),
                    ..Default::default()
                }
                .insert(&state.db)
                .await?;
                record_ai_usage(state, tenant_id, target_user_id, "daily-workflow", tokens_used)
                    .await;
                generated += 1;
            }
            Err(err) => {
                skipped += 1;
                errors.push(format!("{tenant_id}: {err}"));
            }
        }
    }

    Ok(json!({ "generated": generated, "skipped": skipped, "errors": errors }))
}

fn parse_uuid(payload: &Value, key: &str) -> Option<Uuid> {
    payload
        .get(key)
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
}
