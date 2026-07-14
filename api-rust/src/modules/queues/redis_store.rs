use redis::aio::ConnectionManager;
use redis::AsyncCommands;

use super::store::QueueJob;

const JOBS_HASH: &str = "mako:jobs";

pub struct RedisJobStore {
    conn: ConnectionManager,
}

impl RedisJobStore {
    pub async fn connect(url: &str) -> redis::RedisResult<Self> {
        let client = redis::Client::open(url)?;
        let conn = ConnectionManager::new(client).await?;
        Ok(Self { conn })
    }

    pub async fn push(&self, job: QueueJob) -> redis::RedisResult<()> {
        let payload = serde_json::to_string(&job).map_err(|e| {
            redis::RedisError::from((redis::ErrorKind::TypeError, "serialize", e.to_string()))
        })?;
        let mut conn = self.conn.clone();
        conn.hset(JOBS_HASH, &job.id, payload).await
    }

    pub async fn get(&self, job_id: &str) -> Option<QueueJob> {
        let mut conn = self.conn.clone();
        let raw: Option<String> = conn.hget(JOBS_HASH, job_id).await.ok()?;
        raw.and_then(|s| serde_json::from_str(&s).ok())
    }

    pub async fn list(&self, queue: &str, state: Option<&str>) -> Vec<QueueJob> {
        let mut conn = self.conn.clone();
        let raw: Vec<String> = conn.hvals(JOBS_HASH).await.unwrap_or_default();
        raw.into_iter()
            .filter_map(|s| serde_json::from_str::<QueueJob>(&s).ok())
            .filter(|j| j.queue == queue)
            .filter(|j| state.map(|s| j.state == s).unwrap_or(true))
            .collect()
    }

    pub async fn update(&self, job_id: &str, f: impl FnOnce(&mut QueueJob)) {
        if let Some(mut job) = self.get(job_id).await {
            f(&mut job);
            let _ = self.push(job).await;
        }
    }

    pub async fn stats(&self, queue: &str) -> (u64, u64, u64, u64) {
        let jobs = self.list(queue, None).await;
        let mut waiting = 0u64;
        let mut active = 0u64;
        let mut completed = 0u64;
        let mut failed = 0u64;
        for j in jobs {
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

    pub async fn retry_failed(&self, queue: &str, limit: u64) -> u64 {
        let mut retried = 0u64;
        let failed = self.list(queue, Some("failed")).await;
        for mut job in failed {
            if retried >= limit {
                break;
            }
            job.state = "waiting".into();
            job.error = None;
            job.finished_at = None;
            if self.push(job).await.is_ok() {
                retried += 1;
            }
        }
        retried
    }
}
