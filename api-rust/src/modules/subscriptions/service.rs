use chrono::{Datelike, FixedOffset, TimeZone, Utc};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, QueryOrder, Set,
    Statement,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::deposits::entity::{
    Column as DepositColumn, Entity as DepositEntity, Model as DepositModel,
};
use crate::modules::plans::constants::{get_plan, normalize_plan_key};
use crate::modules::plans::load_plans;
use crate::modules::subscriptions::entity::{
    ActiveModel as SubscriptionActiveModel, Column as SubscriptionColumn,
    Entity as SubscriptionEntity, Model as SubscriptionModel,
};

fn calendar_month_bounds() -> (chrono::DateTime<FixedOffset>, chrono::DateTime<FixedOffset>) {
    let now = Utc::now();
    let start = Utc
        .with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0)
        .unwrap()
        .fixed_offset();
    let end = if now.month() == 12 {
        Utc.with_ymd_and_hms(now.year() + 1, 1, 1, 0, 0, 0)
    } else {
        Utc.with_ymd_and_hms(now.year(), now.month() + 1, 1, 0, 0, 0)
    }
    .unwrap()
    .fixed_offset();
    (start, end)
}

fn payment_period_bounds(
    paid_at: chrono::DateTime<FixedOffset>,
) -> (chrono::DateTime<FixedOffset>, chrono::DateTime<FixedOffset>) {
    let start = paid_at.date_naive().and_hms_opt(0, 0, 0).unwrap();
    let start = paid_at.timezone().from_local_datetime(&start).unwrap();
    let end = start + chrono::Months::new(1);
    (start, end)
}

pub async fn ensure_for_tenant(
    state: &AppState,
    tenant_id: Uuid,
    plan: &str,
) -> ApiResult<SubscriptionModel> {
    if let Some(sub) = SubscriptionEntity::find_by_id(tenant_id)
        .one(&state.db)
        .await?
    {
        return Ok(sub);
    }

    let plans = load_plans(state).await?;
    let plan_key = normalize_plan_key(Some(plan));
    let cfg = get_plan(&plans, plan_key);
    let daily_workflow = cfg
        .get("dailyWorkflowEnabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let (start, end) = calendar_month_bounds();
    let now = Utc::now().fixed_offset();

    let sub = SubscriptionActiveModel {
        tenant_id: Set(tenant_id),
        plan: Set(plan_key.to_string()),
        status: Set("active".into()),
        daily_workflow_enabled: Set(daily_workflow),
        billing_period_start: Set(start),
        billing_period_end: Set(end),
        auto_renew_enabled: Set(false),
        renewal_attempts: Set(0),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(sub)
}

async fn count_ai_calls(
    state: &AppState,
    tenant_id: Uuid,
    from: chrono::DateTime<FixedOffset>,
    to: chrono::DateTime<FixedOffset>,
) -> ApiResult<u64> {
    let stmt = Statement::from_sql_and_values(
        sea_orm::DatabaseBackend::Postgres,
        "SELECT COUNT(*) AS count FROM ai_usage WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3",
        [
            tenant_id.into(),
            from.into(),
            to.into(),
        ],
    );
    let row = state.db.query_one(stmt).await?;
    Ok(row.and_then(|r| r.try_get("", "count").ok()).unwrap_or(0))
}

async fn latest_completed_deposit(
    state: &AppState,
    tenant_id: Uuid,
) -> ApiResult<Option<DepositModel>> {
    DepositEntity::find()
        .filter(DepositColumn::TenantId.eq(tenant_id))
        .filter(DepositColumn::Status.eq("COMPLETED"))
        .order_by_desc(DepositColumn::UpdatedAt)
        .one(&state.db)
        .await
        .map_err(Into::into)
}

async fn sync_renewal_method_from_deposit(
    state: &AppState,
    mut sub: SubscriptionModel,
    deposit: &DepositModel,
) -> ApiResult<Option<SubscriptionModel>> {
    let phone = deposit.phone.as_deref().or(deposit.msisdn.as_deref());
    let Some(phone) = phone else {
        return Ok(None);
    };

    let mut changed = false;
    let mut active: SubscriptionActiveModel = sub.clone().into();

    if sub.renewal_phone.is_none() {
        active.renewal_phone = Set(Some(phone.to_string()));
        sub.renewal_phone = Some(phone.to_string());
        changed = true;
    }
    if deposit.correspondent.is_some() && sub.renewal_correspondent.is_none() {
        active.renewal_correspondent = Set(deposit.correspondent.clone());
        sub.renewal_correspondent = deposit.correspondent.clone();
        changed = true;
    }
    if normalize_plan_key(Some(&sub.plan)) != "free" && !sub.auto_renew_enabled {
        active.auto_renew_enabled = Set(true);
        sub.auto_renew_enabled = true;
        changed = true;
    }

    if !changed {
        return Ok(None);
    }

    active.updated_at = Set(Utc::now().fixed_offset());
    let saved = active.update(&state.db).await?;
    Ok(Some(saved))
}

async fn align_billing_period_from_last_payment(
    state: &AppState,
    sub: SubscriptionModel,
) -> ApiResult<Option<SubscriptionModel>> {
    let plan = normalize_plan_key(Some(&sub.plan));
    if plan == "free" {
        return Ok(None);
    }

    let Some(latest) = latest_completed_deposit(state, sub.tenant_id).await? else {
        return Ok(None);
    };

    let paid_at = latest.updated_at;
    let expected = payment_period_bounds(paid_at);
    let needs_align =
        sub.billing_period_start != expected.0 || sub.billing_period_end != expected.1;

    if !needs_align || paid_at < sub.billing_period_start {
        return sync_renewal_method_from_deposit(state, sub, &latest).await;
    }

    let mut active: SubscriptionActiveModel = sub.into();
    active.billing_period_start = Set(expected.0);
    active.billing_period_end = Set(expected.1);
    active.updated_at = Set(Utc::now().fixed_offset());
    let saved = active.update(&state.db).await?;
    sync_renewal_method_from_deposit(state, saved, &latest).await
}

async fn sync_renewal_from_latest_payment(
    state: &AppState,
    sub: SubscriptionModel,
) -> ApiResult<Option<SubscriptionModel>> {
    if normalize_plan_key(Some(&sub.plan)) == "free" {
        return Ok(None);
    }
    let Some(latest) = latest_completed_deposit(state, sub.tenant_id).await? else {
        return Ok(None);
    };
    sync_renewal_method_from_deposit(state, sub, &latest).await
}

pub async fn get_summary(state: &AppState, tenant_id: Uuid) -> ApiResult<Value> {
    let mut sub = ensure_for_tenant(state, tenant_id, "free").await?;
    if let Some(aligned) = align_billing_period_from_last_payment(state, sub.clone()).await? {
        sub = aligned;
    } else if let Some(synced) = sync_renewal_from_latest_payment(state, sub.clone()).await? {
        sub = synced;
    }

    let plans = load_plans(state).await?;
    let plan = normalize_plan_key(Some(&sub.plan));
    let cfg = get_plan(&plans, plan);
    let used = count_ai_calls(
        state,
        tenant_id,
        sub.billing_period_start,
        sub.billing_period_end,
    )
    .await?;
    let limit = cfg
        .get("aiCallsLimit")
        .and_then(|v| if v.is_null() { None } else { v.as_i64() });
    let seat_limit = cfg
        .get("seatLimit")
        .and_then(|v| if v.is_null() { None } else { v.as_i64() });

    Ok(json!({
        "tenantId": tenant_id,
        "plan": plan,
        "status": sub.status,
        "dailyWorkflowEnabled": sub.daily_workflow_enabled && sub.status == "active",
        "billingPeriodStart": sub.billing_period_start.to_rfc3339(),
        "billingPeriodEnd": sub.billing_period_end.to_rfc3339(),
        "aiCallsLimit": limit,
        "aiCallsUsed": used,
        "aiCallsRemaining": limit.map(|l| (l - used as i64).max(0)),
        "seatLimit": seat_limit,
        "autoRenewEnabled": sub.auto_renew_enabled,
        "renewalPhone": sub.renewal_phone,
        "renewalCorrespondent": sub.renewal_correspondent,
        "hasRenewalMethod": sub.renewal_phone.is_some(),
    }))
}

pub async fn set_auto_renew(
    state: &AppState,
    tenant_id: Uuid,
    enabled: bool,
) -> ApiResult<SubscriptionModel> {
    let sub = ensure_for_tenant(state, tenant_id, "free").await?;
    let plan = normalize_plan_key(Some(&sub.plan));

    if enabled && plan == "free" {
        return Err(ApiError::Forbidden(
            "Auto-renew requires a paid plan".into(),
        ));
    }
    if enabled && sub.renewal_phone.is_none() {
        return Err(ApiError::Forbidden(
            "Pay once with mobile money to save your number for auto-renew".into(),
        ));
    }

    let mut active: SubscriptionActiveModel = sub.into();
    active.auto_renew_enabled = Set(enabled);
    active.updated_at = Set(Utc::now().fixed_offset());
    active.update(&state.db).await.map_err(Into::into)
}

pub async fn activate_plan(
    state: &AppState,
    tenant_id: Uuid,
    plan_key: &str,
    paid_at: chrono::DateTime<FixedOffset>,
) -> ApiResult<SubscriptionModel> {
    let plan = normalize_plan_key(Some(plan_key));
    if plan == "free" {
        return Err(ApiError::Forbidden(
            "Cannot activate free plan via payment".into(),
        ));
    }

    let plans = load_plans(state).await?;
    let cfg = get_plan(&plans, plan);
    let daily_workflow = cfg
        .get("dailyWorkflowEnabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let (start, end) = payment_period_bounds(paid_at);

    let sub = ensure_for_tenant(state, tenant_id, plan).await?;
    let mut active: SubscriptionActiveModel = sub.into();
    active.plan = Set(plan.to_string());
    active.status = Set("active".into());
    active.daily_workflow_enabled = Set(daily_workflow);
    active.billing_period_start = Set(start);
    active.billing_period_end = Set(end);
    active.renewal_attempts = Set(0);
    active.updated_at = Set(Utc::now().fixed_offset());
    active.update(&state.db).await.map_err(Into::into)
}

pub async fn on_payment_completed(
    state: &AppState,
    tenant_id: Uuid,
    phone: Option<&str>,
    correspondent: Option<&str>,
    enable_auto_renew: bool,
) -> ApiResult<()> {
    let sub = ensure_for_tenant(state, tenant_id, "free").await?;
    let has_phone = phone.is_some() || sub.renewal_phone.is_some();
    let mut active: SubscriptionActiveModel = sub.into();
    if let Some(phone) = phone {
        active.renewal_phone = Set(Some(phone.trim().to_string()));
    }
    if let Some(correspondent) = correspondent {
        active.renewal_correspondent = Set(Some(correspondent.to_string()));
    }
    if enable_auto_renew && has_phone {
        active.auto_renew_enabled = Set(true);
    }
    active.renewal_attempts = Set(0);
    active.status = Set("active".into());
    active.updated_at = Set(Utc::now().fixed_offset());
    active.update(&state.db).await?;
    Ok(())
}

#[derive(Debug, Clone)]
pub struct CanUseAiResult {
    pub allowed: bool,
    pub reason: Option<String>,
}

pub async fn can_use_ai(state: &AppState, tenant_id: Uuid) -> ApiResult<CanUseAiResult> {
    let sub = ensure_for_tenant(state, tenant_id, "free").await?;
    if sub.status == "cancelled" {
        return Ok(CanUseAiResult {
            allowed: false,
            reason: Some("Subscription cancelled. Renew on the Billing page.".into()),
        });
    }
    if sub.status == "past_due" {
        return Ok(CanUseAiResult {
            allowed: false,
            reason: Some("Subscription payment is past due. Renew on the Billing page.".into()),
        });
    }
    if sub.status != "active" {
        return Ok(CanUseAiResult {
            allowed: false,
            reason: Some("Subscription is not active. Please renew your plan.".into()),
        });
    }

    let plan = normalize_plan_key(Some(&sub.plan));
    if plan != "free" && sub.billing_period_end < Utc::now().fixed_offset() {
        return Ok(CanUseAiResult {
            allowed: false,
            reason: Some("Your billing period has ended. Renew on the Billing page.".into()),
        });
    }

    let plans = load_plans(state).await?;
    let cfg = get_plan(&plans, plan);
    let limit = cfg
        .get("aiCallsLimit")
        .and_then(|v| if v.is_null() { None } else { v.as_i64() });
    if limit.is_none() {
        return Ok(CanUseAiResult {
            allowed: true,
            reason: None,
        });
    }

    let used = count_ai_calls(
        state,
        tenant_id,
        sub.billing_period_start,
        sub.billing_period_end,
    )
    .await?;
    if used >= limit.unwrap_or(0) as u64 {
        return Ok(CanUseAiResult {
            allowed: false,
            reason: Some(format!(
                "AI usage limit reached ({used}/{} calls this billing period). Upgrade your plan.",
                limit.unwrap_or(0)
            )),
        });
    }

    Ok(CanUseAiResult {
        allowed: true,
        reason: None,
    })
}

pub async fn find_eligible_for_daily_cron(state: &AppState) -> ApiResult<Vec<Uuid>> {
    let subs = SubscriptionEntity::find()
        .filter(SubscriptionColumn::Status.eq("active"))
        .filter(SubscriptionColumn::DailyWorkflowEnabled.eq(true))
        .all(&state.db)
        .await?;

    let mut eligible = Vec::new();
    for sub in subs {
        if can_use_ai(state, sub.tenant_id).await?.allowed {
            eligible.push(sub.tenant_id);
        }
    }
    Ok(eligible)
}

pub async fn mark_past_due(state: &AppState, tenant_id: Uuid) -> ApiResult<()> {
    let sub = ensure_for_tenant(state, tenant_id, "free").await?;
    if sub.status != "active" {
        return Ok(());
    }
    let mut active: SubscriptionActiveModel = sub.into();
    active.status = Set("past_due".into());
    active.updated_at = Set(Utc::now().fixed_offset());
    active.update(&state.db).await?;
    Ok(())
}

pub async fn downgrade_to_free(state: &AppState, tenant_id: Uuid) -> ApiResult<()> {
    let sub = ensure_for_tenant(state, tenant_id, "free").await?;
    let plans = load_plans(state).await?;
    let cfg = get_plan(&plans, "free");
    let daily_workflow = cfg
        .get("dailyWorkflowEnabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let (start, end) = calendar_month_bounds();
    let mut active: SubscriptionActiveModel = sub.into();
    active.plan = Set("free".into());
    active.status = Set("active".into());
    active.daily_workflow_enabled = Set(daily_workflow);
    active.auto_renew_enabled = Set(false);
    active.renewal_attempts = Set(0);
    active.billing_period_start = Set(start);
    active.billing_period_end = Set(end);
    active.updated_at = Set(Utc::now().fixed_offset());
    active.update(&state.db).await?;
    Ok(())
}

pub async fn record_renewal_attempt(state: &AppState, tenant_id: Uuid) -> ApiResult<()> {
    let sub = ensure_for_tenant(state, tenant_id, "free").await?;
    let mut active: SubscriptionActiveModel = sub.clone().into();
    active.renewal_attempts = Set(sub.renewal_attempts + 1);
    active.last_renewal_attempt_at = Set(Some(Utc::now().fixed_offset()));
    active.updated_at = Set(Utc::now().fixed_offset());
    active.update(&state.db).await?;
    Ok(())
}
