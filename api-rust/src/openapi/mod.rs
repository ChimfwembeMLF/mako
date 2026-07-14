use axum::{response::Html, routing::get, Json, Router};
use serde::Deserialize;
use serde_json::{json, Map, Value};

#[derive(Debug, Deserialize)]
struct RouteDef {
    method: String,
    path: String,
    tag: String,
}

pub fn router() -> Router {
    Router::new()
        .route("/documentation", get(swagger_ui))
        .route("/documentation/", get(swagger_ui))
        .route("/api-docs/openapi.json", get(openapi_json))
}

async fn swagger_ui() -> Html<&'static str> {
    Html(include_str!("swagger.html"))
}

async fn openapi_json() -> Json<Value> {
    Json(build_openapi_json())
}

pub fn spec_json_pretty() -> String {
    serde_json::to_string_pretty(&build_openapi_json()).unwrap_or_else(|_| "{}".into())
}

fn build_openapi_json() -> Value {
    let routes: Vec<RouteDef> =
        serde_json::from_str(include_str!("routes.json")).expect("valid routes.json");

    let version = std::env::var("APP_VERSION").unwrap_or_else(|_| "0.1.0".into());
    let mut paths: Map<String, Value> = Map::new();
    let mut tag_set = std::collections::BTreeSet::new();

    for route in routes {
        tag_set.insert(route.tag.clone());
        let entry = paths.entry(route.path.clone()).or_insert_with(|| json!({}));
        let method = route.method.to_lowercase();
        let mut op = json!({
            "tags": [route.tag],
            "summary": format!("{} {}", route.method, route.path),
            "operationId": operation_id(&route.method, &route.path),
            "responses": {
                "200": { "description": "Success" },
                "400": { "description": "Bad request" },
                "401": { "description": "Unauthorized" },
                "403": { "description": "Forbidden" },
                "404": { "description": "Not found" },
                "500": { "description": "Internal server error" }
            }
        });
        if route.path.starts_with("/api/v1/") && !is_public_route(&route.path) {
            op["security"] = json!([{"bearerAuth": []}]);
        }
        if let Some(obj) = entry.as_object_mut() {
            obj.insert(method, op);
        }
    }

    let tags: Vec<Value> = tag_set
        .into_iter()
        .map(|name| json!({ "name": name }))
        .collect();

    json!({
        "openapi": "3.0.3",
        "info": {
            "title": "Mako API (Rust)",
            "version": version,
            "description": API_DESCRIPTION
        },
        "tags": tags,
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "JWT access token from POST /api/v1/auth/login"
                },
                "widget-api-key": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "API Key",
                    "description": "Widget API key for /api/v1/widget/* routes"
                }
            }
        },
        "paths": paths
    })
}

fn operation_id(method: &str, path: &str) -> String {
    format!(
        "{}_{}",
        method.to_lowercase(),
        path.trim_start_matches('/')
            .replace(['/', '{', '}', '-'], "_")
            .trim_matches('_')
    )
}

fn is_public_route(path: &str) -> bool {
    const PUBLIC_PREFIXES: &[&str] = &[
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/api/v1/auth/google",
        "/api/v1/auth/facebook",
        "/api/v1/auth/linkedin",
        "/api/v1/auth/instagram",
        "/api/v1/auth/refresh",
        "/api/v1/health",
        "/api/v1/legal",
        "/privacy",
        "/terms",
        "/embed-ads/",
    ];
    PUBLIC_PREFIXES
        .iter()
        .any(|p| path.starts_with(p) || path == *p)
}

const API_DESCRIPTION: &str = "### REST\n\nRoutes follow REST conventions (Richardson level 3).\n\n**Auth:** Most `/api/v1/*` routes require `Authorization: Bearer <access_token>`.\n\n**Widget:** `/api/v1/widget/*` routes accept a widget API key as Bearer token.\n\nThis is the Rust port of the Mako API — parity with NestJS at `/documentation`.";
