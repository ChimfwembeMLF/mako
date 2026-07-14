use axum::{routing::get, Json, Router};
use serde_json::{json, Value};

use crate::app_state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(check))
}

async fn check() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "service": "Mako API (Rust)",
        "version": "0.1.0",
        "environment": std::env::var("NODE_ENV").unwrap_or_else(|_| "development".to_string()),
        "port": std::env::var("PORT").unwrap_or_else(|_| "4000".to_string()),
        "apiMode": "rust-port",
    }))
}
