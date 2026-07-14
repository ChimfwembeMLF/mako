use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::config::AppConfig;

use super::redis_store::RedisJobStore;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueJob {
    pub id: String,
    pub queue: String,
    pub name: String,
    pub state: String,
    pub data: Value,
    pub attempts: u32,
    pub max_attempts: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<DateTime<Utc>>,
}

impl QueueJob {
    pub fn new(queue: &str, name: &str, data: Value) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            queue: queue.to_string(),
            name: name.to_string(),
            state: "waiting".into(),
            data,
            attempts: 0,
            max_attempts: 5,
            error: None,
            created_at: Utc::now(),
            finished_at: None,
        }
    }
}

#[derive(Clone)]
enum JobStoreBackend {
    Memory(Arc<RwLock<Vec<QueueJob>>>),
    Redis(Arc<RedisJobStore>),
}

#[derive(Clone)]
pub struct JobStore {
    backend: JobStoreBackend,
}

impl JobStore {
    pub async fn new(config: &AppConfig) -> Self {
        if config.queues_enabled {
            if let Some(url) = config.redis_url.as_ref().filter(|u| !u.trim().is_empty()) {
                match RedisJobStore::connect(url).await {
                    Ok(store) => {
                        tracing::info!("Queue JobStore using Redis");
                        return Self {
                            backend: JobStoreBackend::Redis(Arc::new(store)),
                        };
                    }
                    Err(err) => {
                        tracing::warn!(
                            error = %err,
                            "Redis connection failed — falling back to in-memory JobStore"
                        );
                    }
                }
            }
        }

        Self {
            backend: JobStoreBackend::Memory(Arc::new(RwLock::new(Vec::new()))),
        }
    }

    pub async fn push(&self, job: QueueJob) {
        match &self.backend {
            JobStoreBackend::Memory(inner) => inner.write().await.push(job),
            JobStoreBackend::Redis(store) => {
                if let Err(err) = store.push(job).await {
                    tracing::error!(error = %err, "Failed to push job to Redis");
                }
            }
        }
    }

    pub async fn list(&self, queue: &str, state: Option<&str>) -> Vec<QueueJob> {
        match &self.backend {
            JobStoreBackend::Memory(inner) => {
                let jobs = inner.read().await;
                jobs.iter()
                    .filter(|j| j.queue == queue)
                    .filter(|j| state.map(|s| j.state == s).unwrap_or(true))
                    .cloned()
                    .collect()
            }
            JobStoreBackend::Redis(store) => store.list(queue, state).await,
        }
    }

    pub async fn get(&self, job_id: &str) -> Option<QueueJob> {
        match &self.backend {
            JobStoreBackend::Memory(inner) => {
                let jobs = inner.read().await;
                jobs.iter().find(|j| j.id == job_id).cloned()
            }
            JobStoreBackend::Redis(store) => store.get(job_id).await,
        }
    }

    pub async fn update(&self, job_id: &str, f: impl FnOnce(&mut QueueJob)) {
        match &self.backend {
            JobStoreBackend::Memory(inner) => {
                let mut jobs = inner.write().await;
                if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
                    f(job);
                }
            }
            JobStoreBackend::Redis(store) => store.update(job_id, f).await,
        }
    }

    pub async fn stats(&self, queue: &str) -> (u64, u64, u64, u64) {
        match &self.backend {
            JobStoreBackend::Memory(inner) => {
                let jobs = inner.read().await;
                let mut waiting = 0u64;
                let mut active = 0u64;
                let mut completed = 0u64;
                let mut failed = 0u64;
                for j in jobs.iter().filter(|j| j.queue == queue) {
                    match j.state.as_str() {
                        "waiting" | "delayed" => waiting += 1,
                        "active" => active += 1,
                        "completed" => completed += 1,
                        "failed" => failed += 1,
                        _ => {}
                    }
                }
                (waiting, active, completed, failed)
            }
            JobStoreBackend::Redis(store) => store.stats(queue).await,
        }
    }

    pub async fn retry_failed(&self, queue: &str, limit: u64) -> u64 {
        match &self.backend {
            JobStoreBackend::Memory(inner) => {
                let mut jobs = inner.write().await;
                let mut retried = 0u64;
                for job in jobs
                    .iter_mut()
                    .filter(|j| j.queue == queue && j.state == "failed")
                {
                    if retried >= limit {
                        break;
                    }
                    job.state = "waiting".into();
                    job.error = None;
                    job.finished_at = None;
                    retried += 1;
                }
                retried
            }
            JobStoreBackend::Redis(store) => store.retry_failed(queue, limit).await,
        }
    }
}
