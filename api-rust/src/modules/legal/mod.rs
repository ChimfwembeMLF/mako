use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{Html, IntoResponse, Response},
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
use crate::common::{ApiError, ApiResult};
use crate::modules::queues::dispatch::QueueDispatch;

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/privacy", get(privacy))
        .route("/privacy.html", get(privacy))
        .route("/terms", get(terms))
        .route("/terms.html", get(terms))
        .route("/data-deletion", get(data_deletion_info))
        .route("/data-deletion.html", get(data_deletion_info))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/urls", get(legal_urls))
        .route("/deletion-status", get(deletion_status))
        .route("/data-deletion-request", post(data_deletion_request))
        .route(
            "/data-protection/consent",
            get(consent_status).post(record_consent),
        )
}

pub fn webhooks_router() -> Router<AppState> {
    Router::new()
        .route("/data-deletion", post(meta_data_deletion))
        .route("/deauthorize", post(meta_deauthorize))
        .route("/", get(meta_verify).post(meta_events))
}

#[derive(Deserialize, Validate)]
struct DataDeletionRequestDto {
    email: String,
}

#[derive(Deserialize, Validate)]
struct DataProtectionConsentDto {
    #[serde(rename = "visitorId")]
    visitor_id: String,
    #[serde(rename = "consentVersion")]
    consent_version: Option<String>,
}

#[derive(Deserialize)]
struct DeletionStatusQuery {
    code: String,
}

#[derive(Deserialize)]
struct ConsentStatusQuery {
    #[serde(rename = "visitorId")]
    visitor_id: Option<String>,
    version: Option<String>,
}

#[derive(Deserialize)]
struct MetaVerifyQuery {
    #[serde(rename = "hub.mode")]
    hub_mode: Option<String>,
    #[serde(rename = "hub.verify_token")]
    hub_verify_token: Option<String>,
    #[serde(rename = "hub.challenge")]
    hub_challenge: Option<String>,
}

#[derive(Deserialize)]
struct SignedRequestBody {
    signed_request: Option<String>,
}

async fn privacy() -> Html<&'static str> {
    Html(
        "<html><body><h1>Privacy Policy</h1><p>We collect only data needed to run your workspace, secure accounts, and provide support. Data is never sold and may be deleted on request.</p></body></html>",
    )
}

async fn terms() -> Html<&'static str> {
    Html(
        "<html><body><h1>Terms of Service</h1><p>Use this platform lawfully, protect credentials, and respect third-party platform policies while publishing content.</p></body></html>",
    )
}

async fn data_deletion_info() -> Html<&'static str> {
    Html(
        "<html><body><h1>Data Deletion</h1><p>Submit your email to request deletion. We process requests promptly and provide a confirmation code for status tracking.</p></body></html>",
    )
}

async fn legal_urls(State(state): State<AppState>) -> Json<Value> {
    let app_name = state.config.mail.app_name.clone();
    let support_email =
        std::env::var("SUPPORT_EMAIL").unwrap_or_else(|_| "support@agriwide.co".into());

    Json(json!({
        "appName": app_name,
        "supportEmail": support_email,
        "privacyPolicyUrl": "/privacy",
        "termsOfServiceUrl": "/terms",
        "dataDeletionUrl": "/data-deletion",
    }))
}

async fn deletion_status(
    State(state): State<AppState>,
    Query(query): Query<DeletionStatusQuery>,
) -> Json<Value> {
    let row = legal_entity::deletion_request::Entity::find()
        .filter(legal_entity::deletion_request::Column::ConfirmationCode.eq(query.code.clone()))
        .one(&state.db)
        .await
        .ok()
        .flatten();
    if let Some(req) = row {
        return Json(json!({
            "id": req.id,
            "code": req.confirmation_code,
            "status": req.status,
            "platform": req.platform,
            "email": req.email,
            "createdAt": req.created_at,
            "completedAt": req.completed_at,
        }));
    }
    Json(json!({
        "code": query.code,
        "status": "not_found"
    }))
}

async fn data_deletion_request(
    State(state): State<AppState>,
    Json(dto): Json<DataDeletionRequestDto>,
) -> ApiResult<Json<Value>> {
    dto.validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let code = format!("DEL-{}", Uuid::new_v4().as_simple());
    let now = Utc::now().fixed_offset();
    let row = legal_entity::deletion_request::ActiveModel {
        id: Set(Uuid::new_v4()),
        confirmation_code: Set(code.clone()),
        platform: Set("email".into()),
        email: Set(Some(dto.email.trim().to_lowercase())),
        external_user_id: Set(None),
        user_id: Set(None),
        status: Set("pending".into()),
        ip_address: Set(None),
        user_agent: Set(None),
        completed_at: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    }
    .insert(&state.db)
    .await?;

    Ok(Json(json!({
        "id": row.id,
        "email": row.email,
        "code": row.confirmation_code,
        "status": row.status,
        "createdAt": row.created_at,
    })))
}

async fn record_consent(
    State(state): State<AppState>,
    Json(dto): Json<DataProtectionConsentDto>,
) -> ApiResult<Json<Value>> {
    dto.validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let version = dto.consent_version.unwrap_or_else(|| "1".into());
    let existing = legal_entity::protection_consent::Entity::find()
        .filter(legal_entity::protection_consent::Column::VisitorId.eq(dto.visitor_id.clone()))
        .filter(legal_entity::protection_consent::Column::ConsentVersion.eq(version.clone()))
        .filter(legal_entity::protection_consent::Column::Accepted.eq(true))
        .one(&state.db)
        .await?;

    if let Some(row) = existing {
        return Ok(Json(json!({
            "id": row.id,
            "visitorId": row.visitor_id,
            "consentVersion": row.consent_version,
            "accepted": row.accepted,
            "recordedAt": row.created_at,
        })));
    }

    let row = legal_entity::protection_consent::ActiveModel {
        id: Set(Uuid::new_v4()),
        visitor_id: Set(dto.visitor_id),
        user_id: Set(None),
        consent_version: Set(version),
        accepted: Set(true),
        ip_address: Set(None),
        user_agent: Set(None),
        created_at: Set(Utc::now().fixed_offset()),
    }
    .insert(&state.db)
    .await?;

    Ok(Json(json!({
        "id": row.id,
        "visitorId": row.visitor_id,
        "consentVersion": row.consent_version,
        "accepted": row.accepted,
        "recordedAt": row.created_at,
    })))
}

async fn consent_status(
    State(state): State<AppState>,
    Query(query): Query<ConsentStatusQuery>,
) -> Json<Value> {
    if query
        .visitor_id
        .as_ref()
        .map(|v| v.trim().is_empty())
        .unwrap_or(true)
    {
        return Json(json!({ "accepted": false }));
    }

    let visitor_id = query.visitor_id.unwrap_or_default();
    let version = query.version.unwrap_or_else(|| "1".into());
    let row = legal_entity::protection_consent::Entity::find()
        .filter(legal_entity::protection_consent::Column::VisitorId.eq(visitor_id.clone()))
        .filter(legal_entity::protection_consent::Column::ConsentVersion.eq(version.clone()))
        .filter(legal_entity::protection_consent::Column::Accepted.eq(true))
        .one(&state.db)
        .await
        .ok()
        .flatten();
    if let Some(consent) = row {
        return Json(json!({
            "accepted": true,
            "visitorId": consent.visitor_id,
            "version": consent.consent_version,
            "createdAt": consent.created_at,
        }));
    }

    Json(json!({
        "accepted": false,
        "visitorId": visitor_id,
        "version": version,
    }))
}

async fn meta_data_deletion(
    State(state): State<AppState>,
    Json(body): Json<SignedRequestBody>,
) -> impl IntoResponse {
    if body.signed_request.is_none() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "signed_request required" })),
        );
    }
    let code = format!("META-{}", Uuid::new_v4().as_simple());
    let _ = legal_entity::deletion_request::ActiveModel {
        id: Set(Uuid::new_v4()),
        confirmation_code: Set(code.clone()),
        platform: Set("meta".into()),
        email: Set(None),
        external_user_id: Set(Some("signed_request".into())),
        user_id: Set(None),
        status: Set("pending".into()),
        ip_address: Set(None),
        user_agent: Set(None),
        completed_at: Set(None),
        created_at: Set(Utc::now().fixed_offset()),
        updated_at: Set(Utc::now().fixed_offset()),
    }
    .insert(&state.db)
    .await;

    (
        StatusCode::OK,
        Json(json!({
            "url": "/data-deletion",
            "confirmation_code": code,
        })),
    )
}

async fn meta_verify(Query(query): Query<MetaVerifyQuery>) -> Response {
    let expected = std::env::var("META_WEBHOOK_VERIFY_TOKEN").unwrap_or_default();
    if query.hub_mode.as_deref() == Some("subscribe")
        && query.hub_verify_token.as_deref() == Some(expected.as_str())
        && !expected.is_empty()
    {
        return (StatusCode::OK, query.hub_challenge.unwrap_or_default()).into_response();
    }
    (StatusCode::FORBIDDEN, "Forbidden").into_response()
}

async fn meta_events(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Json<Value> {
    if QueueDispatch::is_enabled(&state.config) {
        let job_id = QueueDispatch::enqueue_meta_webhook(&state, body).await;
        return Json(json!({ "received": true, "queued": true, "jobId": job_id }));
    }

    if let Err(err) = route_meta_webhook(&state, &body).await {
        tracing::error!(error = %err, "Meta webhook processing failed");
    }
    Json(json!({ "received": true }))
}

pub async fn route_meta_webhook(state: &AppState, body: &Value) -> ApiResult<()> {
    let object = body.get("object").and_then(|v| v.as_str()).unwrap_or("");
    if object == "page" || object == "instagram" {
        crate::modules::social_inbox::inbound::handle_meta_webhook(state, body).await
    } else {
        crate::modules::whatsapp::inbound::handle_meta_webhook(state, body).await
    }
}

async fn meta_deauthorize(Json(body): Json<SignedRequestBody>) -> Json<Value> {
    if body.signed_request.is_some() {
        return Json(json!({
            "url": "/data-deletion",
            "confirmation_code": format!("META-{}", Uuid::new_v4().as_simple()),
        }));
    }
    Json(json!({ "received": true }))
}

mod legal_entity {
    pub mod deletion_request {
        use sea_orm::entity::prelude::*;

        #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
        #[sea_orm(table_name = "data_deletion_requests")]
        pub struct Model {
            #[sea_orm(primary_key, auto_increment = false)]
            pub id: Uuid,
            #[sea_orm(column_type = "Text", unique)]
            pub confirmation_code: String,
            #[sea_orm(column_type = "Text")]
            pub platform: String,
            #[sea_orm(column_type = "Text", nullable)]
            pub external_user_id: Option<String>,
            #[sea_orm(column_type = "Text", nullable)]
            pub email: Option<String>,
            pub user_id: Option<Uuid>,
            #[sea_orm(column_type = "Text")]
            pub status: String,
            #[sea_orm(column_type = "Text", nullable)]
            pub ip_address: Option<String>,
            #[sea_orm(column_type = "Text", nullable)]
            pub user_agent: Option<String>,
            pub completed_at: Option<DateTimeWithTimeZone>,
            pub created_at: DateTimeWithTimeZone,
            pub updated_at: DateTimeWithTimeZone,
        }

        #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
        pub enum Relation {}

        impl ActiveModelBehavior for ActiveModel {}
    }

    pub mod protection_consent {
        use sea_orm::entity::prelude::*;

        #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
        #[sea_orm(table_name = "data_protection_consents")]
        pub struct Model {
            #[sea_orm(primary_key, auto_increment = false)]
            pub id: Uuid,
            #[sea_orm(column_type = "Text")]
            pub visitor_id: String,
            pub user_id: Option<Uuid>,
            #[sea_orm(column_type = "Text")]
            pub consent_version: String,
            pub accepted: bool,
            #[sea_orm(column_type = "Text", nullable)]
            pub ip_address: Option<String>,
            #[sea_orm(column_type = "Text", nullable)]
            pub user_agent: Option<String>,
            pub created_at: DateTimeWithTimeZone,
        }

        #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
        pub enum Relation {}

        impl ActiveModelBehavior for ActiveModel {}
    }
}
