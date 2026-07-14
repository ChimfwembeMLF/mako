use axum::body::Bytes;
use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::WidgetAuth;
use crate::common::{ApiError, ApiResult};
use crate::modules::chatbot::entity::config::Model as ConfigModel;
use crate::modules::chatbot::entity::message::{
    ActiveModel as MessageActiveModel, Column as MessageColumn, Entity as MessageEntity,
};
use crate::modules::chatbot::entity::session::{
    ActiveModel as SessionActiveModel, Column as SessionColumn, Entity as SessionEntity,
    Model as SessionModel,
};
use crate::services::mistral::{ChatMessage, MistralService};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/config", get(get_config))
        .route("/sessions", post(create_session))
        .route("/sessions/{id}/suggestions", post(get_suggestions))
        .route("/sessions/{id}/messages", post(send_message))
        .route(
            "/sessions/{session_id}/messages/{message_id}/speech",
            post(speak_message),
        )
}

#[derive(Deserialize, Validate)]
struct CreateWidgetSessionDto {
    #[serde(rename = "visitorId")]
    visitor_id: Option<String>,
    metadata: Option<Value>,
}

#[derive(Deserialize)]
struct SendMessageDto {
    content: String,
}

#[derive(Deserialize)]
struct WidgetSuggestionsDto {
    #[serde(rename = "lastAssistantMessage")]
    last_assistant_message: Option<String>,
}

async fn get_config(WidgetAuth { config, .. }: WidgetAuth) -> Json<Value> {
    Json(json!({
        "name": config.name,
        "welcomeMessage": config.welcome_message,
        "theme": config.widget_theme.clone().unwrap_or(json!({})),
        "isActive": config.is_active,
        "ttsEnabled": config.widget_tts_enabled,
        "suggestions": starter_suggestions(&config),
    }))
}

async fn create_session(
    WidgetAuth { key, config }: WidgetAuth,
    State(state): State<AppState>,
    Json(dto): Json<CreateWidgetSessionDto>,
) -> ApiResult<Json<Value>> {
    dto.validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let visitor_id = dto
        .visitor_id
        .unwrap_or_else(|| format!("{:x}", Uuid::new_v4().as_simple()));

    let now = Utc::now().fixed_offset();
    let session = SessionActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(key.tenant_id),
        config_id: Set(config.id),
        channel: Set("widget".into()),
        visitor_id: Set(Some(visitor_id.clone())),
        metadata: Set(dto.metadata),
        created_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(json!({
        "sessionId": session.id,
        "visitorId": visitor_id,
        "welcomeMessageId": null,
    })))
}

async fn get_suggestions(
    WidgetAuth { key, config }: WidgetAuth,
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
    Json(dto): Json<WidgetSuggestionsDto>,
) -> ApiResult<Json<Value>> {
    find_widget_session(&state, key.tenant_id, session_id).await?;

    let suggestions = if dto
        .last_assistant_message
        .as_ref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false)
    {
        generate_follow_up_suggestions(
            &state.config.mistral,
            &config,
            dto.last_assistant_message.as_deref().unwrap_or(""),
        )
            .await
            .unwrap_or_else(|| starter_suggestions(&config))
    } else {
        starter_suggestions(&config)
    };

    Ok(Json(json!({
        "suggestions": suggestions.into_iter().take(3).collect::<Vec<_>>(),
    })))
}

async fn send_message(
    WidgetAuth { key, config }: WidgetAuth,
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
    headers: axum::http::HeaderMap,
    Json(dto): Json<SendMessageDto>,
) -> ApiResult<Json<Value>> {
    if dto.content.trim().is_empty() {
        return Err(ApiError::BadRequest("content is required".into()));
    }

    let session = find_widget_session(&state, key.tenant_id, session_id).await?;
    let visitor_id = headers
        .get("x-visitor-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    if session.channel == "widget" {
        if let (Some(header_vid), Some(session_vid)) =
            (visitor_id.as_ref(), session.visitor_id.as_ref())
        {
            if header_vid != session_vid {
                return Err(ApiError::Forbidden("Session visitor mismatch".into()));
            }
        }
    }

    let now = Utc::now().fixed_offset();
    MessageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(key.tenant_id),
        session_id: Set(session_id),
        role: Set("user".into()),
        content: Set(dto.content),
        created_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    let history = MessageEntity::find()
        .filter(MessageColumn::TenantId.eq(key.tenant_id))
        .filter(MessageColumn::SessionId.eq(session_id))
        .order_by_desc(MessageColumn::CreatedAt)
        .all(&state.db)
        .await?;
    let mut messages = vec![ChatMessage {
        role: "system".into(),
        content: format!(
            "You are {}. Respond clearly and briefly for website visitors.",
            config.name
        ),
    }];
    for msg in history.iter().rev().take(config.max_context_messages.max(1) as usize) {
        if msg.role == "user" || msg.role == "assistant" {
            messages.push(ChatMessage {
                role: msg.role.clone(),
                content: msg.content.clone(),
            });
        }
    }
    let mistral = &state.config.mistral;
    let completion = MistralService::complete(mistral, messages, Some(config.model.clone()), false, Some(1000)).await;
    let (assistant_text, tokens_used, model_name) = match completion {
        Ok(v) => (v.content, Some(v.tokens_used), Some(v.model)),
        Err(_) => (
            "I am having trouble replying right now. Please try again shortly.".to_string(),
            None,
            Some(config.model.clone()),
        ),
    };

    let assistant = MessageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(key.tenant_id),
        session_id: Set(session_id),
        role: Set("assistant".into()),
        content: Set(assistant_text),
        citations: Set(Some(json!([]))),
        tokens_used: Set(tokens_used),
        model: Set(model_name),
        created_at: Set(Utc::now().fixed_offset()),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(json!({
        "messageId": assistant.id,
        "role": assistant.role,
        "content": assistant.content,
        "citations": assistant.citations.unwrap_or(json!([])),
    })))
}

async fn speak_message(
    WidgetAuth { key, config }: WidgetAuth,
    State(state): State<AppState>,
    Path((session_id, message_id)): Path<(Uuid, Uuid)>,
    headers: axum::http::HeaderMap,
) -> ApiResult<Response> {
    if !config.widget_tts_enabled {
        return Err(ApiError::BadRequest(
            "Text-to-speech is not enabled for this chatbot".into(),
        ));
    }

    let session = find_widget_session(&state, key.tenant_id, session_id).await?;
    let visitor_id = headers.get("x-visitor-id").and_then(|v| v.to_str().ok());

    if session.channel == "widget" {
        if let (Some(header_vid), Some(session_vid)) = (visitor_id, session.visitor_id.as_deref()) {
            if header_vid != session_vid {
                return Err(ApiError::Forbidden("Session visitor mismatch".into()));
            }
        }
    }

    let message = MessageEntity::find_by_id(message_id)
        .filter(MessageColumn::TenantId.eq(key.tenant_id))
        .filter(MessageColumn::SessionId.eq(session_id))
        .filter(MessageColumn::Role.eq("assistant"))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Assistant message not found".into()))?;

    let voice_id = config.mistral_voice_id.as_deref();
    let audio = crate::services::mistral_tts::MistralTtsService::speak_bytes(
        &state.config.mistral,
        &message.content,
        voice_id,
    )
    .await?;

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "audio/mpeg"),
            (header::CACHE_CONTROL, "private, max-age=3600"),
        ],
        Bytes::from(audio),
    )
        .into_response())
}

async fn find_widget_session(
    state: &AppState,
    tenant_id: Uuid,
    id: Uuid,
) -> ApiResult<SessionModel> {
    SessionEntity::find_by_id(id)
        .filter(SessionColumn::TenantId.eq(tenant_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Session not found".into()))
}

fn starter_suggestions(config: &ConfigModel) -> Vec<String> {
    if let Some(msg) = config.welcome_message.as_ref().filter(|m| !m.is_empty()) {
        return vec![format!("Ask about {}", config.name), msg.clone()];
    }
    vec![
        "What can you help me with?".to_string(),
        "Tell me about your services".to_string(),
    ]
}

async fn generate_follow_up_suggestions(
    mistral: &crate::config::MistralConfig,
    config: &ConfigModel,
    last_assistant_message: &str,
) -> Option<Vec<String>> {
    let messages = vec![
        ChatMessage {
            role: "system".into(),
            content: "Return JSON only: {\"suggestions\":[\"...\",\"...\",\"...\"]}. Max 3 short prompts."
                .into(),
        },
        ChatMessage {
            role: "user".into(),
            content: format!(
                "Bot name: {}\nAssistant just said:\n{}\nGenerate likely follow-up prompts.",
                config.name, last_assistant_message
            ),
        },
    ];
    let (data, _, _) = MistralService::complete_json(mistral, messages, Some(config.model.clone()))
        .await
        .ok()?;
    let suggestions = data
        .get("suggestions")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .take(3)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if suggestions.is_empty() {
        None
    } else {
        Some(suggestions)
    }
}

