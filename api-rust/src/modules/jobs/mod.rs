pub mod auto_publish;
pub mod cron_util;
pub mod tenant_fanout;

use std::time::Duration;

use chrono::Weekday;

use crate::app_state::AppState;
use crate::modules::analytics::page_insights::sync_all_insights;
use crate::modules::comment_replies::sync_tenant_comments;
use crate::modules::content_ai;
use crate::modules::jobs::auto_publish::AutoPublishService;
use crate::modules::jobs::cron_util::{
    should_run_daily_at, should_run_hourly_at, should_run_weekly_at,
};
use crate::modules::jobs::tenant_fanout::{
    list_tenants_for_comment_sync, list_tenants_for_daily_workflow,
};
use crate::modules::notifications::cron_service::NotificationCronService;
use crate::modules::payments::service::check_pending_deposits;
use crate::modules::payments::subscription_renewal::process_due_renewals;
use crate::modules::queues::dispatch::QueueDispatch;

pub fn spawn_cron_jobs(state: AppState) {
    spawn_auto_publish(state.clone());
    spawn_comment_sync(state.clone());
    spawn_pawapay_poll(state.clone());
    spawn_subscription_renewal(state.clone());
    spawn_daily_workflow(state.clone());
    spawn_insights_sync(state.clone());
    spawn_notification_crons(state);
}

fn spawn_pawapay_poll(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(2 * 60));
        interval.tick().await;
        loop {
            interval.tick().await;
            if !state.config.pawapay_poll_cron_enabled {
                continue;
            }
            match check_pending_deposits(&state).await {
                Ok(result) => {
                    let completed = result
                        .get("completed")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);
                    if completed > 0 {
                        tracing::info!(completed, "PawaPay pending deposits completed");
                    }
                }
                Err(err) => tracing::error!(error = %err, "PawaPay poll cron error"),
            }
        }
    });
}

fn spawn_subscription_renewal(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        interval.tick().await;
        let mut last_run = None;
        loop {
            interval.tick().await;
            if !state.config.subscription_renewal_cron_enabled {
                continue;
            }
            if !should_run_hourly_at(&[7, 19], &mut last_run) {
                continue;
            }
            match process_due_renewals(&state).await {
                Ok(result) => {
                    if result.initiated > 0 || result.past_due > 0 || result.expired > 0 {
                        tracing::info!(
                            initiated = result.initiated,
                            past_due = result.past_due,
                            expired = result.expired,
                            "Subscription renewal cron complete"
                        );
                    }
                }
                Err(err) => tracing::error!(error = %err, "Subscription renewal cron error"),
            }
        }
    });
}

fn spawn_daily_workflow(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        interval.tick().await;
        let mut last_run = None;
        loop {
            interval.tick().await;
            if !state.config.daily_workflow_cron_enabled {
                continue;
            }
            if !should_run_daily_at(8, 0, &mut last_run) {
                continue;
            }

            let tenant_ids = match list_tenants_for_daily_workflow(&state).await {
                Ok(ids) => ids,
                Err(err) => {
                    tracing::error!(error = %err, "Daily workflow cron failed to list tenants");
                    continue;
                }
            };
            if tenant_ids.is_empty() {
                continue;
            }

            if QueueDispatch::is_enabled(&state.config) {
                let enqueued = QueueDispatch::fan_out_daily_workflow(&state, &tenant_ids).await;
                tracing::info!(enqueued, "Daily workflow enqueued for tenants");
                continue;
            }

            match content_ai::run_daily_workflow_for_tenants(&state, &tenant_ids).await {
                Ok(result) => tracing::info!(
                    generated = result.get("generated").and_then(|v| v.as_u64()).unwrap_or(0),
                    skipped = result.get("skipped").and_then(|v| v.as_u64()).unwrap_or(0),
                    "Daily workflow cron complete"
                ),
                Err(err) => tracing::error!(error = %err, "Daily workflow cron error"),
            }
        }
    });
}

fn spawn_insights_sync(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        interval.tick().await;
        let mut last_run = None;
        loop {
            interval.tick().await;
            if !state.config.insights_sync_cron_enabled {
                continue;
            }
            if !should_run_daily_at(0, 0, &mut last_run) {
                continue;
            }
            tracing::info!("Starting daily social insights sync");
            if let Err(err) = sync_all_insights(&state).await {
                tracing::error!(error = %err, "Insights sync cron error");
            } else {
                tracing::info!("Daily social insights sync completed");
            }
        }
    });
}

fn spawn_notification_crons(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        interval.tick().await;
        let mut last_daily = None;
        let mut last_weekly = None;
        loop {
            interval.tick().await;

            if state.config.notification_cron_enabled
                && should_run_daily_at(9, 0, &mut last_daily)
            {
                match NotificationCronService::check_subscription_ending_soon(&state).await {
                    Ok(sent) if sent > 0 => {
                        tracing::info!(sent, "Subscription-ending notifications sent");
                    }
                    Err(err) => tracing::error!(error = %err, "Subscription ending cron error"),
                    _ => {}
                }
            }

            if state.config.weekly_digest_cron_enabled
                && should_run_weekly_at(Weekday::Mon, 9, 0, &mut last_weekly)
            {
                match NotificationCronService::send_weekly_digests(&state).await {
                    Ok(sent) => tracing::info!(sent, "Weekly digest cron complete"),
                    Err(err) => tracing::error!(error = %err, "Weekly digest cron error"),
                }
            }
        }
    });
}

fn spawn_comment_sync(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(10 * 60));
        interval.tick().await;

        loop {
            interval.tick().await;
            if !state.config.comment_sync_cron_enabled {
                continue;
            }

            let tenants = match list_tenants_for_comment_sync(&state).await {
                Ok(rows) => rows,
                Err(err) => {
                    tracing::error!(error = %err, "Comment sync cron failed to list tenants");
                    continue;
                }
            };
            if tenants.is_empty() {
                continue;
            }

            if QueueDispatch::is_enabled(&state.config) {
                let pairs: Vec<_> = tenants
                    .iter()
                    .map(|t| (t.tenant_id, t.user_id))
                    .collect();
                let enqueued = QueueDispatch::fan_out_comment_sync(&state, &pairs).await;
                tracing::info!(enqueued, "Comment sync jobs enqueued");
                continue;
            }

            let mut fetched_total = 0usize;
            let mut auto_sent_total = 0usize;
            let tenant_count = tenants.len();
            for tenant in tenants {
                match sync_tenant_comments(
                    &state,
                    tenant.tenant_id,
                    tenant.user_id,
                    None,
                    true,
                )
                .await
                {
                    Ok((fetched, auto_sent)) => {
                        fetched_total += fetched;
                        auto_sent_total += auto_sent;
                    }
                    Err(err) => tracing::warn!(
                        tenant_id = %tenant.tenant_id,
                        error = %err,
                        "Comment sync failed for tenant"
                    ),
                }
            }

            if fetched_total > 0 || auto_sent_total > 0 {
                tracing::info!(
                    fetched = fetched_total,
                    auto_replied = auto_sent_total,
                    tenants = tenant_count,
                    "Comment sync cron complete"
                );
            }
        }
    });
}

fn spawn_auto_publish(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(5 * 60));
        interval.tick().await;

        loop {
            interval.tick().await;
            if !state.config.auto_publish_cron_enabled {
                continue;
            }

            match AutoPublishService::publish_due_items(&state).await {
                Ok(result) => {
                    if result.attempted > 0 {
                        tracing::info!(
                            attempted = result.attempted,
                            published = result.published,
                            failed = result.failed,
                            queued = ?result.queued,
                            "Auto-publish cron complete"
                        );
                    }
                    if !result.errors.is_empty() {
                        tracing::warn!(errors = ?result.errors, "Auto-publish errors");
                    }
                }
                Err(err) => tracing::error!(error = %err, "Auto-publish cron error"),
            }
        }
    });
}
