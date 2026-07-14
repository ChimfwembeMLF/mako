use axum::body::Body;
use axum::http::Request;
use chrono::Utc;
use jsonwebtoken::{decode, DecodingKey, Validation};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::audit_logs::entity::{
    ActiveModel as AuditLogActiveModel,
};
use crate::modules::auth::service::Claims;
use crate::modules::tenant_members::entity::{
    Column as MemberColumn, Entity as MemberEntity,
};

pub const NIL_UUID: &str = "00000000-0000-0000-0000-000000000000";

const SKIP_PATH_PREFIXES: &[&str] = &[
    "/uploads",
    "/public",
    "/api-docs",
    "/swagger",
    "/documentation",
    "/favicon.ico",
];

const SKIP_EXACT_PATHS: &[&str] = &["/", "/health", "/api/v1/health"];

pub struct RequestAuditPayload {
    pub tenant_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub action: String,
    pub resource_type: String,
    pub resource_id: Uuid,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub metadata: serde_json::Value,
}

pub fn should_skip_audit(path: &str, method: &str) -> bool {
    if method == "OPTIONS" {
        return true;
    }
    let normalized = path.split('?').next().unwrap_or(path);
    if SKIP_EXACT_PATHS.contains(&normalized) {
        return true;
    }
    SKIP_PATH_PREFIXES
        .iter()
        .any(|prefix| normalized.starts_with(prefix))
}

pub fn build_request_action(method: &str, path: &str) -> String {
    let normalized = path.split('?').next().unwrap_or(path);
    format!("http.{} {normalized}", method.to_uppercase())
}

pub fn resource_type_from_path(path: &str) -> String {
    path.split('?')
        .next()
        .unwrap_or(path)
        .trim_start_matches("/api/v1/")
        .split('/')
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("http")
        .to_string()
}

pub fn resource_id_from_path(path: &str) -> Uuid {
    let nil = Uuid::parse_str(NIL_UUID).unwrap();
    for segment in path.split('?').next().unwrap_or(path).split('/') {
        if let Ok(id) = Uuid::parse_str(segment) {
            return id;
        }
    }
    nil
}

pub fn client_ip(req: &Request<Body>) -> Option<String> {
    if let Some(forwarded) = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
    {
        let ip = forwarded.split(',').next()?.trim();
        if !ip.is_empty() {
            return Some(ip.to_string());
        }
    }
    req.extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|info| info.0.ip().to_string())
}

pub fn extract_user_id_from_token(token: &str, secret: &str) -> Option<Uuid> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .ok()?;
    if data.claims.token_type.as_deref() == Some("refresh") {
        return None;
    }
    Uuid::parse_str(&data.claims.sub).ok()
}

pub fn extract_tenant_id(query: Option<&str>, header: Option<&str>) -> Option<Uuid> {
    if let Some(header) = header {
        if let Ok(id) = Uuid::parse_str(header) {
            return Some(id);
        }
    }
    let query = query?;
    for pair in query.split('&') {
        let (key, value) = pair.split_once('=')?;
        if key == "tenantId" || key == "tenant_id" {
            if let Ok(id) = Uuid::parse_str(value) {
                return Some(id);
            }
        }
    }
    None
}

pub async fn resolve_tenant_for_user(state: &AppState, user_id: Uuid) -> Option<Uuid> {
    MemberEntity::find()
        .filter(MemberColumn::UserId.eq(user_id))
        .filter(MemberColumn::IsActive.eq(true))
        .order_by_asc(MemberColumn::JoinedAt)
        .one(&state.db)
        .await
        .ok()
        .flatten()
        .map(|m| m.tenant_id)
}

pub async fn log_request(state: &AppState, payload: RequestAuditPayload) -> ApiResult<()> {
    let nil_uuid = Uuid::parse_str(NIL_UUID).unwrap();
    AuditLogActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        user_id: Set(payload.user_id),
        action: Set(payload.action),
        resource_type: Set(payload.resource_type),
        resource_id: Set(Some(payload.resource_id)),
        before_state: Set(None),
        after_state: Set(None),
        metadata: Set(Some(payload.metadata.into())),
        ip_address: Set(payload.ip_address),
        user_agent: Set(payload.user_agent),
        created_at: Set(Utc::now().fixed_offset()),
    }
    .insert(&state.db)
    .await?;
    let _ = nil_uuid;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;

    #[test]
    fn skips_health_and_docs() {
        assert!(should_skip_audit("/api/v1/health", "GET"));
        assert!(should_skip_audit("/documentation", "GET"));
        assert!(should_skip_audit("/api-docs/openapi.json", "GET"));
    }

    #[test]
    fn skips_options() {
        assert!(should_skip_audit("/api/v1/tenants", "OPTIONS"));
    }

    #[test]
    fn builds_request_action() {
        assert_eq!(
            build_request_action("GET", "/api/v1/tenants"),
            "http.GET /api/v1/tenants"
        );
    }

    #[test]
    fn resource_type_from_api_path() {
        assert_eq!(resource_type_from_path("/api/v1/tenants"), "tenants");
        assert_eq!(resource_type_from_path("/health"), "http");
    }

    #[test]
    fn extracts_uuid_from_path() {
        let id = Uuid::parse_str("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee").unwrap();
        assert_eq!(
            resource_id_from_path("/api/v1/tenants/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
            id
        );
    }

    #[test]
    fn extract_tenant_from_query() {
        let id = Uuid::parse_str("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee").unwrap();
        assert_eq!(
            extract_tenant_id(
                Some("tenantId=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
                None
            ),
            Some(id)
        );
    }

    #[test]
    fn client_ip_reads_forwarded_header() {
        let req = Request::builder()
            .header("x-forwarded-for", "203.0.113.1, 10.0.0.1")
            .body(Body::empty())
            .unwrap();
        assert_eq!(client_ip(&req).as_deref(), Some("203.0.113.1"));
    }
}
