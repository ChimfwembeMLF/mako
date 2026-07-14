use std::{
    collections::HashMap,
    net::IpAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;

use crate::app_state::AppState;

#[derive(Clone)]
pub struct ThrottleState {
    limit: u32,
    window: Duration,
    buckets: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
}

impl ThrottleState {
    pub fn new(limit: u32, window_secs: u64) -> Self {
        Self {
            limit,
            window: Duration::from_secs(window_secs),
            buckets: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn check(&self, key: &str) -> bool {
        let now = Instant::now();
        let mut buckets = self.buckets.lock().expect("throttle lock");
        let entries = buckets.entry(key.to_string()).or_default();
        entries.retain(|t| now.duration_since(*t) < self.window);
        if entries.len() >= self.limit as usize {
            return false;
        }
        entries.push(now);
        true
    }
}

pub async fn throttle_middleware(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Response {
    if !state.config.throttle_enabled {
        return next.run(req).await;
    }

    let key = throttle_key(&req);
    if !state.throttle.check(&key) {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            axum::Json(json!({
                "success": false,
                "statusCode": 429,
                "error": "ThrottlerException: Too Many Requests",
            })),
        )
            .into_response();
    }

    next.run(req).await
}

fn throttle_key(req: &Request<Body>) -> String {
    client_ip(req).unwrap_or_else(|| "unknown".into())
}

fn client_ip(req: &Request<Body>) -> Option<String> {
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

    if let Some(real_ip) = req
        .headers()
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .filter(|v| !v.is_empty())
    {
        return Some(real_ip.to_string());
    }

    req.extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|info| info.0.ip().to_string())
        .or_else(|| {
            req.uri().host().and_then(|host| {
                if host.parse::<IpAddr>().is_ok() {
                    Some(host.to_string())
                } else {
                    None
                }
            })
        })
}
