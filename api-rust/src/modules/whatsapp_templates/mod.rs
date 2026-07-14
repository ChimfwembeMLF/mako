pub mod dto;
pub mod entity;

use axum::{
    extract::{Path, Query, State},
    routing::{get, patch, post},
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
use crate::modules::social_accounts::entity::{
    Column as SocialAccountColumn, Entity as SocialAccountEntity, Model as SocialAccountModel,
};
use crate::modules::whatsapp_templates::dto::{
    CreateWhatsappTemplateDto, ImportFromMetaDto, UpdateWhatsappTemplateDto,
};
use crate::modules::whatsapp_templates::entity::{
    ActiveModel as TemplateActiveModel, Column as TemplateColumn, Entity as TemplateEntity,
    Model as TemplateModel,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/meta", get(list_from_meta))
        .route("/import", post(import_from_meta))
        .route("/sync-all", post(sync_all))
        .route("/", get(list).post(create))
        .route("/{id}", patch(update).delete(remove))
        .route("/{id}/submit", post(submit))
        .route("/{id}/sync", post(sync_one))
}

#[derive(Deserialize)]
struct TenantQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
}

async fn list(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let mut db_query = TemplateEntity::find()
        .filter(TemplateColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(TemplateColumn::UpdatedAt);

    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(TemplateColumn::WorkspaceId.eq(workspace_id));
    }

    let rows = db_query.all(&state.db).await?;
    Ok(Json(json!(rows
        .iter()
        .map(template_json)
        .collect::<Vec<_>>())))
}

async fn create(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateWhatsappTemplateDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let now = Utc::now().fixed_offset();
    let template = TemplateActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        workspace_id: Set(payload.workspace_id),
        name: Set(payload.name),
        language: Set(payload.language.unwrap_or_else(|| "en".into())),
        category: Set(payload.category.unwrap_or_else(|| "UTILITY".into())),
        status: Set("DRAFT".into()),
        components: Set(payload.components.unwrap_or_else(|| json!([]))),
        variables: Set(payload.variables.unwrap_or_else(|| json!([]))),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(template_json(&template)))
}

async fn update(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
    Json(payload): Json<UpdateWhatsappTemplateDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let existing = find_template(&state, id, query.tenant_id).await?;
    let mut active: TemplateActiveModel = existing.into();

    if let Some(v) = payload.name {
        active.name = Set(v);
    }
    if let Some(v) = payload.language {
        active.language = Set(v);
    }
    if let Some(v) = payload.category {
        active.category = Set(v);
    }
    if let Some(v) = payload.status {
        active.status = Set(v);
    }
    if let Some(v) = payload.components {
        active.components = Set(v);
    }
    if let Some(v) = payload.variables {
        active.variables = Set(v);
    }
    if let Some(v) = payload.meta_template_id {
        active.meta_template_id = Set(Some(v));
    }
    if let Some(v) = payload.rejection_reason {
        active.rejection_reason = Set(Some(v));
    }
    active.updated_at = Set(Utc::now().fixed_offset());

    let updated = active.update(&state.db).await?;
    Ok(Json(template_json(&updated)))
}

async fn remove(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let _ = find_template(&state, id, query.tenant_id).await?;
    TemplateEntity::delete_by_id(id).exec(&state.db).await?;
    Ok(Json(json!({ "success": true })))
}

async fn submit(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let mut existing = find_template(&state, id, query.tenant_id).await?;
    let account =
        find_whatsapp_account(&state, query.tenant_id, user_id, query.workspace_id).await?;
    let Some(account) = account else {
        return Err(ApiError::BadRequest("WhatsApp not connected".into()));
    };
    let Some(creds) = whatsapp_credentials_from_account(&account) else {
        return Err(ApiError::BadRequest("WhatsApp credentials missing".into()));
    };
    let waba_id = resolve_waba_id(&creds).await?;

    let payload = json!({
        "name": existing.name,
        "language": existing.language,
        "category": existing.category,
        "components": existing.components,
    });
    let submit_url = format!(
        "https://graph.facebook.com/v19.0/{}/message_templates",
        urlencoding::encode(&waba_id)
    );
    let client = Client::new();
    let response = client
        .post(submit_url)
        .bearer_auth(&creds.access_token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(format!("Meta submit failed: {e}")))?;
    let data = response
        .json::<Value>()
        .await
        .unwrap_or_else(|_| json!({ "error": { "message": "Invalid Meta response" } }));
    if data.get("error").is_some() {
        return Err(ApiError::BadRequest(format!(
            "Meta rejected the submission: {}",
            graph_error_summary(&data)
        )));
    }

    if let Some(meta_id) = data.get("id").and_then(|v| v.as_str()) {
        existing.meta_template_id = Some(meta_id.to_string());
    }

    let mut active: TemplateActiveModel = existing.into();
    active.status = Set("PENDING".into());
    if let sea_orm::ActiveValue::NotSet = active.meta_template_id {
        active.meta_template_id = Set(Some(format!("meta-{}", Uuid::new_v4())));
    }
    active.rejection_reason = Set(None);
    active.synced_at = Set(Some(Utc::now().fixed_offset()));
    active.updated_at = Set(Utc::now().fixed_offset());
    let updated = active.update(&state.db).await?;

    Ok(Json(json!({
        "template": template_json(&updated),
        "message": "Submitted to Meta for approval",
    })))
}

async fn sync_one(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let existing = find_template(&state, id, query.tenant_id).await?;
    let account =
        find_whatsapp_account(&state, query.tenant_id, user_id, query.workspace_id).await?;
    let Some(account) = account else {
        return Err(ApiError::BadRequest("WhatsApp not connected".into()));
    };
    let Some(creds) = whatsapp_credentials_from_account(&account) else {
        return Err(ApiError::BadRequest("WhatsApp credentials missing".into()));
    };
    let waba_id = resolve_waba_id(&creds).await?;
    let remote = fetch_meta_template_by_name(&waba_id, &creds.access_token, &existing.name).await?;

    let mut active: TemplateActiveModel = existing.into();
    if let Some(meta_id) = remote
        .get("id")
        .or_else(|| remote.get("metaId"))
        .and_then(|v| v.as_str())
    {
        active.meta_template_id = Set(Some(meta_id.to_string()));
    }
    if let Some(status) = remote.get("status").and_then(|v| v.as_str()) {
        active.status = Set(status.to_string());
    }
    if let Some(reason) = remote
        .get("rejected_reason")
        .or_else(|| remote.get("rejectionReason"))
        .and_then(|v| v.as_str())
        .filter(|v| !v.trim().is_empty())
    {
        active.rejection_reason = Set(Some(reason.to_string()));
    }
    if let Some(components) = remote.get("components").cloned() {
        active.components = Set(components);
    }
    active.synced_at = Set(Some(Utc::now().fixed_offset()));
    active.updated_at = Set(Utc::now().fixed_offset());
    let updated = active.update(&state.db).await?;

    Ok(Json(json!({
        "template": template_json(&updated),
        "message": "Synced template status from Meta",
    })))
}

async fn sync_all(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let account =
        find_whatsapp_account(&state, query.tenant_id, user_id, query.workspace_id).await?;
    let Some(account) = account else {
        return Err(ApiError::BadRequest("WhatsApp not connected".into()));
    };
    let Some(creds) = whatsapp_credentials_from_account(&account) else {
        return Err(ApiError::BadRequest("WhatsApp credentials missing".into()));
    };
    let waba_id = resolve_waba_id(&creds).await?;

    let mut db_query = TemplateEntity::find()
        .filter(TemplateColumn::TenantId.eq(query.tenant_id))
        .order_by_desc(TemplateColumn::UpdatedAt);
    if let Some(workspace_id) = query.workspace_id {
        db_query = db_query.filter(TemplateColumn::WorkspaceId.eq(workspace_id));
    }
    let rows = db_query.all(&state.db).await?;
    let mut synced = 0usize;
    let mut errors = 0usize;
    for row in rows
        .into_iter()
        .filter(|t| t.status == "PENDING" || t.status == "APPROVED")
    {
        let mut active: TemplateActiveModel = row.clone().into();
        match fetch_meta_template_by_name(&waba_id, &creds.access_token, &row.name).await {
            Ok(remote) => {
                if let Some(meta_id) = remote
                    .get("id")
                    .or_else(|| remote.get("metaId"))
                    .and_then(|v| v.as_str())
                {
                    active.meta_template_id = Set(Some(meta_id.to_string()));
                }
                if let Some(status) = remote.get("status").and_then(|v| v.as_str()) {
                    active.status = Set(status.to_string());
                }
                if let Some(reason) = remote
                    .get("rejected_reason")
                    .or_else(|| remote.get("rejectionReason"))
                    .and_then(|v| v.as_str())
                    .filter(|v| !v.trim().is_empty())
                {
                    active.rejection_reason = Set(Some(reason.to_string()));
                }
                if let Some(components) = remote.get("components").cloned() {
                    active.components = Set(components);
                }
                active.synced_at = Set(Some(Utc::now().fixed_offset()));
                active.updated_at = Set(Utc::now().fixed_offset());
                active.update(&state.db).await?;
                synced += 1;
            }
            Err(_) => errors += 1,
        }
    }

    Ok(Json(json!({
        "tenantId": query.tenant_id,
        "synced": synced,
        "errors": errors,
        "message": "Synced templates from Meta",
    })))
}

async fn list_from_meta(
    AuthUser { id: user_id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
) -> ApiResult<Json<Value>> {
    let account =
        find_whatsapp_account(&state, query.tenant_id, user_id, query.workspace_id).await?;
    let Some(account) = account else {
        return Ok(Json(json!({
            "templates": [],
            "message": "WhatsApp not connected",
        })));
    };
    let Some(creds) = whatsapp_credentials_from_account(&account) else {
        return Ok(Json(json!({
            "templates": [],
            "message": "WhatsApp credentials missing",
        })));
    };
    let waba_id = resolve_waba_id(&creds).await?;
    let templates = list_meta_templates(&waba_id, &creds.access_token).await?;

    Ok(Json(json!({
        "templates": templates,
        "message": "Fetched templates from Meta",
    })))
}

async fn import_from_meta(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TenantQuery>,
    Json(body): Json<ImportFromMetaDto>,
) -> ApiResult<Json<Value>> {
    let now = Utc::now().fixed_offset();
    if let Some(existing) = TemplateEntity::find()
        .filter(TemplateColumn::TenantId.eq(query.tenant_id))
        .filter(TemplateColumn::Name.eq(body.name.clone()))
        .filter(TemplateColumn::Language.eq(body.language.clone()))
        .one(&state.db)
        .await?
    {
        let mut active: TemplateActiveModel = existing.into();
        active.category = Set(body.category.clone().unwrap_or_else(|| "UTILITY".into()));
        active.status = Set(body.status.clone());
        active.components = Set(body.components.clone());
        active.meta_template_id = Set(Some(body.meta_id.clone()));
        active.synced_at = Set(Some(now));
        active.updated_at = Set(now);
        let updated = active.update(&state.db).await?;
        return Ok(Json(template_json(&updated)));
    }

    let template = TemplateActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(query.tenant_id),
        workspace_id: Set(query.workspace_id),
        name: Set(body.name),
        language: Set(body.language),
        category: Set(body.category.unwrap_or_else(|| "UTILITY".into())),
        status: Set(body.status),
        components: Set(body.components),
        variables: Set(json!([])),
        meta_template_id: Set(Some(body.meta_id)),
        synced_at: Set(Some(now)),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(Json(template_json(&template)))
}

async fn find_template(state: &AppState, id: Uuid, tenant_id: Uuid) -> ApiResult<TemplateModel> {
    TemplateEntity::find_by_id(id)
        .filter(TemplateColumn::TenantId.eq(tenant_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Template not found".into()))
}

fn template_json(t: &TemplateModel) -> Value {
    json!({
        "id": t.id,
        "tenantId": t.tenant_id,
        "workspaceId": t.workspace_id,
        "name": t.name,
        "language": t.language,
        "category": t.category,
        "status": t.status,
        "components": t.components,
        "variables": t.variables,
        "metaTemplateId": t.meta_template_id,
        "rejectionReason": t.rejection_reason,
        "syncedAt": t.synced_at,
        "createdAt": t.created_at,
        "updatedAt": t.updated_at,
    })
}

struct WhatsappCredentials {
    phone_number_id: String,
    access_token: String,
}

async fn find_whatsapp_account(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<Option<SocialAccountModel>> {
    let mut user_query = SocialAccountEntity::find()
        .filter(SocialAccountColumn::TenantId.eq(tenant_id))
        .filter(SocialAccountColumn::Platform.eq("whatsapp"))
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
        .filter(SocialAccountColumn::Platform.eq("whatsapp"))
        .filter(SocialAccountColumn::Connected.eq(true));
    if let Some(workspace_id) = workspace_id {
        tenant_query = tenant_query.filter(SocialAccountColumn::WorkspaceId.eq(workspace_id));
    }
    Ok(tenant_query.one(&state.db).await?)
}

fn whatsapp_credentials_from_account(account: &SocialAccountModel) -> Option<WhatsappCredentials> {
    let phone_number_id = account
        .metadata
        .as_ref()
        .and_then(|m| m.get("phone_number_id"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
        .or_else(|| account.external_id.clone())?;
    let access_token = account
        .access_token
        .as_ref()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())?;
    Some(WhatsappCredentials {
        phone_number_id,
        access_token,
    })
}

async fn resolve_waba_id(creds: &WhatsappCredentials) -> ApiResult<String> {
    let url = format!(
        "https://graph.facebook.com/v19.0/{}",
        urlencoding::encode(&creds.phone_number_id)
    );
    let client = Client::new();
    let response = client
        .get(url)
        .query(&[
            ("fields", "whatsapp_business_account"),
            ("access_token", creds.access_token.as_str()),
        ])
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to resolve WABA: {e}")))?;
    let data = response
        .json::<Value>()
        .await
        .unwrap_or_else(|_| json!({ "error": { "message": "Invalid Graph response" } }));
    if data.get("error").is_some() {
        return Err(ApiError::BadRequest(graph_error_summary(&data)));
    }
    data.get("whatsapp_business_account")
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| {
            ApiError::BadRequest("Could not resolve WhatsApp Business Account ID".into())
        })
}

async fn list_meta_templates(waba_id: &str, access_token: &str) -> ApiResult<Vec<Value>> {
    let url = format!(
        "https://graph.facebook.com/v19.0/{}/message_templates",
        urlencoding::encode(waba_id)
    );
    let client = Client::new();
    let response = client
        .get(url)
        .query(&[
            ("access_token", access_token),
            ("limit", "100"),
            (
                "fields",
                "id,name,language,status,category,components,rejected_reason",
            ),
        ])
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(format!("Meta list failed: {e}")))?;
    let data = response
        .json::<Value>()
        .await
        .unwrap_or_else(|_| json!({ "error": { "message": "Invalid Graph response" } }));
    if data.get("error").is_some() {
        return Err(ApiError::BadRequest(graph_error_summary(&data)));
    }
    let arr = data
        .get("data")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(arr
        .into_iter()
        .map(|t| {
            json!({
                "id": t.get("id").and_then(|v| v.as_str()).unwrap_or_default(),
                "metaId": t.get("id").and_then(|v| v.as_str()).unwrap_or_default(),
                "name": t.get("name").and_then(|v| v.as_str()).unwrap_or_default(),
                "language": t.get("language").and_then(|v| v.as_str()).unwrap_or("en"),
                "status": t.get("status").and_then(|v| v.as_str()).unwrap_or("UNKNOWN"),
                "category": t.get("category").and_then(|v| v.as_str()),
                "components": t.get("components").cloned().unwrap_or_else(|| json!([])),
                "rejectionReason": t.get("rejected_reason").and_then(|v| v.as_str()),
            })
        })
        .collect())
}

async fn fetch_meta_template_by_name(
    waba_id: &str,
    access_token: &str,
    name: &str,
) -> ApiResult<Value> {
    let templates = list_meta_templates(waba_id, access_token).await?;
    templates
        .into_iter()
        .find(|t| t.get("name").and_then(|v| v.as_str()) == Some(name))
        .ok_or_else(|| ApiError::NotFound(format!("Template '{name}' not found on Meta")))
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
