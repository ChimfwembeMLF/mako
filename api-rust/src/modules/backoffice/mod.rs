use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder, Set,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::guards::SuperAdminUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::chatbot::entity::config::Entity as ChatbotConfigEntity;
use crate::modules::deposits::entity::{Column as DepositColumn, Entity as DepositEntity};
use crate::modules::leads::entity::Entity as LeadEntity;
use crate::modules::payments::entity::{
    ActiveModel as RefundActiveModel, Column as RefundColumn, Entity as RefundEntity,
};
use crate::modules::plans::constants::{default_plans_record, BILLING_PLANS_SETTING_KEY};
use crate::modules::subscriptions::entity::{Column as SubscriptionColumn, Entity as SubscriptionEntity};
use crate::modules::system_settings::entity::{
    ActiveModel as SettingActiveModel, Entity as SettingEntity,
};
use crate::modules::tenant_members::entity::{Column as MemberColumn, Entity as MemberEntity};
use crate::modules::tenants::entity::{Column as TenantColumn, Entity as TenantEntity};
use crate::modules::users::entity::Entity as UserEntity;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/overview", get(overview))
        .route("/tenants", get(list_tenants))
        .route("/tenants/{id}", get(tenant_detail))
        .route("/plans", get(get_plans).patch(update_plans))
        .route("/refunds", get(list_refunds))
        .route("/refunds/{id}/approve", post(approve_refund))
        .route("/refunds/{id}/reject", post(reject_refund))
}

#[derive(Deserialize)]
struct RejectRefundDto {
    notes: Option<String>,
}

#[derive(Deserialize)]
struct UpdatePlansDto {
    plans: Option<Value>,
}

async fn overview(
    SuperAdminUser { .. }: SuperAdminUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let tenant_count = TenantEntity::find().count(&state.db).await?;
    let user_count = UserEntity::find().count(&state.db).await?;
    let member_count = MemberEntity::find()
        .filter(MemberColumn::IsActive.eq(true))
        .count(&state.db)
        .await?;
    let lead_count = LeadEntity::find().count(&state.db).await?;
    let chatbot_config_count = ChatbotConfigEntity::find().count(&state.db).await?;
    let deposits = DepositEntity::find().all(&state.db).await?;
    let completed_deposits = deposits
        .iter()
        .filter(|d| {
            d.status
                .as_deref()
                .map(|v| v.eq_ignore_ascii_case("COMPLETED"))
                .unwrap_or(false)
        })
        .count();
    let revenue_total: f64 = deposits
        .iter()
        .filter(|d| {
            d.status
                .as_deref()
                .map(|v| v.eq_ignore_ascii_case("COMPLETED"))
                .unwrap_or(false)
        })
        .map(|d| d.amount.and_then(|a| a.to_f64()).unwrap_or(0.0))
        .sum();
    let subscriptions = SubscriptionEntity::find().all(&state.db).await?;
    let plans = load_plans_record(&state).await?;
    let mrr_estimate: f64 = subscriptions
        .iter()
        .filter(|s| s.status == "active")
        .map(|s| plan_price(&plans, &s.plan))
        .sum();

    Ok(Json(json!({
        "tenants": tenant_count,
        "users": user_count,
        "activeMembers": member_count,
        "leads": lead_count,
        "chatbotConfigs": chatbot_config_count,
        "deposits": {
            "total": deposits.len(),
            "completed": completed_deposits,
            "revenueTotal": revenue_total
        },
        "mrrEstimate": mrr_estimate,
    })))
}

async fn list_tenants(
    SuperAdminUser { .. }: SuperAdminUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let rows = TenantEntity::find()
        .order_by_desc(TenantColumn::CreatedAt)
        .all(&state.db)
        .await?;

    Ok(Json(json!(rows
        .iter()
        .map(|t| json!({
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "ownerId": t.owner_id,
            "created_at": t.created_at,
        }))
        .collect::<Vec<_>>())))
}

async fn tenant_detail(
    SuperAdminUser { .. }: SuperAdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let tenant = TenantEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Tenant not found".into()))?;

    let member_count = MemberEntity::find()
        .filter(MemberColumn::TenantId.eq(id))
        .count(&state.db)
        .await?;
    let lead_count = LeadEntity::find()
        .filter(crate::modules::leads::entity::Column::TenantId.eq(id))
        .count(&state.db)
        .await?;
    let deposits = DepositEntity::find()
        .filter(DepositColumn::TenantId.eq(id))
        .order_by_desc(DepositColumn::CreatedAt)
        .all(&state.db)
        .await?;
    let subscription = SubscriptionEntity::find()
        .filter(SubscriptionColumn::TenantId.eq(id))
        .one(&state.db)
        .await?;

    Ok(Json(json!({
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "ownerId": tenant.owner_id,
            "created_at": tenant.created_at,
        },
        "members": member_count,
        "leads": lead_count,
        "deposits": deposits.iter().map(|d| json!({
            "id": d.id,
            "depositId": d.deposit_id,
            "status": d.status,
            "plan": d.plan,
            "amount": d.amount,
            "createdAt": d.created_at,
        })).collect::<Vec<_>>(),
        "subscription": subscription.map(|s| json!({
            "plan": s.plan,
            "status": s.status,
            "billingPeriodStart": s.billing_period_start,
            "billingPeriodEnd": s.billing_period_end,
            "autoRenewEnabled": s.auto_renew_enabled,
        })),
    })))
}

async fn get_plans(
    SuperAdminUser { .. }: SuperAdminUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let plans = load_plans_record(&state).await?;
    Ok(Json(json!({ "plans": plans })))
}

async fn update_plans(
    SuperAdminUser { .. }: SuperAdminUser,
    State(state): State<AppState>,
    Json(dto): Json<UpdatePlansDto>,
) -> ApiResult<Json<Value>> {
    let payload = dto.plans.unwrap_or_else(default_plans_record);
    let now = Utc::now().fixed_offset();
    let current = SettingEntity::find_by_id(BILLING_PLANS_SETTING_KEY)
        .one(&state.db)
        .await?;

    if let Some(existing) = current {
        let mut active: SettingActiveModel = existing.into();
        active.value = Set(payload.clone());
        active.updated_at = Set(now);
        active.update(&state.db).await?;
    } else {
        SettingActiveModel {
            key: Set(BILLING_PLANS_SETTING_KEY.to_string()),
            value: Set(payload.clone()),
            description: Set(Some("Billing plans configuration".into())),
            updated_at: Set(now),
        }
        .insert(&state.db)
        .await?;
    }

    Ok(Json(json!({
        "updated": true,
        "plans": payload,
    })))
}

async fn list_refunds(
    SuperAdminUser { .. }: SuperAdminUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let rows = RefundEntity::find()
        .order_by_desc(RefundColumn::CreatedAt)
        .all(&state.db)
        .await?;
    Ok(Json(json!({ "refunds": rows })))
}

async fn approve_refund(
    SuperAdminUser { .. }: SuperAdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let existing = RefundEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Refund request not found".into()))?;
    let mut active: RefundActiveModel = existing.into();
    active.status = Set("APPROVED".into());
    active.admin_notes = Set(Some("Approved by admin".into()));
    active.updated_at = Set(Utc::now().fixed_offset());
    let updated = active.update(&state.db).await?;

    Ok(Json(json!({
        "id": id,
        "status": updated.status,
        "amount": updated.amount,
    })))
}

async fn reject_refund(
    SuperAdminUser { .. }: SuperAdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<RejectRefundDto>,
) -> ApiResult<Json<Value>> {
    let existing = RefundEntity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Refund request not found".into()))?;
    let mut active: RefundActiveModel = existing.into();
    active.status = Set("REJECTED".into());
    active.admin_notes = Set(body.notes.clone());
    active.updated_at = Set(Utc::now().fixed_offset());
    let updated = active.update(&state.db).await?;

    Ok(Json(json!({
        "id": id,
        "status": updated.status,
        "notes": updated.admin_notes,
    })))
}

async fn load_plans_record(state: &AppState) -> ApiResult<Value> {
    let row = SettingEntity::find_by_id(BILLING_PLANS_SETTING_KEY)
        .one(&state.db)
        .await?;
    Ok(row.map(|r| r.value).unwrap_or_else(default_plans_record))
}

fn plan_price(plans: &Value, plan: &str) -> f64 {
    plans
        .get(plan)
        .and_then(|v| v.get("priceZmw"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
}
