use chrono::{Duration, Utc};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder, Set,
};
use serde_json::json;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::comment_replies::entity::{
    Column as ReplyColumn, Entity as ReplyEntity,
};
use crate::modules::content_publications::entity::{
    Column as PublicationColumn, Entity as PublicationEntity,
};
use crate::modules::leads::entity::{Column as LeadColumn, Entity as LeadEntity};
use crate::modules::notifications::entity::notifications::{
    ActiveModel as NotificationActiveModel, Column as NotificationColumn,
    Entity as NotificationEntity,
};
use crate::modules::subscriptions::entity::{
    Column as SubscriptionColumn, Entity as SubscriptionEntity,
};
use crate::modules::tenant_members::entity::{
    Column as MemberColumn, Entity as MemberEntity,
};
use crate::modules::users::entity::Entity as UserEntity;

pub struct NotificationCronService;

impl NotificationCronService {
    pub async fn check_subscription_ending_soon(state: &AppState) -> ApiResult<usize> {
        let now = Utc::now().fixed_offset();
        let in_seven_days = now + Duration::days(7);

        let subs = SubscriptionEntity::find()
            .filter(SubscriptionColumn::Status.eq("active"))
            .filter(SubscriptionColumn::BillingPeriodEnd.gte(now))
            .filter(SubscriptionColumn::BillingPeriodEnd.lte(in_seven_days))
            .all(&state.db)
            .await?;

        let mut sent = 0usize;
        for sub in subs {
            if normalize_plan_key(Some(&sub.plan)) == "free" {
                continue;
            }
            let days_left = ((sub.billing_period_end - now).num_seconds() as f64
                / 86_400.0)
                .ceil() as i64;
            if ![7, 3, 1].contains(&days_left) {
                continue;
            }
            if recent_tenant_notification(state, sub.tenant_id, "subscription_ending", 20).await? {
                continue;
            }

            let auto_renew_note = if sub.auto_renew_enabled && sub.renewal_phone.is_some() {
                " Auto-renew is enabled — we will charge your saved mobile money number."
            } else {
                " Renew on the Billing page to avoid interruption."
            };
            notify_tenant_members(
                state,
                sub.tenant_id,
                "subscription_ending",
                "Subscription ending soon",
                &format!("Your billing period ends in {days_left} day(s).{auto_renew_note}"),
                Some("/billing"),
                Some(json!({
                    "daysLeft": days_left,
                    "plan": sub.plan,
                    "autoRenew": sub.auto_renew_enabled,
                })),
                true,
                Some("email_billing"),
            )
            .await?;
            sent += 1;
        }
        Ok(sent)
    }

    pub async fn send_weekly_digests(state: &AppState) -> ApiResult<usize> {
        let tenant_ids: Vec<Uuid> = SubscriptionEntity::find()
            .filter(SubscriptionColumn::Status.eq("active"))
            .all(&state.db)
            .await?
            .into_iter()
            .map(|s| s.tenant_id)
            .collect();

        let week_ago = Utc::now().fixed_offset() - Duration::days(7);
        let mut sent = 0usize;

        for tenant_id in tenant_ids {
            let members = MemberEntity::find()
                .filter(MemberColumn::TenantId.eq(tenant_id))
                .all(&state.db)
                .await?;
            let pubs = PublicationEntity::find()
                .filter(PublicationColumn::TenantId.eq(tenant_id))
                .filter(PublicationColumn::Status.eq("published"))
                .all(&state.db)
                .await?;
            let recent_pubs: Vec<_> = pubs
                .iter()
                .filter(|p| p.published_at.map(|d| d >= week_ago).unwrap_or(false))
                .collect();
            let total_engagement: i32 = recent_pubs.iter().map(|p| p.engagement_score).sum();
            let pending_comments: u64 = ReplyEntity::find()
                .filter(ReplyColumn::TenantId.eq(tenant_id))
                .filter(ReplyColumn::Status.eq("pending"))
                .count(&state.db)
                .await?;
            let new_leads: u64 = LeadEntity::find()
                .filter(LeadColumn::TenantId.eq(tenant_id))
                .filter(LeadColumn::CreatedAt.gte(week_ago))
                .count(&state.db)
                .await?;

            let body = format!(
                "Published: {} post(s)\nEngagement score: {total_engagement}\nPending comment replies: {pending_comments}\nNew leads: {new_leads}\n\nView full analytics in your dashboard.",
                recent_pubs.len()
            );

            for member in members {
                let prefs = ensure_preferences(state, member.user_id, tenant_id).await?;
                if !prefs.email_weekly_digest && !prefs.in_app_enabled {
                    continue;
                }
                notify_user(
                    state,
                    tenant_id,
                    member.user_id,
                    "weekly_digest",
                    "Your weekly content overview",
                    &body,
                    Some("/analytics"),
                    Some(json!({
                        "published": recent_pubs.len(),
                        "engagement": total_engagement,
                        "pendingComments": pending_comments,
                        "newLeads": new_leads,
                    })),
                    prefs.email_weekly_digest,
                    prefs.in_app_enabled,
                )
                .await?;
            }
            sent += 1;
        }
        Ok(sent)
    }

    pub async fn notify_subscription_past_due(
        state: &AppState,
        tenant_id: Uuid,
        plan: &str,
    ) -> ApiResult<()> {
        if recent_tenant_notification(state, tenant_id, "subscription_past_due", 24).await? {
            return Ok(());
        }
        notify_tenant_members(
            state,
            tenant_id,
            "subscription_past_due",
            "Subscription past due",
            &format!("Your {plan} plan billing period has ended. Renew now to restore full access."),
            Some("/billing"),
            Some(json!({ "plan": plan })),
            true,
            Some("email_billing"),
        )
        .await?;
        Ok(())
    }

    pub async fn notify_subscription_expired(
        state: &AppState,
        tenant_id: Uuid,
        plan: &str,
    ) -> ApiResult<()> {
        notify_tenant_members(
            state,
            tenant_id,
            "subscription_expired",
            "Subscription expired",
            &format!("Your {plan} plan was not renewed and has been downgraded to Free."),
            Some("/billing"),
            Some(json!({ "plan": plan })),
            true,
            Some("email_billing"),
        )
        .await?;
        Ok(())
    }

    pub async fn notify_renewal_initiated(
        state: &AppState,
        tenant_id: Uuid,
        plan: &str,
        payment_id: &str,
    ) -> ApiResult<()> {
        notify_tenant_members(
            state,
            tenant_id,
            "subscription_renewal",
            "Auto-renewal started",
            &format!(
                "We sent a mobile money prompt to renew your {plan} plan. Approve it on your phone to continue uninterrupted."
            ),
            Some("/billing"),
            Some(json!({ "plan": plan, "paymentId": payment_id, "autoRenew": true })),
            true,
            Some("email_billing"),
        )
        .await?;
        Ok(())
    }

    pub async fn notify_renewal_failed(
        state: &AppState,
        tenant_id: Uuid,
        plan: &str,
        reason: &str,
    ) -> ApiResult<()> {
        notify_tenant_members(
            state,
            tenant_id,
            "subscription_renewal_failed",
            "Auto-renewal failed",
            &format!("Could not renew your {plan} plan: {reason}. Update billing on the Billing page."),
            Some("/billing"),
            Some(json!({ "plan": plan, "reason": reason })),
            true,
            Some("email_billing"),
        )
        .await?;
        Ok(())
    }
}

async fn notify_tenant_members(
    state: &AppState,
    tenant_id: Uuid,
    notification_type: &str,
    title: &str,
    body: &str,
    link: Option<&str>,
    metadata: Option<serde_json::Value>,
    send_email: bool,
    email_category: Option<&str>,
) -> ApiResult<()> {
    let members = MemberEntity::find()
        .filter(MemberColumn::TenantId.eq(tenant_id))
        .all(&state.db)
        .await?;
    for member in members {
        let prefs = ensure_preferences(state, member.user_id, tenant_id).await?;
        let email = send_email
            && email_category.is_some_and(|cat| email_pref_enabled(&prefs, cat));
        notify_user(
            state,
            tenant_id,
            member.user_id,
            notification_type,
            title,
            body,
            link,
            metadata.clone(),
            email,
            prefs.in_app_enabled,
        )
        .await?;
    }
    Ok(())
}

async fn notify_user(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    notification_type: &str,
    title: &str,
    body: &str,
    link: Option<&str>,
    metadata: Option<serde_json::Value>,
    send_email: bool,
    in_app: bool,
) -> ApiResult<()> {
    if !in_app && !send_email {
        return Ok(());
    }

    if in_app {
        NotificationActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(tenant_id),
            user_id: Set(user_id),
            notification_type: Set(notification_type.to_string()),
            title: Set(title.to_string()),
            body: Set(body.to_string()),
            link: Set(link.map(str::to_string)),
            is_read: Set(false),
            email_sent: Set(false),
            metadata: Set(metadata),
            created_at: Set(Utc::now().fixed_offset()),
        }
        .insert(&state.db)
        .await?;
    }

    if send_email {
        if let Some(user) = UserEntity::find_by_id(user_id).one(&state.db).await? {
            if let Some(email) = user.email.filter(|e| !e.trim().is_empty()) {
                let _ = crate::modules::mail::MailService::send_generic_email(
                    state, &email, title, body,
                )
                .await;
            }
        }
    }
    Ok(())
}

async fn recent_tenant_notification(
    state: &AppState,
    tenant_id: Uuid,
    notification_type: &str,
    within_hours: i64,
) -> ApiResult<bool> {
    let since = Utc::now().fixed_offset() - Duration::hours(within_hours);
    let row = NotificationEntity::find()
        .filter(NotificationColumn::TenantId.eq(tenant_id))
        .filter(NotificationColumn::NotificationType.eq(notification_type))
        .filter(NotificationColumn::CreatedAt.gte(since))
        .order_by_desc(NotificationColumn::CreatedAt)
        .one(&state.db)
        .await?;
    Ok(row.is_some())
}

async fn ensure_preferences(
    state: &AppState,
    user_id: Uuid,
    tenant_id: Uuid,
) -> ApiResult<crate::modules::notifications::entity::notification_preferences::Model> {
    use crate::modules::notifications::entity::notification_preferences::{
        ActiveModel as PreferencesActiveModel, Column as PreferencesColumn, Entity as PreferencesEntity,
    };

    if let Some(prefs) = PreferencesEntity::find()
        .filter(PreferencesColumn::UserId.eq(user_id))
        .filter(PreferencesColumn::TenantId.eq(tenant_id))
        .one(&state.db)
        .await?
    {
        return Ok(prefs);
    }

    let now = Utc::now().fixed_offset();
    PreferencesActiveModel {
        user_id: Set(user_id),
        tenant_id: Set(tenant_id),
        email_publish_success: Set(true),
        email_billing: Set(true),
        email_weekly_digest: Set(true),
        email_hot_leads: Set(true),
        in_app_enabled: Set(true),
        updated_at: Set(now),
    }
    .insert(&state.db)
    .await
    .map_err(Into::into)
}

fn email_pref_enabled(
    prefs: &crate::modules::notifications::entity::notification_preferences::Model,
    category: &str,
) -> bool {
    match category {
        "email_billing" => prefs.email_billing,
        "email_weekly_digest" => prefs.email_weekly_digest,
        "email_publish_success" => prefs.email_publish_success,
        "email_hot_leads" => prefs.email_hot_leads,
        _ => true,
    }
}

fn normalize_plan_key(plan: Option<&str>) -> &str {
    crate::modules::plans::constants::normalize_plan_key(plan)
}
