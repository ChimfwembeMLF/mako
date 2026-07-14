#[allow(dead_code)]
pub mod dto;
pub mod entity;

use axum::{
    body::Bytes,
    extract::{Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::services::mistral_tts::MistralTtsService;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::chatbot::dto::{
    CreateApiKeyDto, CreateSessionDto, EscalateSessionDto, SendMessageDto,
    TtsPreviewDto, UpdateChatbotConfigDto,
};
use crate::modules::chatbot::entity::api_key::{
    ActiveModel as ApiKeyActiveModel, Column as ApiKeyColumn, Entity as ApiKeyEntity,
    Model as ApiKeyModel,
};
use crate::modules::chatbot::entity::config::{
    ActiveModel as ConfigActiveModel, Column as ConfigColumn, Entity as ConfigEntity,
    Model as ConfigModel,
};
use crate::modules::chatbot::entity::message::{
    ActiveModel as MessageActiveModel, Column as MessageColumn, Entity as MessageEntity,
    Model as MessageModel,
};
use crate::modules::chatbot::entity::session::{
    ActiveModel as SessionActiveModel, Column as SessionColumn, Entity as SessionEntity,
    Model as SessionModel,
};
use crate::modules::chatbot::entity::tts_voice::{
    ActiveModel as TtsVoiceActiveModel, Column as TtsVoiceColumn, Entity as TtsVoiceEntity,
    Model as TtsVoiceModel,
};
use crate::services::mistral::{ChatMessage, MistralService};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/config", get(get_config).patch(update_config))
        .route("/config/avatar", post(upload_avatar))
        .route("/config/avatar-model", post(upload_avatar_model))
        .route("/config/keys", post(create_key))
        .route("/config/keys/{id}", delete(revoke_key))
        .route("/sessions", get(list_sessions).post(create_session))
        .route("/sessions/{id}", delete(delete_session))
        .route(
            "/sessions/{id}/messages",
            get(get_messages).post(send_message),
        )
        .route("/sessions/{id}/escalate", post(escalate_session))
        .route(
            "/sessions/{session_id}/messages/{message_id}/speech",
            post(speak_message),
        )
        .route("/tts/voices", get(list_tts_voices).post(clone_tts_voice))
        .route("/tts/voices/{id}", delete(delete_tts_voice))
        .route("/tts/preview", post(preview_tts))
}

#[derive(Deserialize)]
struct TenantQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct SessionListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    channel: Option<String>,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct SessionScopedQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
}

async fn get_config(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let config = get_or_create_config(&state, query.tenant_id, query.workspace_id).await?;
    let keys = ApiKeyEntity::find()
        .filter(ApiKeyColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(ApiKeyColumn::CreatedAt)
        .all(&state.db)
        .await?;

    Ok(Json(json!({
        "config": config_json(&config),
        "keys": keys.iter().map(api_key_json).collect::<Vec<_>>(),
    })))
}

async fn upload_avatar(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
    body: Bytes,
) -> ApiResult<Json<Value>> {
    let config = get_or_create_config(&state, query.tenant_id, query.workspace_id).await?;
    let key = format!("{}-{}", Uuid::new_v4().as_simple(), body.len());
    let url = format!(
        "/media/chatbot-avatar/{}/{}.png",
        query.tenant_id,
        key
    );
    let mut active: ConfigActiveModel = config.clone().into();
    let mut theme = config.widget_theme.unwrap_or(json!({}));
    if let Some(obj) = theme.as_object_mut() {
        obj.insert("avatarUrl".into(), json!(url));
    }
    active.widget_theme = Set(Some(theme));
    let updated = active.update(&state.db).await?;
    Ok(Json(json!({
        "configId": updated.id,
        "avatarUrl": updated.widget_theme.and_then(|v| v.get("avatarUrl").cloned()),
    })))
}

async fn upload_avatar_model(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
    body: Bytes,
) -> ApiResult<Json<Value>> {
    let config = get_or_create_config(&state, query.tenant_id, query.workspace_id).await?;
    let key = format!("{}-{}", Uuid::new_v4().as_simple(), body.len());
    let url = format!(
        "/media/chatbot-avatar-model/{}/{}.glb",
        query.tenant_id,
        key
    );
    let mut active: ConfigActiveModel = config.clone().into();
    let mut theme = config.widget_theme.unwrap_or(json!({}));
    if let Some(obj) = theme.as_object_mut() {
        obj.insert("avatarModelUrl".into(), json!(url));
        obj.insert("avatarMode".into(), json!("3d"));
        obj.insert("avatarModelBytes".into(), json!(body.len()));
    }
    active.widget_theme = Set(Some(theme));
    let updated = active.update(&state.db).await?;
    Ok(Json(json!({
        "configId": updated.id,
        "avatarModelUrl": updated.widget_theme.and_then(|v| v.get("avatarModelUrl").cloned()),
    })))
}

async fn update_config(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<UpdateChatbotConfigDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = get_or_create_config(&state, payload.tenant_id, payload.workspace_id).await?;
    let mut active: ConfigActiveModel = existing.into();

    if let Some(v) = payload.workspace_id {
        active.workspace_id = Set(Some(v));
    }
    if let Some(v) = payload.name {
        active.name = Set(v);
    }
    if let Some(v) = payload.welcome_message {
        active.welcome_message = Set(Some(v));
    }
    if let Some(v) = payload.system_prompt_extra {
        active.system_prompt_extra = Set(Some(v));
    }
    if let Some(v) = payload.brand_profile_id {
        active.brand_profile_id = Set(Some(v));
    }
    if let Some(v) = payload.model {
        active.model = Set(v);
    }
    if let Some(v) = payload.temperature {
        active.temperature = Set(v);
    }
    if let Some(v) = payload.max_context_messages {
        active.max_context_messages = Set(v);
    }
    if let Some(v) = payload.rag_enabled {
        active.rag_enabled = Set(v);
    }
    if let Some(v) = payload.rag_top_k {
        active.rag_top_k = Set(v);
    }
    if let Some(v) = payload.rag_min_score {
        active.rag_min_score = Set(v);
    }
    if let Some(v) = payload.widget_enabled {
        active.widget_enabled = Set(v);
    }
    if let Some(v) = payload.widget_theme {
        active.widget_theme = Set(Some(v));
    }
    if let Some(v) = payload.allowed_origins {
        active.allowed_origins = Set(Some(v));
    }
    if let Some(v) = payload.is_active {
        active.is_active = Set(v);
    }
    if let Some(v) = payload.use_mistral_library {
        active.use_mistral_library = Set(v);
    }
    if let Some(v) = payload.widget_tts_enabled {
        active.widget_tts_enabled = Set(v);
    }
    if let Some(v) = payload.mistral_voice_id {
        active.mistral_voice_id = Set(Some(v));
    }
    active.updated_at = Set(Utc::now().fixed_offset());

    let updated = active.update(&state.db).await?;
    Ok(Json(config_json(&updated)))
}

async fn create_key(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateApiKeyDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let config = get_or_create_config(&state, payload.tenant_id, None).await?;
    let prefix = format!("pk_live_{}", hex_bytes(4));
    let secret_suffix = hex_bytes(18);
    let secret = format!("{prefix}_{secret_suffix}");
    let now = Utc::now().fixed_offset();

    let key = ApiKeyActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        config_id: Set(config.id),
        key_prefix: Set(prefix.clone()),
        key_hash: Set(hash_key(&secret)),
        label: Set(payload.label),
        created_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(json!({
        "id": key.id,
        "keyPrefix": key.key_prefix,
        "secret": secret,
        "label": key.label,
    })))
}

async fn revoke_key(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let key = ApiKeyEntity::find_by_id(id)
        .filter(ApiKeyColumn::TenantId.eq(query.tenant_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("API key not found".into()))?;

    let mut active: ApiKeyActiveModel = key.into();
    active.revoked_at = Set(Some(Utc::now().fixed_offset()));
    active.update(&state.db).await?;

    Ok(Json(json!({ "success": true })))
}

async fn list_sessions(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<SessionListQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = SessionEntity::find()
        .filter(SessionColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(SessionColumn::LastMessageAt);

    if let Some(channel) = query.channel {
        db_query = db_query.filter(SessionColumn::Channel.eq(channel));
    }
    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(SessionColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(session_json)
        .collect::<Vec<_>>())))
}

async fn create_session(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateSessionDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let config = get_or_create_config(&state, payload.tenant_id, payload.workspace_id).await?;
    let now = Utc::now().fixed_offset();
    let session = SessionActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        workspace_id: Set(payload.workspace_id),
        config_id: Set(config.id),
        channel: Set("admin".into()),
        user_id: Set(Some(user_id)),
        title: Set(payload.title),
        metadata: Set(payload.metadata),
        created_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(session_json(&session)))
}

async fn get_messages(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<SessionScopedQuery>,
) -> ApiResult<Json<Value>> {
    find_session(&state, query.tenant_id, id).await?;
    let rows = MessageEntity::find()
        .filter(MessageColumn::TenantId.eq(query.tenant_id))
        .filter(MessageColumn::SessionId.eq(id))
        .order_by_asc(MessageColumn::CreatedAt)
        .all(&state.db)
        .await?;

    Ok(Json(json!(rows
        .iter()
        .map(message_json)
        .collect::<Vec<_>>())))
}

async fn escalate_session(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<SessionScopedQuery>,
    Json(payload): Json<EscalateSessionDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = find_session(&state, query.tenant_id, id).await?;
    let mut active: SessionActiveModel = existing.clone().into();
    let mut metadata = existing.metadata.unwrap_or_else(|| json!({}));
    if let Some(obj) = metadata.as_object_mut() {
        obj.insert("escalated".into(), json!(true));
        obj.insert("escalatedAt".into(), json!(Utc::now().to_rfc3339()));
        obj.insert("visitorEmail".into(), json!(payload.visitor_email));
        obj.insert("lastEscalationMessage".into(), json!(payload.user_message));
    }
    active.metadata = Set(Some(metadata));
    active.last_message_at = Set(Some(Utc::now().fixed_offset()));
    active.update(&state.db).await?;

    MessageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(query.tenant_id),
        session_id: Set(id),
        role: Set("assistant".into()),
        content: Set("Your request has been escalated to support. We will follow up shortly.".into()),
        citations: Set(Some(json!([]))),
        model: Set(Some("workflow/escalation".into())),
        created_at: Set(Utc::now().fixed_offset()),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(json!({
        "sessionId": id,
        "escalated": true,
        "ticketId": format!("SUP-{}", Uuid::new_v4().as_simple()),
        "userMessage": payload.user_message,
        "visitorEmail": payload.visitor_email,
        "message": "Support escalation has been recorded",
    })))
}

async fn send_message(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<SessionScopedQuery>,
    Json(payload): Json<SendMessageDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let session = find_session(&state, query.tenant_id, id).await?;
    let config = get_or_create_config(&state, query.tenant_id, session.workspace_id).await?;
    let now = Utc::now().fixed_offset();

    let user_message = MessageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(query.tenant_id),
        session_id: Set(id),
        role: Set("user".into()),
        content: Set(payload.content.clone()),
        created_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    let history = MessageEntity::find()
        .filter(MessageColumn::TenantId.eq(query.tenant_id))
        .filter(MessageColumn::SessionId.eq(id))
        .order_by_desc(MessageColumn::CreatedAt)
        .all(&state.db)
        .await?;
    let mut messages = vec![ChatMessage {
        role: "system".into(),
        content: format!(
            "You are {}. Keep answers concise, helpful, and aligned with provided context.",
            config.name
        ),
    }];
    for item in history.iter().rev().take(config.max_context_messages.max(1) as usize) {
        if item.role == "user" || item.role == "assistant" {
            messages.push(ChatMessage {
                role: item.role.clone(),
                content: item.content.clone(),
            });
        }
    }
    messages.push(ChatMessage {
        role: "user".into(),
        content: payload.content.clone(),
    });

    let mistral = &state.config.mistral;
    let ai = MistralService::complete(mistral, messages, Some(config.model.clone()), false, Some(1200)).await;
    let (assistant_content, model, tokens_used) = match ai {
        Ok(res) => (res.content, Some(res.model), Some(res.tokens_used)),
        Err(_) => (
            "I could not generate a response right now. Please try again in a moment."
                .to_string(),
            Some(config.model.clone()),
            None,
        ),
    };
    let assistant_message = MessageActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(query.tenant_id),
        session_id: Set(id),
        role: Set("assistant".into()),
        content: Set(assistant_content),
        citations: Set(Some(json!([]))),
        tokens_used: Set(tokens_used),
        model: Set(model),
        created_at: Set(Utc::now().fixed_offset()),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    let mut session_active: SessionActiveModel =
        find_session(&state, query.tenant_id, id).await?.into();
    session_active.last_message_at = Set(Some(Utc::now().fixed_offset()));
    let _ = session_active.update(&state.db).await;
    let _ = user_id;

    Ok(Json(json!({
        "userMessageId": user_message.id,
        "messageId": assistant_message.id,
        "role": assistant_message.role,
        "content": assistant_message.content,
        "citations": assistant_message.citations.unwrap_or(json!([])),
    })))
}

async fn list_tts_voices(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let presets = MistralTtsService::list_preset_voices(&state.config.mistral)
        .await
        .unwrap_or_default();
    let rows = TtsVoiceEntity::find()
        .filter(TtsVoiceColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(TtsVoiceColumn::CreatedAt)
        .all(&state.db)
        .await?;
    let config = get_or_create_config(&state, query.tenant_id, None).await?;

    Ok(Json(json!({
        "presets": presets,
        "custom": rows.iter().map(tts_voice_json).collect::<Vec<_>>(),
        "selectedVoiceId": config.mistral_voice_id,
    })))
}

async fn clone_tts_voice(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
    mut multipart: Multipart,
) -> ApiResult<Json<Value>> {
    let mut name = String::new();
    let mut sample_bytes: Option<Vec<u8>> = None;
    let mut sample_filename = "voice-sample.webm".to_string();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
    {
        match field.name() {
            Some("name") => {
                name = field.text().await.unwrap_or_default();
            }
            Some("file") => {
                sample_filename = field.file_name().unwrap_or("voice-sample.webm").to_string();
                sample_bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| ApiError::BadRequest(e.to_string()))?
                        .to_vec(),
                );
            }
            _ => {}
        }
    }

    if name.trim().is_empty() {
        return Err(ApiError::BadRequest("name is required".into()));
    }
    let sample = sample_bytes.ok_or_else(|| ApiError::BadRequest("file is required".into()))?;

    let (mistral_voice_id, voice_name) = MistralTtsService::clone_voice(
        &state.config.mistral,
        name.trim(),
        &sample,
        &sample_filename,
        &query.tenant_id.to_string(),
    )
    .await?;

    let voice = TtsVoiceActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(query.tenant_id),
        mistral_voice_id: Set(mistral_voice_id.clone()),
        name: Set(voice_name),
        created_by: Set(Some(user_id)),
        created_at: Set(Utc::now().fixed_offset()),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    let config = get_or_create_config(&state, query.tenant_id, None).await?;
    let mut config_active: ConfigActiveModel = config.into();
    config_active.mistral_voice_id = Set(Some(mistral_voice_id.clone()));
    config_active.updated_at = Set(Utc::now().fixed_offset());
    config_active.update(&state.db).await?;

    Ok(Json(json!({
        "voice": tts_voice_json(&voice),
        "selectedVoiceId": mistral_voice_id,
    })))
}

async fn delete_tts_voice(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let voice = TtsVoiceEntity::find_by_id(id)
        .filter(TtsVoiceColumn::TenantId.eq(query.tenant_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("TTS voice not found".into()))?;

    let _ = MistralTtsService::delete_custom_voice(&state.config.mistral, &voice.mistral_voice_id)
        .await;

    TtsVoiceEntity::delete_by_id(id).exec(&state.db).await?;

    let config = get_or_create_config(&state, query.tenant_id, None).await?;
    if config.mistral_voice_id.as_deref() == Some(voice.mistral_voice_id.as_str()) {
        let mut config_active: ConfigActiveModel = config.into();
        config_active.mistral_voice_id = Set(None);
        config_active.updated_at = Set(Utc::now().fixed_offset());
        config_active.update(&state.db).await?;
    }

    Ok(Json(json!({ "success": true })))
}

async fn preview_tts(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
    Json(payload): Json<TtsPreviewDto>,
) -> ApiResult<Response> {
    if payload.voice_id.trim().is_empty() {
        return Err(ApiError::BadRequest("voiceId is required".into()));
    }
    let audio = MistralTtsService::speak_bytes(
        &state.config.mistral,
        payload
            .text
            .as_deref()
            .unwrap_or("Hello! This is a preview of your assistant voice."),
        Some(payload.voice_id.trim()),
    )
    .await?;
    let _ = query;
    Ok(audio_response(Bytes::from(audio), "no-store"))
}

async fn speak_message(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path((session_id, message_id)): Path<(Uuid, Uuid)>,
    Query(query): Query<SessionScopedQuery>,
) -> ApiResult<Response> {
    let config = get_or_create_config(&state, query.tenant_id, None).await?;
    if !config.widget_tts_enabled {
        return Err(ApiError::BadRequest(
            "Text-to-speech is not enabled for this chatbot".into(),
        ));
    }

    let message = MessageEntity::find_by_id(message_id)
        .filter(MessageColumn::TenantId.eq(query.tenant_id))
        .filter(MessageColumn::SessionId.eq(session_id))
        .filter(MessageColumn::Role.eq("assistant"))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Assistant message not found".into()))?;

    let voice_id = config.mistral_voice_id.as_deref();
    let audio = MistralTtsService::speak_bytes(&state.config.mistral, &message.content, voice_id)
        .await?;

    Ok(audio_response(
        Bytes::from(audio),
        "private, max-age=3600",
    ))
}

async fn delete_session(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<SessionScopedQuery>,
) -> ApiResult<Json<Value>> {
    find_session(&state, query.tenant_id, id).await?;
    SessionEntity::delete_by_id(id).exec(&state.db).await?;
    Ok(Json(json!({ "success": true })))
}

async fn get_or_create_config(
    state: &AppState,
    tenant_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<ConfigModel> {
    let mut query = ConfigEntity::find().filter(ConfigColumn::TenantId.eq(tenant_id));
    if let Some(ws) = workspace_id {
        query = query.filter(ConfigColumn::WorkspaceId.eq(ws));
    }

    if let Some(config) = query.one(&state.db).await? {
        return Ok(config);
    }

    let now = Utc::now().fixed_offset();
    ConfigActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        workspace_id: Set(workspace_id),
        name: Set("Website Assistant".into()),
        model: Set("mistral-small-latest".into()),
        temperature: Set(0.3),
        max_context_messages: Set(20),
        rag_enabled: Set(true),
        rag_top_k: Set(6),
        rag_min_score: Set(0.72),
        widget_enabled: Set(false),
        is_active: Set(true),
        use_mistral_library: Set(false),
        widget_tts_enabled: Set(false),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await
    .map_err(Into::into)
}

async fn find_session(state: &AppState, tenant_id: Uuid, id: Uuid) -> ApiResult<SessionModel> {
    SessionEntity::find_by_id(id)
        .filter(SessionColumn::TenantId.eq(tenant_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Session not found".into()))
}

fn config_json(config: &ConfigModel) -> Value {
    json!({
        "id": config.id,
        "tenantId": config.tenant_id,
        "workspaceId": config.workspace_id,
        "brandProfileId": config.brand_profile_id,
        "name": config.name,
        "welcomeMessage": config.welcome_message,
        "systemPromptExtra": config.system_prompt_extra,
        "model": config.model,
        "temperature": config.temperature,
        "maxContextMessages": config.max_context_messages,
        "ragEnabled": config.rag_enabled,
        "ragTopK": config.rag_top_k,
        "ragMinScore": config.rag_min_score,
        "widgetEnabled": config.widget_enabled,
        "widgetTheme": config.widget_theme,
        "allowedOrigins": config.allowed_origins,
        "isActive": config.is_active,
        "useMistralLibrary": config.use_mistral_library,
        "mistralLibraryId": config.mistral_library_id,
        "mistralAgentId": config.mistral_agent_id,
        "widgetTtsEnabled": config.widget_tts_enabled,
        "mistralVoiceId": config.mistral_voice_id,
        "created_at": config.created_at,
        "updated_at": config.updated_at,
    })
}

fn api_key_json(key: &ApiKeyModel) -> Value {
    json!({
        "id": key.id,
        "keyPrefix": key.key_prefix,
        "label": key.label,
        "lastUsedAt": key.last_used_at,
        "revokedAt": key.revoked_at,
        "created_at": key.created_at,
    })
}

fn session_json(session: &SessionModel) -> Value {
    json!({
        "id": session.id,
        "tenantId": session.tenant_id,
        "workspaceId": session.workspace_id,
        "configId": session.config_id,
        "channel": session.channel,
        "visitorId": session.visitor_id,
        "userId": session.user_id,
        "title": session.title,
        "metadata": session.metadata,
        "lastMessageAt": session.last_message_at,
        "created_at": session.created_at,
    })
}

fn message_json(message: &MessageModel) -> Value {
    json!({
        "id": message.id,
        "tenantId": message.tenant_id,
        "sessionId": message.session_id,
        "role": message.role,
        "content": message.content,
        "citations": message.citations,
        "tokensUsed": message.tokens_used,
        "model": message.model,
        "latencyMs": message.latency_ms,
        "created_at": message.created_at,
    })
}

fn tts_voice_json(voice: &TtsVoiceModel) -> Value {
    json!({
        "id": voice.id,
        "tenantId": voice.tenant_id,
        "mistralVoiceId": voice.mistral_voice_id,
        "name": voice.name,
        "createdBy": voice.created_by,
        "created_at": voice.created_at,
    })
}

fn hash_key(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn hex_bytes(n: usize) -> String {
    let mut bytes = vec![0u8; n];
    getrandom::fill(&mut bytes).unwrap_or(());
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn audio_response(bytes: Bytes, cache_control: &str) -> Response {
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "audio/mpeg"),
            (header::CACHE_CONTROL, cache_control),
        ],
        bytes,
    )
        .into_response()
}

