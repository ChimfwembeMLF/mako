use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::content_items::entity::{
    Column as ContentColumn, Entity as ContentEntity, Model as ContentModel,
};
use crate::modules::content_items::schedule::{is_content_due, now_local_naive};
use crate::modules::content_publishing::types::MAX_PUBLISH_ATTEMPTS;
use crate::modules::content_publishing::{
    PlatformPayloadStored, PublishContentService, PublishParams,
};
use crate::modules::queues::dispatch::QueueDispatch;

pub struct AutoPublishService;

pub struct AutoPublishResult {
    pub attempted: usize,
    pub published: usize,
    pub failed: usize,
    pub errors: Vec<String>,
    pub queued: Option<usize>,
}

impl AutoPublishService {
    pub async fn publish_due_items(state: &AppState) -> ApiResult<AutoPublishResult> {
        if QueueDispatch::is_enabled(&state.config) {
            match Self::queue_due_items(state).await {
                Ok(queued) => {
                    return Ok(AutoPublishResult {
                        attempted: queued,
                        published: 0,
                        failed: 0,
                        errors: vec![],
                        queued: Some(queued),
                    });
                }
                Err(err) => {
                    tracing::warn!(
                        error = %err,
                        "Queue auto-publish failed — publishing due items in-process"
                    );
                }
            }
        }

        let due = Self::find_due_items(state).await?;
        let mut published = 0usize;
        let mut failed = 0usize;
        let mut errors = Vec::new();

        for item in due {
            match PublishContentService::publish(
                state,
                PublishParams {
                    content_id: item.id,
                    user_id: item.user_id,
                    platforms: item.platforms.clone(),
                    platform_payloads: parse_platform_payloads(item.platform_payloads.clone()),
                },
            )
            .await
            {
                Ok(result) => {
                    if result.published {
                        published += 1;
                        tracing::info!(content_id = %item.id, "Auto-published content");
                    } else {
                        failed += 1;
                        let msg: Vec<String> =
                            result.results.values().map(|r| r.message.clone()).collect();
                        errors.push(format!("{}: {}", item.id, msg.join("; ")));
                    }
                }
                Err(err) => {
                    failed += 1;
                    errors.push(format!("{}: {err}", item.id));
                    tracing::warn!(content_id = %item.id, error = %err, "Auto-publish failed");
                }
            }
        }

        Ok(AutoPublishResult {
            attempted: published + failed,
            published,
            failed,
            errors,
            queued: None,
        })
    }

    pub async fn queue_due_items(state: &AppState) -> ApiResult<usize> {
        let due = Self::find_due_items(state).await?;
        let mut queued = 0usize;
        for item in due {
            QueueDispatch::enqueue_publish(
                state,
                item.tenant_id,
                item.id,
                item.user_id,
                item.platforms.clone(),
            )
            .await;
            queued += 1;
        }
        Ok(queued)
    }

    pub async fn find_due_items(state: &AppState) -> ApiResult<Vec<ContentModel>> {
        let now = now_local_naive();
        let items = ContentEntity::find()
            .filter(ContentColumn::Status.is_in(["approved".to_string(), "scheduled".to_string()]))
            .filter(ContentColumn::DeletedAt.is_null())
            .all(&state.db)
            .await?;

        Ok(items
            .into_iter()
            .filter(|item| {
                is_content_due(item, now) && item.publish_attempts < MAX_PUBLISH_ATTEMPTS
            })
            .collect())
    }
}

fn parse_platform_payloads(
    raw: Option<sea_orm::JsonValue>,
) -> Option<std::collections::HashMap<String, PlatformPayloadStored>> {
    let val = raw?;
    serde_json::from_value(val).ok()
}
