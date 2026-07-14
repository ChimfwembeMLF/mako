use std::time::Instant;

use axum::{
    body::Body,
    extract::State,
    http::Request,
    middleware::Next,
    response::Response,
};
use crate::app_state::AppState;
use crate::modules::audit_logs::service::{
    build_request_action, client_ip, extract_tenant_id, extract_user_id_from_token,
    resource_id_from_path, resource_type_from_path, should_skip_audit,
};

pub async fn audit_middleware(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let method = req.method().as_str().to_string();
    let path = req.uri().path().to_string();
    let query = req.uri().query().map(str::to_string);
    let user_agent = req
        .headers()
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let auth_header = req
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .filter(|v| v.starts_with("Bearer "))
        .map(|v| v.trim_start_matches("Bearer ").to_string());
    let tenant_header = req
        .headers()
        .get("x-tenant-id")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let ip_address = client_ip(&req);

    if should_skip_audit(&path, &method) {
        return next.run(req).await;
    }

    let started = Instant::now();
    let response = next.run(req).await;
    let status_code = response.status().as_u16();
    let duration_ms = started.elapsed().as_millis() as u64;

    let state_clone = state.clone();
    tokio::spawn(async move {
        let user_id = auth_header
            .as_deref()
            .and_then(|token| extract_user_id_from_token(token, &state_clone.config.jwt_secret));
        let tenant_id = extract_tenant_id(query.as_deref(), tenant_header.as_deref());
        let resolved_tenant = match tenant_id {
            Some(id) => Some(id),
            None if user_id.is_some() => {
                crate::modules::audit_logs::service::resolve_tenant_for_user(
                    &state_clone,
                    user_id.unwrap(),
                )
                .await
            }
            _ => None,
        };

        if let Err(err) = crate::modules::audit_logs::service::log_request(
            &state_clone,
            crate::modules::audit_logs::service::RequestAuditPayload {
                tenant_id: resolved_tenant,
                user_id,
                action: build_request_action(&method, &path),
                resource_type: resource_type_from_path(&path),
                resource_id: resource_id_from_path(&path),
                ip_address,
                user_agent,
                metadata: serde_json::json!({
                    "method": method,
                    "path": path.split('?').next().unwrap_or(&path),
                    "statusCode": status_code,
                    "durationMs": duration_ms,
                    "query": sanitize_query(query.as_deref()),
                }),
            },
        )
        .await
        {
            tracing::warn!(error = %err, "Failed to write audit log");
        }
    });

    response
}

fn sanitize_query(query: Option<&str>) -> serde_json::Value {
    let Some(query) = query else {
        return serde_json::json!({});
    };
    let mut out = serde_json::Map::new();
    for pair in query.split('&') {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        let key_lower = key.to_lowercase();
        let stored = if key_lower.contains("password") || key_lower.contains("token") {
            "[redacted]".to_string()
        } else {
            value.to_string()
        };
        out.insert(key.to_string(), serde_json::Value::String(stored));
    }
    serde_json::Value::Object(out)
}
