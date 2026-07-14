use crate::config::AppConfig;
use crate::common::middleware::throttle::ThrottleState;
use crate::modules::queues::store::JobStore;
use sea_orm::{Database, DatabaseConnection, DbErr};
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
    pub config: Arc<AppConfig>,
    pub job_store: JobStore,
    pub throttle: ThrottleState,
}

impl AppState {
    pub async fn new(config: Arc<AppConfig>) -> Result<Self, DbErr> {
        let db = Database::connect(&config.database_url)
            .await
            .map_err(|err| {
                tracing::error!(
                    database_url = %mask_database_url(&config.database_url),
                    error = %err,
                    "Database connection failed — is PostgreSQL running?"
                );
                err
            })?;
        Ok(Self {
            db,
            job_store: JobStore::new(&config).await,
            throttle: ThrottleState::new(config.throttle_limit, config.throttle_ttl_secs),
            config,
        })
    }
}

fn mask_database_url(url: &str) -> String {
    url.split('@')
        .next_back()
        .map(|host| format!("postgres://***@{host}"))
        .unwrap_or_else(|| "postgres://***".into())
}
