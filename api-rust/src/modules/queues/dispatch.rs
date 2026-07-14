use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;

use super::store::QueueJob;
use super::worker::QueueWorker;

pub const QUEUE_CONTENT_PUBLISH: &str = "content-publish";
pub const QUEUE_EMAIL: &str = "email";
pub const QUEUE_WEBHOOKS: &str = "webhooks";
pub const QUEUE_AI: &str = "ai";
pub const QUEUE_COMMENTS: &str = "comments";

pub const JOB_PUBLISH_CONTENT: &str = "publish-content";
pub const JOB_SEND_EMAIL: &str = "send-email";
pub const JOB_WHATSAPP_INBOUND: &str = "whatsapp-inbound";
pub const JOB_AI_TASK: &str = "ai-task";
pub const JOB_SYNC_TENANT_COMMENTS: &str = "sync-tenant-comments";
#[allow(dead_code)]
pub const JOB_AUTO_PUBLISH_TENANT: &str = "auto-publish-tenant";

pub struct QueueDispatch;

impl QueueDispatch {
    pub fn is_enabled(config: &crate::config::AppConfig) -> bool {
        config.queues_enabled
    }

    pub async fn enqueue_publish(
        state: &AppState,
        tenant_id: Uuid,
        content_id: Uuid,
        user_id: Uuid,
        platforms: Option<Vec<String>>,
    ) -> (String, String) {
        let job = QueueJob::new(
            QUEUE_CONTENT_PUBLISH,
            JOB_PUBLISH_CONTENT,
            json!({
                "tenantId": tenant_id,
                "contentId": content_id,
                "userId": user_id,
                "platforms": platforms,
            }),
        );
        let job_id = job.id.clone();
        state.job_store.push(job).await;
        let worker_state = state.clone();
        let spawn_id = job_id.clone();
        tokio::spawn(async move {
            QueueWorker::process_job(&worker_state, &spawn_id).await;
        });
        (job_id, QUEUE_CONTENT_PUBLISH.to_string())
    }

    #[allow(dead_code)]
    pub async fn enqueue_email(
        state: &AppState,
        to: &str,
        subject: &str,
        body: &str,
        user_id: Option<Uuid>,
    ) -> String {
        let job = QueueJob::new(
            QUEUE_EMAIL,
            JOB_SEND_EMAIL,
            json!({
                "to": to,
                "subject": subject,
                "body": body,
                "userId": user_id,
            }),
        );
        let job_id = job.id.clone();
        state.job_store.push(job).await;
        let worker_state = state.clone();
        let spawn_id = job_id.clone();
        tokio::spawn(async move {
            QueueWorker::process_job(&worker_state, &spawn_id).await;
        });
        job_id
    }

    pub async fn enqueue_meta_webhook(state: &AppState, body: Value) -> String {
        let job = QueueJob::new(
            QUEUE_WEBHOOKS,
            JOB_WHATSAPP_INBOUND,
            json!({ "body": body }),
        );
        let job_id = job.id.clone();
        state.job_store.push(job).await;
        let worker_state = state.clone();
        let spawn_id = job_id.clone();
        tokio::spawn(async move {
            QueueWorker::process_job(&worker_state, &spawn_id).await;
        });
        job_id
    }

    pub async fn enqueue_ai_task(
        state: &AppState,
        task_type: &str,
        user_id: Uuid,
        payload: Value,
    ) -> (String, String) {
        let job = QueueJob::new(
            QUEUE_AI,
            JOB_AI_TASK,
            json!({
                "type": task_type,
                "userId": user_id,
                "payload": payload,
            }),
        );
        let job_id = job.id.clone();
        state.job_store.push(job).await;
        let worker_state = state.clone();
        let spawn_id = job_id.clone();
        tokio::spawn(async move {
            QueueWorker::process_job(&worker_state, &spawn_id).await;
        });
        (job_id, QUEUE_AI.to_string())
    }

    pub async fn enqueue_sync_tenant_comments(
        state: &AppState,
        user_id: Uuid,
        payload: Value,
    ) -> String {
        let job = QueueJob::new(QUEUE_COMMENTS, JOB_SYNC_TENANT_COMMENTS, {
            let mut data = payload.as_object().cloned().unwrap_or_default();
            data.insert("userId".into(), json!(user_id));
            Value::Object(data)
        });
        let job_id = job.id.clone();
        state.job_store.push(job).await;
        let worker_state = state.clone();
        let spawn_id = job_id.clone();
        tokio::spawn(async move {
            QueueWorker::process_job(&worker_state, &spawn_id).await;
        });
        job_id
    }

    pub async fn fan_out_comment_sync(
        state: &AppState,
        tenants: &[(Uuid, Uuid)],
    ) -> usize {
        let mut enqueued = 0usize;
        for (tenant_id, user_id) in tenants {
            let payload = serde_json::json!({
                "tenantId": tenant_id,
                "runAutoReply": true,
            });
            QueueDispatch::enqueue_sync_tenant_comments(state, *user_id, payload).await;
            enqueued += 1;
        }
        enqueued
    }

    pub async fn fan_out_daily_workflow(state: &AppState, tenant_ids: &[Uuid]) -> usize {
        let mut enqueued = 0usize;
        for tenant_id in tenant_ids {
            let payload = serde_json::json!({ "tenantId": tenant_id });
            QueueDispatch::enqueue_ai_task(
                state,
                "daily-workflow",
                Uuid::nil(),
                payload,
            )
            .await;
            enqueued += 1;
        }
        enqueued
    }
}
