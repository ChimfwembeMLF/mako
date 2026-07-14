use chrono::{Duration, Utc};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::deposits::entity::{
    Column as DepositColumn, Entity as DepositEntity,
};
use crate::modules::notifications::cron_service::NotificationCronService;
use crate::modules::payments::service::initiate_renewal_deposit;
use crate::modules::plans::constants::normalize_plan_key;
use crate::modules::subscriptions::entity::{
    Column as SubscriptionColumn, Entity as SubscriptionEntity,
};
use crate::modules::subscriptions::service::{
    downgrade_to_free, mark_past_due, record_renewal_attempt, set_auto_renew,
};

const RENEWAL_WINDOW_HOURS: i64 = 24;
const RENEWAL_GRACE_DAYS: i64 = 3;
const MAX_RENEWAL_ATTEMPTS: i32 = 3;

pub struct RenewalResult {
    pub initiated: usize,
    pub past_due: usize,
    pub expired: usize,
}

pub async fn process_due_renewals(state: &AppState) -> ApiResult<RenewalResult> {
    let now = Utc::now().fixed_offset();
    let renewal_window_end = now + Duration::hours(RENEWAL_WINDOW_HOURS);
    let grace_cutoff = now - Duration::days(RENEWAL_GRACE_DAYS);

    let subs = SubscriptionEntity::find()
        .filter(
            SubscriptionColumn::Status
                .is_in(["active".to_string(), "past_due".to_string()]),
        )
        .all(&state.db)
        .await?;

    let mut initiated = 0usize;
    let mut past_due = 0usize;
    let mut expired = 0usize;

    for sub in subs {
        let plan = normalize_plan_key(Some(&sub.plan));
        if plan == "free" {
            continue;
        }

        let period_ended = sub.billing_period_end <= now;
        let in_renewal_window = sub.billing_period_end <= renewal_window_end;

        if period_ended && sub.status == "active" {
            let renewed =
                has_completed_payment_since(state, sub.tenant_id, sub.billing_period_start).await?;
            if !renewed {
                mark_past_due(state, sub.tenant_id).await?;
                NotificationCronService::notify_subscription_past_due(state, sub.tenant_id, plan)
                    .await?;
                past_due += 1;
            }
        }

        if period_ended && sub.billing_period_end <= grace_cutoff && sub.status == "past_due" {
            let renewed =
                has_completed_payment_since(state, sub.tenant_id, sub.billing_period_start).await?;
            if !renewed {
                downgrade_to_free(state, sub.tenant_id).await?;
                NotificationCronService::notify_subscription_expired(state, sub.tenant_id, plan)
                    .await?;
                expired += 1;
                continue;
            }
        }

        if !sub.auto_renew_enabled || sub.renewal_phone.is_none() {
            continue;
        }
        if !in_renewal_window {
            continue;
        }
        if sub.renewal_attempts >= MAX_RENEWAL_ATTEMPTS {
            set_auto_renew(state, sub.tenant_id, false).await?;
            NotificationCronService::notify_renewal_failed(
                state,
                sub.tenant_id,
                plan,
                "Max renewal attempts reached",
            )
            .await?;
            continue;
        }
        if has_pending_renewal(state, sub.tenant_id).await? {
            continue;
        }
        if has_completed_payment_since(state, sub.tenant_id, sub.billing_period_start).await? {
            continue;
        }

        match initiate_renewal_deposit(state, sub.tenant_id).await {
            Ok(result) => {
                record_renewal_attempt(state, sub.tenant_id).await?;
                let payment_id = result
                    .get("paymentId")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default();
                NotificationCronService::notify_renewal_initiated(
                    state,
                    sub.tenant_id,
                    plan,
                    payment_id,
                )
                .await?;
                initiated += 1;
                tracing::info!(tenant_id = %sub.tenant_id, plan, "Renewal initiated");
            }
            Err(err) => {
                tracing::warn!(
                    tenant_id = %sub.tenant_id,
                    error = %err,
                    "Renewal failed for tenant"
                );
                NotificationCronService::notify_renewal_failed(
                    state,
                    sub.tenant_id,
                    plan,
                    &err.to_string(),
                )
                .await?;
            }
        }
    }

    Ok(RenewalResult {
        initiated,
        past_due,
        expired,
    })
}

async fn has_pending_renewal(state: &AppState, tenant_id: Uuid) -> ApiResult<bool> {
    let pending = DepositEntity::find()
        .filter(DepositColumn::TenantId.eq(tenant_id))
        .filter(DepositColumn::Status.eq("ACCEPTED"))
        .filter(DepositColumn::IsRenewal.eq(true))
        .order_by_desc(DepositColumn::CreatedAt)
        .one(&state.db)
        .await?;
    Ok(pending.is_some())
}

async fn has_completed_payment_since(
    state: &AppState,
    tenant_id: Uuid,
    since: chrono::DateTime<chrono::FixedOffset>,
) -> ApiResult<bool> {
    let paid = DepositEntity::find()
        .filter(DepositColumn::TenantId.eq(tenant_id))
        .filter(DepositColumn::Status.eq("COMPLETED"))
        .filter(DepositColumn::UpdatedAt.gt(since))
        .order_by_desc(DepositColumn::UpdatedAt)
        .one(&state.db)
        .await?;
    Ok(paid.is_some())
}
