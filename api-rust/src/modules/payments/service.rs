use axum::http::{header, StatusCode};
use chrono::Utc;
use rust_decimal::Decimal;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::deposits::entity::{
    ActiveModel as DepositActiveModel, Column as DepositColumn, Entity as DepositEntity,
    Model as DepositModel,
};
use crate::modules::payments::entity::{
    ActiveModel as RefundActiveModel, Column as RefundColumn, Entity as RefundEntity,
};
use crate::modules::plans::constants::{get_plan, get_plan_price_zmw, normalize_plan_key};
use crate::modules::plans::load_plans;
use crate::modules::subscriptions::service::{activate_plan, on_payment_completed};
use crate::modules::tenant_members::entity::{Column as MemberColumn, Entity as MemberEntity};
use crate::modules::tenants::entity::Entity as TenantEntity;
use crate::modules::users::entity::Entity as UserEntity;
use crate::services::pawapay::{InitiateDepositInput, PawaPayService};

use crate::modules::payments::invoice::{
    build_invoice_number, invoice_data_from_deposit, invoice_filename, render_invoice_pdf,
};

pub async fn assert_tenant_access(
    state: &AppState,
    user_id: Uuid,
    tenant_id: Uuid,
) -> ApiResult<()> {
    let allowed = MemberEntity::find()
        .filter(MemberColumn::TenantId.eq(tenant_id))
        .filter(MemberColumn::UserId.eq(user_id))
        .filter(MemberColumn::IsActive.eq(true))
        .one(&state.db)
        .await?
        .is_some();

    if allowed {
        Ok(())
    } else {
        Err(ApiError::Forbidden(
            "You are not a member of this workspace".into(),
        ))
    }
}

fn to_client_record(deposit: &DepositModel) -> Value {
    let status = deposit.status.as_deref().unwrap_or("").to_uppercase();
    let is_paid = status == "COMPLETED";
    json!({
        "id": deposit.deposit_id,
        "invoiceNumber": build_invoice_number(&deposit.deposit_id),
        "plan": deposit.plan,
        "status": deposit.status,
        "amount": deposit.amount.map(|d| d.to_string()),
        "currency": deposit.currency,
        "method": "mobile_money",
        "network": deposit.correspondent,
        "phone": deposit.phone.as_ref().or(deposit.msisdn.as_ref()),
        "createdAt": deposit.created_at.to_rfc3339(),
        "paidAt": if is_paid { Some(deposit.updated_at.to_rfc3339()) } else { None },
        "canDownloadInvoice": is_paid || status == "ACCEPTED",
    })
}

pub async fn initiate_deposit(
    state: &AppState,
    tenant_id: Uuid,
    plan: &str,
    phone: Option<String>,
    correspondent: Option<String>,
    is_renewal: bool,
) -> ApiResult<Value> {
    let plan_key = normalize_plan_key(Some(plan));
    if plan_key == "free" {
        return Err(ApiError::BadRequest("Cannot purchase free plan".into()));
    }

    let plans = load_plans(state).await?;
    let amount = get_plan_price_zmw(&plans, plan_key);
    let deposit_id = Uuid::new_v4().to_string();
    let now = Utc::now().fixed_offset();

    let deposit = DepositActiveModel {
        id: Set(Uuid::new_v4()),
        deposit_id: Set(deposit_id.clone()),
        tenant_id: Set(tenant_id),
        plan: Set(Some(plan_key.to_string())),
        status: Set(Some("ACCEPTED".into())),
        amount: Set(Some(Decimal::from(amount))),
        currency: Set(Some("ZMW".into())),
        phone: Set(phone.clone()),
        msisdn: Set(phone),
        correspondent: Set(Some(correspondent.unwrap_or_else(|| "MTN_MOMO_ZMB".into()))),
        provider: Set(Some("mobile_money".into())),
        is_renewal: Set(is_renewal),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    let pawapay = PawaPayService::new(state.config.pawapay.clone());
    if pawapay.is_enabled() {
        pawapay
            .initiate_deposit(InitiateDepositInput {
                deposit_id: deposit.deposit_id.clone(),
                amount: deposit
                    .amount
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| amount.to_string()),
                currency: "ZMW".into(),
                country: "ZMB".into(),
                correspondent: deposit
                    .correspondent
                    .clone()
                    .unwrap_or_else(|| "MTN_MOMO_ZMB".into()),
                phone: deposit.phone.clone().or(deposit.msisdn.clone()),
                statement_description: format!("Mako {plan_key} Plan"),
            })
            .await
            .map_err(|err| {
                tracing::error!(
                    deposit_id = %deposit.deposit_id,
                    error = %err,
                    "Failed to initiate deposit with PawaPay"
                );
                ApiError::BadRequest("Failed to communicate with payment gateway".into())
            })?;
    } else {
        tracing::warn!("PAWAPAY_API_TOKEN not configured, skipping PawaPay POST");
    }

    let message = if is_renewal {
        "Renewal payment sent — approve the prompt on your phone"
    } else {
        "Payment request sent — approve the prompt on your phone"
    };

    let mut response = json!({
        "paymentId": deposit.deposit_id,
        "status": deposit.status,
        "activated": false,
        "plan": plan_key,
        "amount": deposit.amount.map(|d| d.to_string()),
        "isRenewal": is_renewal,
        "message": message,
    });
    if !pawapay.is_enabled() {
        response["checkoutUrl"] = json!(null);
    }
    Ok(response)
}

pub async fn initiate_ads_deposit(
    state: &AppState,
    tenant_id: Uuid,
    amount: f64,
    phone: Option<String>,
    correspondent: Option<String>,
) -> ApiResult<Value> {
    if !amount.is_finite() || amount <= 0.0 {
        return Err(ApiError::BadRequest(
            "Amount must be a positive number".into(),
        ));
    }

    let deposit_id = Uuid::new_v4().to_string();
    let amount_str = amount.to_string();
    let now = Utc::now().fixed_offset();

    let deposit = DepositActiveModel {
        id: Set(Uuid::new_v4()),
        deposit_id: Set(deposit_id.clone()),
        tenant_id: Set(tenant_id),
        plan: Set(Some("ADS_TOPUP".into())),
        status: Set(Some("ACCEPTED".into())),
        amount: Set(Decimal::from_f64_retain(amount).map(Some).unwrap_or(None)),
        currency: Set(Some("ZMW".into())),
        phone: Set(phone.clone()),
        msisdn: Set(phone),
        correspondent: Set(Some(correspondent.unwrap_or_else(|| "MTN_MOMO_ZMB".into()))),
        provider: Set(Some("mobile_money".into())),
        is_renewal: Set(false),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    let pawapay = PawaPayService::new(state.config.pawapay.clone());
    if pawapay.is_enabled() {
        pawapay
            .initiate_deposit(InitiateDepositInput {
                deposit_id: deposit.deposit_id.clone(),
                amount: deposit
                    .amount
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| amount_str.clone()),
                currency: "ZMW".into(),
                country: "ZMB".into(),
                correspondent: deposit
                    .correspondent
                    .clone()
                    .unwrap_or_else(|| "MTN_MOMO_ZMB".into()),
                phone: deposit.phone.clone().or(deposit.msisdn.clone()),
                statement_description: "Mako Ads Topup".into(),
            })
            .await
            .map_err(|err| {
                tracing::error!(
                    deposit_id = %deposit.deposit_id,
                    error = %err,
                    "Failed to initiate ads deposit with PawaPay"
                );
                ApiError::BadRequest("Failed to communicate with payment gateway".into())
            })?;
    } else {
        tracing::warn!("PAWAPAY_API_TOKEN not configured, skipping PawaPay POST");
    }

    let mut response = json!({
        "paymentId": deposit.deposit_id,
        "status": deposit.status,
        "activated": false,
        "plan": "ADS_TOPUP",
        "amount": amount_str,
        "isRenewal": false,
        "message": "Payment request sent — approve the prompt on your phone",
    });
    if !pawapay.is_enabled() {
        response["checkoutUrl"] = json!(null);
    }
    Ok(response)
}

pub async fn complete_deposit(state: &AppState, deposit_id: &str) -> ApiResult<Value> {
    let deposit = DepositEntity::find()
        .filter(DepositColumn::DepositId.eq(deposit_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Deposit not found".into()))?;

    if deposit.status.as_deref() == Some("COMPLETED") {
        return Ok(json!({
            "alreadyCompleted": true,
            "tenantId": deposit.tenant_id,
            "plan": deposit.plan,
        }));
    }

    let mut active: DepositActiveModel = deposit.clone().into();
    active.status = Set(Some("COMPLETED".into()));
    active.updated_at = Set(Utc::now().fixed_offset());
    active.update(&state.db).await?;

    if deposit.plan.as_deref() == Some("ADS_TOPUP") {
        let amount = deposit
            .amount
            .and_then(|d| d.to_string().parse::<f64>().ok())
            .unwrap_or(0.0);
        if let Some(tenant) = TenantEntity::find_by_id(deposit.tenant_id)
            .one(&state.db)
            .await?
        {
            let current = tenant.ads_balance;
            let add = Decimal::from_f64_retain(amount).unwrap_or(Decimal::ZERO);
            let mut tenant_active: crate::modules::tenants::entity::ActiveModel = tenant.into();
            tenant_active.ads_balance = Set(current + add);
            tenant_active.update(&state.db).await?;
        }

        return Ok(json!({
            "tenantId": deposit.tenant_id,
            "plan": "ADS_TOPUP",
            "status": "COMPLETED",
            "amount": amount,
        }));
    }

    let plan = deposit.plan.as_deref().unwrap_or("free");
    let paid_at = Utc::now().fixed_offset();
    activate_plan(state, deposit.tenant_id, plan, paid_at).await?;
    on_payment_completed(
        state,
        deposit.tenant_id,
        deposit.phone.as_deref().or(deposit.msisdn.as_deref()),
        deposit.correspondent.as_deref(),
        true,
    )
    .await?;

    Ok(json!({
        "tenantId": deposit.tenant_id,
        "plan": normalize_plan_key(Some(plan)),
        "status": "COMPLETED",
    }))
}

pub async fn initiate_renewal_deposit(state: &AppState, tenant_id: Uuid) -> ApiResult<Value> {
    let sub =
        crate::modules::subscriptions::service::ensure_for_tenant(state, tenant_id, "free").await?;
    let plan = normalize_plan_key(Some(&sub.plan));
    if plan == "free" {
        return Err(ApiError::BadRequest("Free plan does not renew".into()));
    }
    let phone = sub.renewal_phone.ok_or_else(|| {
        ApiError::BadRequest("No saved mobile money number for auto-renew".into())
    })?;
    initiate_deposit(
        state,
        tenant_id,
        plan,
        Some(phone),
        sub.renewal_correspondent,
        true,
    )
    .await
}

pub async fn check_pending_deposits(state: &AppState) -> ApiResult<Value> {
    let pending = DepositEntity::find()
        .filter(DepositColumn::Status.eq("ACCEPTED"))
        .all(&state.db)
        .await?;

    let mut completed = 0u64;
    for deposit in pending {
        let result = check_deposit_status(state, &deposit.deposit_id).await?;
        if result.get("status").and_then(|v| v.as_str()) == Some("COMPLETED") {
            completed += 1;
        }
    }

    Ok(json!({ "completed": completed }))
}

pub async fn check_deposit_status(state: &AppState, deposit_id: &str) -> ApiResult<Value> {
    let deposit = DepositEntity::find()
        .filter(DepositColumn::DepositId.eq(deposit_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Deposit not found".into()))?;

    if deposit.status.as_deref() == Some("COMPLETED") {
        return Ok(json!({ "status": "COMPLETED" }));
    }

    let pawapay = PawaPayService::new(state.config.pawapay.clone());
    if pawapay.is_enabled() {
        match pawapay.get_deposit_status(deposit_id).await {
            Ok(Some(new_status)) => {
                if new_status == "COMPLETED" && deposit.status.as_deref() != Some("COMPLETED") {
                    complete_deposit(state, deposit_id).await?;
                    return Ok(json!({ "status": "COMPLETED" }));
                }

                if deposit.status.as_deref() != Some(new_status.as_str()) {
                    let mut active: DepositActiveModel = deposit.into();
                    active.status = Set(Some(new_status.clone()));
                    active.updated_at = Set(Utc::now().fixed_offset());
                    active.update(&state.db).await?;
                    return Ok(json!({ "status": new_status }));
                }
            }
            Ok(None) => {}
            Err(err) => {
                tracing::error!(
                    deposit_id = %deposit_id,
                    error = %err,
                    "Failed to check PawaPay status"
                );
                return Ok(json!({ "status": deposit.status }));
            }
        }
    } else if pawapay.should_auto_complete() {
        complete_deposit(state, deposit_id).await?;
        return Ok(json!({ "status": "COMPLETED" }));
    } else {
        tracing::warn!("PAWAPAY_API_TOKEN not configured, skipping status check");
    }

    Ok(json!({ "status": deposit.status }))
}

pub async fn find_by_tenant(state: &AppState, tenant_id: Uuid, user_id: Uuid) -> ApiResult<Value> {
    assert_tenant_access(state, user_id, tenant_id).await?;
    let rows = DepositEntity::find()
        .filter(DepositColumn::TenantId.eq(tenant_id))
        .order_by_desc(DepositColumn::CreatedAt)
        .all(&state.db)
        .await?;

    Ok(json!(rows.iter().map(to_client_record).collect::<Vec<_>>()))
}

pub async fn generate_invoice_response(
    state: &AppState,
    deposit_id: &str,
    tenant_id: Uuid,
    user_id: Uuid,
) -> ApiResult<(StatusCode, [(header::HeaderName, String); 3], Vec<u8>)> {
    assert_tenant_access(state, user_id, tenant_id).await?;

    let deposit = DepositEntity::find()
        .filter(DepositColumn::DepositId.eq(deposit_id))
        .filter(DepositColumn::TenantId.eq(tenant_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Payment record not found".into()))?;

    let tenant = TenantEntity::find_by_id(tenant_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Tenant not found".into()))?;

    let owner_email = UserEntity::find_by_id(tenant.owner_id)
        .one(&state.db)
        .await?
        .and_then(|u| u.email);

    let plans = load_plans(state).await.ok();
    let plan_key = normalize_plan_key(deposit.plan.as_deref());
    let plan_label = plans.as_ref().and_then(|p| {
        get_plan(p, plan_key)
            .get("label")
            .and_then(|v| v.as_str())
            .map(str::to_string)
    });
    let plan_price = plans
        .as_ref()
        .map(|p| get_plan_price_zmw(p, plan_key));

    let invoice_data =
        invoice_data_from_deposit(&deposit, &tenant, owner_email, plan_label.as_deref(), plan_price);
    let pdf = render_invoice_pdf(&invoice_data)
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("Invoice PDF failed: {e}")))?;
    let filename = invoice_filename(deposit_id);
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/pdf".into()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{filename}\""),
            ),
            (header::CONTENT_LENGTH, pdf.len().to_string()),
        ],
        pdf,
    ))
}

pub async fn request_refund(
    state: &AppState,
    tenant_id: Uuid,
    deposit_id: &str,
    reason: &str,
    user_id: Uuid,
) -> ApiResult<Value> {
    assert_tenant_access(state, user_id, tenant_id).await?;

    let deposit = DepositEntity::find()
        .filter(DepositColumn::DepositId.eq(deposit_id))
        .filter(DepositColumn::TenantId.eq(tenant_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("Payment record not found".into()))?;

    if deposit.status.as_deref() != Some("COMPLETED") {
        return Err(ApiError::BadRequest(
            "Can only request a refund for completed payments".into(),
        ));
    }

    let existing = RefundEntity::find()
        .filter(RefundColumn::DepositId.eq(deposit.id))
        .one(&state.db)
        .await?;

    if existing.is_some() {
        return Err(ApiError::BadRequest(
            "A refund request already exists for this payment".into(),
        ));
    }

    let now = Utc::now().fixed_offset();
    RefundActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        deposit_id: Set(deposit.id),
        amount: Set(deposit.amount.unwrap_or(Decimal::ZERO)),
        reason: Set(reason.to_string()),
        status: Set("PENDING".into()),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?;

    Ok(json!({
        "success": true,
        "message": "Refund requested successfully",
    }))
}
