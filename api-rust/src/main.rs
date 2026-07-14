use std::{net::SocketAddr, path::PathBuf, sync::Arc};

use axum::{middleware, Router};
use tower_http::{
    cors::CorsLayer,
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod app_state;
mod common;
mod config;
mod modules;
mod openapi;
mod services;

use app_state::AppState;
use common::middleware::{audit::audit_middleware, throttle::throttle_middleware};
use config::AppConfig;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "api_rust=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Arc::new(AppConfig::from_env()?);
    log_oauth_config(&config);
    let state = AppState::new(config.clone()).await?;
    modules::jobs::spawn_cron_jobs(state.clone());
    if config.queues_enabled {
        modules::queues::spawn_worker_loop(state.clone());
    }
    if config.auto_reply_backfill_on_start {
        let backfill_state = state.clone();
        tokio::spawn(async move {
            match modules::tenants::tenant_seeds::TenantSeedService::backfill_auto_reply_rules(
                &backfill_state,
            )
            .await
            {
                Ok(created) if created > 0 => {
                    tracing::info!("Auto-reply startup backfill: created {created} rule(s)");
                }
                Ok(_) => {}
                Err(err) => tracing::warn!("Auto-reply startup backfill failed: {err}"),
            }
        });
    }

    let cors = CorsLayer::very_permissive();

    let api = Router::new()
        .route("/", axum::routing::get(|| async { "Hello World!" }))
        .nest("/api/v1/health", modules::health::router())
        .nest("/api/v1/auth", modules::auth::router())
        .nest("/api/v1/tenants", modules::tenants::router())
        .nest("/api/v1/workspaces", modules::workspaces::router())
        .nest("/api/v1/roles", modules::roles::router())
        .nest("/api/v1/permissions", modules::permissions::router())
        .nest(
            "/api/v1/role-permissions",
            modules::role_permissions::router(),
        )
        .nest(
            "/api/v1/user-permissions",
            modules::user_permissions::router(),
        )
        .nest("/api/v1/users", modules::users::router())
        .nest("/api/v1/rbac", modules::rbac::router())
        .nest("/api/v1/tenant-members", modules::tenant_members::router())
        .nest("/api/v1/profiles", modules::profiles::router())
        .nest(
            "/api/v1/system-settings",
            modules::system_settings::router(),
        )
        .nest("/api/v1/leads", modules::leads::router())
        .nest("/api/v1/mail", modules::mail::router())
        .nest("/api/v1/lead-source", modules::lead_sources::router())
        .nest("/api/v1/brand-profiles", modules::brand_profiles::router())
        .nest("/api/v1/templates", modules::templates::router())
        .nest("/api/v1/media", modules::media::router())
        .nest("/api/v1/content-items", modules::content_items::router())
        .nest(
            "/api/v1/content-campaigns",
            modules::content_campaigns::router(),
        )
        .nest(
            "/api/v1/content-publications",
            modules::content_publications::router(),
        )
        .nest("/api/v1/content-ai", modules::content_ai::router())
        .nest("/api/v1/platforms", modules::platforms::router())
        .nest(
            "/api/v1/social-accounts",
            modules::social_accounts::router(),
        )
        .nest(
            "/api/v1/auto-reply-rules",
            modules::auto_reply_rules::router(),
        )
        .nest("/api/v1/audit-logs", modules::audit_logs::router())
        .nest("/api/v1/subscriptions", modules::subscriptions::router())
        .nest("/api/v1/plans", modules::plans::router())
        .nest("/api/v1/payments", modules::payments::router())
        .nest("/api/v1/deposits", modules::deposits::router())
        .nest("/api/v1/notifications", modules::notifications::router())
        .nest("/api/v1/inbox", modules::social_inbox::router())
        .nest(
            "/api/v1/comment-replies",
            modules::comment_replies::router(),
        )
        .nest("/api/v1/analytics", modules::analytics::router())
        .nest("/api/v1/search", modules::search::router())
        .nest("/api/v1/ads", modules::ads::router())
        .nest("/payment-failures", modules::payment_failures::router())
        .nest("/embed-ads", modules::embed_ads::router())
        .nest("/api/v1/chatbot", modules::chatbot::router())
        .nest("/api/v1/knowledge", modules::knowledge::router())
        .nest("/api/v1/widget", modules::widget::router())
        .nest("/api/v1/whatsapp", modules::whatsapp::router())
        .nest(
            "/api/v1/whatsapp/templates",
            modules::whatsapp_templates::router(),
        )
        .nest(
            "/api/v1/whatsapp/contacts",
            modules::whatsapp_contacts::router(),
        )
        .nest(
            "/api/v1/approval-requests",
            modules::approval_requests::router(),
        )
        .nest(
            "/api/v1/approval-workflows",
            modules::approval_workflows::router(),
        )
        .nest("/api/v1/legal", modules::legal::router())
        .nest("/api/v1/webhooks/meta", modules::legal::webhooks_router())
        .merge(modules::legal::public_router())
        .nest("/api/v1/backoffice", modules::backoffice::router())
        .nest("/api/v1/ai", modules::ai::router())
        .nest("/api/v1/ai-usage", modules::ai_usage::router())
        .nest("/api/v1/queues", modules::queues::router())
        .layer(middleware::from_fn_with_state(state.clone(), audit_middleware))
        .layer(middleware::from_fn_with_state(state.clone(), throttle_middleware))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let app = Router::new()
        .merge(openapi::router())
        .merge(api)
        .merge(static_routes(&config));

    if std::fs::write("swagger.json", openapi::spec_json_pretty()).is_ok() {
        tracing::info!("Swagger JSON written to api-rust/swagger.json");
    }

    let addr: SocketAddr = format!("0.0.0.0:{}", config.port).parse()?;
    tracing::info!(
        env = %config.node_env,
        queues = config.queues_enabled,
        throttle = config.throttle_enabled,
        throttle_limit = config.throttle_limit,
        "Mako API (Rust) listening on http://{addr} — docs at http://{addr}/documentation"
    );

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}

fn static_routes(config: &AppConfig) -> Router {
    let mut router = Router::new();

    let uploads = resolve_static_dir(
        config.uploads_dir.as_deref(),
        &["uploads", "../api/uploads", "../autopilot-api/uploads"],
    );
    if let Some(dir) = uploads {
        tracing::info!(path = %dir.display(), "Serving /uploads");
        router = router.nest_service("/uploads", ServeDir::new(dir));
    }

    let public = resolve_static_dir(
        config.public_dir.as_deref(),
        &["public", "../api/public", "../autopilot-api/public"],
    );
    if let Some(dir) = public {
        tracing::info!(path = %dir.display(), "Serving /public");
        let widget_spec = dir.join("chatbot-widget.openapi.yaml");
        if widget_spec.is_file() {
            router = router.nest_service(
                "/public/chatbot-widget.openapi.yaml",
                ServeFile::new(widget_spec),
            );
        }
        router = router.nest_service("/public", ServeDir::new(dir));
    }

    router
}

fn log_oauth_config(config: &AppConfig) {
    let oauth = &config.oauth;
    if oauth.google_client_id.is_empty() || oauth.google_client_secret.is_empty() {
        tracing::warn!("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing — Google login disabled");
    }
    if oauth.google_callback_url.is_empty() {
        tracing::warn!(
            "GOOGLE_CALLBACK_URL missing — set to {}/api/v1/auth/google/redirect",
            oauth.frontend_url
        );
    } else {
        tracing::info!(callback = %oauth.google_callback_url, "Google OAuth callback configured");
    }
    tracing::info!(frontend = %oauth.frontend_url, "OAuth redirect target (FRONTEND_URL)");
}

fn resolve_static_dir(explicit: Option<&str>, candidates: &[&str]) -> Option<PathBuf> {
    if let Some(path) = explicit {
        let path = PathBuf::from(path);
        if path.is_dir() {
            return Some(path);
        }
    }
    for candidate in candidates {
        let path = PathBuf::from(candidate);
        if path.is_dir() {
            return Some(path);
        }
    }
    None
}
