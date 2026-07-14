pub mod dispatch;
pub mod redis_store;
pub mod store;
pub mod worker;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::app_state::AppState;
use crate::common::guards::{AuthUser, SuperAdminUser};
use crate::common::{ApiError, ApiResult};

use self::dispatch::{
    QueueDispatch, QUEUE_AI, QUEUE_COMMENTS, QUEUE_CONTENT_PUBLISH, QUEUE_EMAIL, QUEUE_WEBHOOKS,
};
use self::worker::QueueWorker;

const ALL_QUEUES: &[&str] = &[
    QUEUE_CONTENT_PUBLISH,
    QUEUE_COMMENTS,
    QUEUE_WEBHOOKS,
    QUEUE_AI,
    QUEUE_EMAIL,
];

const JOB_STATES: &[&str] = &[
    "all",
    "failed",
    "completed",
    "active",
    "waiting",
    "delayed",
    "paused",
];

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/queues", get(list_queues))
        .route("/{queue}/stats", get(get_queue_stats))
        .route("/{queue}/jobs", get(list_jobs))
        .route("/{queue}/jobs/{job_id}", get(get_job))
        .route("/{queue}/jobs/{job_id}/retry", post(retry_job))
        .route("/{queue}/retry-failed", post(retry_all_failed))
}

#[derive(Deserialize)]
struct JobsQuery {
    state: Option<String>,
    start: Option<u64>,
    end: Option<u64>,
}

#[derive(Deserialize)]
struct RetryFailedQuery {
    limit: Option<u64>,
}

async fn list_queues(State(state): State<AppState>, AuthUser { .. }: AuthUser) -> Json<Value> {
    Json(json!({
        "queues": ALL_QUEUES,
        "enabled": QueueDispatch::is_enabled(&state.config),
    }))
}

async fn get_queue_stats(
    State(state): State<AppState>,
    SuperAdminUser { .. }: SuperAdminUser,
    Path(queue): Path<String>,
) -> ApiResult<Json<Value>> {
    ensure_queue(&queue)?;
    let (waiting, active, completed, failed) = state.job_store.stats(&queue).await;
    Ok(Json(json!({
        "queue": queue,
        "waiting": waiting,
        "active": active,
        "completed": completed,
        "failed": failed,
        "delayed": 0,
        "paused": 0,
    })))
}

async fn list_jobs(
    State(state): State<AppState>,
    SuperAdminUser { .. }: SuperAdminUser,
    Path(queue): Path<String>,
    Query(query): Query<JobsQuery>,
) -> ApiResult<Json<Value>> {
    ensure_queue(&queue)?;
    let state_filter = query.state.as_deref().unwrap_or("all");
    if !JOB_STATES.contains(&state_filter) {
        return Err(ApiError::BadRequest(format!(
            "Invalid state: {state_filter}"
        )));
    }

    let start = query.start.unwrap_or(0) as usize;
    let end = query.end.unwrap_or(49) as usize;
    let filter_state = if state_filter == "all" {
        None
    } else {
        Some(state_filter)
    };

    let mut jobs = state.job_store.list(&queue, filter_state).await;
    if start < jobs.len() {
        let end = end.min(jobs.len() - 1);
        jobs = jobs[start..=end].to_vec();
    } else {
        jobs.clear();
    }

    Ok(Json(json!({
        "queue": queue,
        "state": state_filter,
        "start": query.start.unwrap_or(0),
        "end": query.end.unwrap_or(49),
        "jobs": jobs,
    })))
}

async fn get_job(
    State(state): State<AppState>,
    AuthUser { .. }: AuthUser,
    Path((queue, job_id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    ensure_queue(&queue)?;
    let job = state
        .job_store
        .get(&job_id)
        .await
        .ok_or_else(|| ApiError::NotFound(format!("Job {job_id} not found")))?;

    Ok(Json(json!({
        "queue": queue,
        "jobId": job.id,
        "name": job.name,
        "state": job.state,
        "data": job.data,
        "attempts": job.attempts,
        "maxAttempts": job.max_attempts,
        "error": job.error,
        "createdAt": job.created_at,
        "finishedAt": job.finished_at,
    })))
}

async fn retry_job(
    State(state): State<AppState>,
    SuperAdminUser { .. }: SuperAdminUser,
    Path((queue, job_id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    ensure_queue(&queue)?;
    let exists = state.job_store.get(&job_id).await.is_some();
    if !exists {
        return Err(ApiError::NotFound(format!("Job {job_id} not found")));
    }

    state
        .job_store
        .update(&job_id, |j| {
            j.state = "waiting".into();
            j.error = None;
            j.finished_at = None;
        })
        .await;

    let worker_state = state.clone();
    let retry_id = job_id.clone();
    tokio::spawn(async move {
        QueueWorker::process_job(&worker_state, &retry_id).await;
    });

    Ok(Json(json!({
        "queue": queue,
        "jobId": job_id,
        "retried": true,
    })))
}

async fn retry_all_failed(
    State(state): State<AppState>,
    SuperAdminUser { .. }: SuperAdminUser,
    Path(queue): Path<String>,
    Query(query): Query<RetryFailedQuery>,
) -> ApiResult<Json<Value>> {
    ensure_queue(&queue)?;
    let limit = query.limit.unwrap_or(100);
    let retried = state.job_store.retry_failed(&queue, limit).await;

    let worker_state = state.clone();
    let queue_name = queue.clone();
    tokio::spawn(async move {
        let jobs = worker_state
            .job_store
            .list(&queue_name, Some("waiting"))
            .await;
        for job in jobs {
            QueueWorker::process_job(&worker_state, &job.id).await;
        }
    });

    Ok(Json(json!({
        "queue": queue,
        "retried": retried,
        "limit": limit,
    })))
}

fn ensure_queue(queue: &str) -> ApiResult<()> {
    if ALL_QUEUES.contains(&queue) {
        Ok(())
    } else {
        Err(ApiError::BadRequest(format!("Unknown queue: {queue}")))
    }
}

pub fn spawn_worker_loop(state: AppState) {
    if !QueueDispatch::is_enabled(&state.config) {
        return;
    }
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(2));
        loop {
            interval.tick().await;
            for queue in ALL_QUEUES {
                let jobs = state.job_store.list(queue, Some("waiting")).await;
                for job in jobs {
                    let worker_state = state.clone();
                    let id = job.id.clone();
                    tokio::spawn(async move {
                        QueueWorker::process_job(&worker_state, &id).await;
                    });
                }
            }
        }
    });
}
