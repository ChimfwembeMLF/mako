use uuid::Uuid;

use crate::app_state::AppState;
use crate::modules::content_ai;
use crate::modules::content_publishing::{PublishContentService, PublishParams};
use crate::modules::leads::lead_email::{LeadEmailService, SendLeadEmailDto};
use crate::modules::queues::dispatch::{
    JOB_AI_TASK, JOB_PUBLISH_CONTENT, JOB_SEND_EMAIL, JOB_SYNC_TENANT_COMMENTS,
    JOB_WHATSAPP_INBOUND, QUEUE_AI, QUEUE_COMMENTS, QUEUE_CONTENT_PUBLISH, QUEUE_EMAIL,
    QUEUE_WEBHOOKS,
};

use super::store::QueueJob;

pub struct QueueWorker;

impl QueueWorker {
    pub async fn process_job(state: &AppState, job_id: &str) {
        let Some(job) = state.job_store.get(job_id).await else {
            return;
        };
        if job.state != "waiting" {
            return;
        }

        state
            .job_store
            .update(job_id, |j| {
                j.state = "active".into();
                j.attempts += 1;
            })
            .await;

        let job = match state.job_store.get(job_id).await {
            Some(j) => j,
            None => return,
        };

        let result = match (job.queue.as_str(), job.name.as_str()) {
            (QUEUE_CONTENT_PUBLISH, JOB_PUBLISH_CONTENT) => {
                Self::handle_publish(state, &job).await
            }
            (QUEUE_EMAIL, JOB_SEND_EMAIL) => Self::handle_email(state, &job).await,
            (QUEUE_WEBHOOKS, JOB_WHATSAPP_INBOUND) => {
                Self::handle_meta_webhook(state, &job).await
            }
            (QUEUE_AI, JOB_AI_TASK) => Self::handle_ai_task(state, &job).await,
            (QUEUE_COMMENTS, JOB_SYNC_TENANT_COMMENTS) => {
                Self::handle_sync_tenant_comments(state, &job).await
            }
            _ => Ok(()),
        };

        state
            .job_store
            .update(job_id, |j| match result {
                Ok(()) => {
                    j.state = "completed".into();
                    j.finished_at = Some(chrono::Utc::now());
                }
                Err(e) => {
                    j.error = Some(e);
                    if j.attempts >= j.max_attempts {
                        j.state = "failed".into();
                    } else {
                        j.state = "waiting".into();
                    }
                    j.finished_at = Some(chrono::Utc::now());
                }
            })
            .await;
    }

    async fn handle_publish(state: &AppState, job: &QueueJob) -> Result<(), String> {
        let data = &job.data;
        let content_id = data
            .get("contentId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "missing contentId".to_string())?;
        let user_id = data
            .get("userId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "missing userId".to_string())?;

        let content_id = Uuid::parse_str(content_id).map_err(|e| e.to_string())?;
        let user_id = Uuid::parse_str(user_id).map_err(|e| e.to_string())?;

        let platforms = data.get("platforms").and_then(|v| {
            v.as_array().map(|arr| {
                arr.iter()
                    .filter_map(|x| x.as_str().map(str::to_string))
                    .collect::<Vec<_>>()
            })
        });

        let result = PublishContentService::publish(
            state,
            PublishParams {
                content_id,
                user_id,
                platforms,
                platform_payloads: None,
            },
        )
        .await
        .map_err(|e| e.to_string())?;

        if !result.published {
            let reasons: Vec<String> = result
                .results
                .iter()
                .map(|(p, r)| format!("{p}: {}", r.message))
                .collect();
            return Err(reasons.join("; "));
        }
        Ok(())
    }

    async fn handle_email(state: &AppState, job: &QueueJob) -> Result<(), String> {
        let to = job
            .data
            .get("to")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "missing to".to_string())?;
        let subject = job
            .data
            .get("subject")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let body = job.data.get("body").and_then(|v| v.as_str()).unwrap_or("");

        let user_id = job
            .data
            .get("userId")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok());

        if let Some(uid) = user_id {
            LeadEmailService::send_lead_email(
                state,
                uid,
                SendLeadEmailDto {
                    to: to.to_string(),
                    subject: subject.to_string(),
                    body: body.to_string(),
                },
            )
            .await
            .map_err(|e| e.to_string())?;
        } else {
            crate::modules::mail::MailService::send_generic_email(state, to, subject, body)
                .await
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    async fn handle_meta_webhook(state: &AppState, job: &QueueJob) -> Result<(), String> {
        let body = job
            .data
            .get("body")
            .cloned()
            .ok_or_else(|| "missing webhook body".to_string())?;
        crate::modules::legal::route_meta_webhook(state, &body)
            .await
            .map_err(|e| e.to_string())
    }

    async fn handle_ai_task(state: &AppState, job: &QueueJob) -> Result<(), String> {
        let task_type = job
            .data
            .get("type")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "missing AI task type".to_string())?;
        let user_id = job
            .data
            .get("userId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "missing userId".to_string())?;
        let user_id = Uuid::parse_str(user_id).map_err(|e| e.to_string())?;
        let payload = job
            .data
            .get("payload")
            .cloned()
            .unwrap_or_default();
        content_ai::process_queued_task(state, task_type, user_id, payload)
            .await
            .map_err(|e| e.to_string())
    }

    async fn handle_sync_tenant_comments(state: &AppState, job: &QueueJob) -> Result<(), String> {
        let data = &job.data;
        let tenant_id = data
            .get("tenantId")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
            .ok_or_else(|| "missing tenantId".to_string())?;
        let user_id = data
            .get("userId")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
            .ok_or_else(|| "missing userId".to_string())?;
        let workspace_id = data
            .get("workspaceId")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok());
        let run_auto_reply = data
            .get("runAutoReply")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        crate::modules::comment_replies::sync_tenant_comments(
            state,
            tenant_id,
            user_id,
            workspace_id,
            run_auto_reply,
        )
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}
