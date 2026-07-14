use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set, TransactionTrait};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::profiles::entity::{
    ActiveModel as ProfileActiveModel, Column as ProfileColumn, Entity as ProfileEntity,
};
use crate::modules::rbac::seed::RbacSeedService;
use crate::modules::roles::entity::{Column as RoleColumn, Entity as RoleEntity};
use crate::modules::subscriptions::service;
use crate::modules::tenant_members::entity::{
    ActiveModel as MemberActiveModel, Column as MemberColumn, Entity as MemberEntity,
};
use crate::modules::tenants::entity::{
    ActiveModel as TenantActiveModel, Entity as TenantEntity, Model as TenantModel,
};
use crate::modules::tenants::tenant_seeds::TenantSeedService;
use crate::modules::users::entity::Model as UserModel;
use crate::modules::workspaces::entity::ActiveModel as WorkspaceActiveModel;

pub struct TenantBootstrapService;

impl TenantBootstrapService {
    pub async fn bootstrap_for_user(state: &AppState, user: &UserModel) -> ApiResult<TenantModel> {
        RbacSeedService::ensure_permissions_seeded(state).await?;

        let memberships = MemberEntity::find()
            .filter(MemberColumn::UserId.eq(user.id))
            .all(&state.db)
            .await?;

        if !memberships.is_empty() {
            for membership in &memberships {
                RbacSeedService::ensure_owner_permissions(state, membership.tenant_id).await?;
                TenantSeedService::seed_tenant_defaults(state, membership.tenant_id, user).await?;
                service::ensure_for_tenant(state, membership.tenant_id, "free").await?;
            }

            let tenant = TenantEntity::find_by_id(memberships[0].tenant_id)
                .one(&state.db)
                .await?
                .ok_or_else(|| {
                    crate::common::ApiError::Internal(anyhow::anyhow!("Tenant not found"))
                })?;
            return Ok(tenant);
        }

        Self::ensure_profile(state, user).await?;

        let txn = state.db.begin().await?;
        let now = Utc::now().fixed_offset();

        let slug_base = user
            .email
            .as_deref()
            .and_then(|e| e.split('@').next())
            .or(user.first_name.as_deref())
            .unwrap_or("workspace")
            .to_lowercase()
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
            .collect::<String>()
            .trim_matches('-')
            .to_string();

        let slug = format!("{slug_base}-{}", Uuid::new_v4().simple());

        let workspace_label = user
            .first_name
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .or(user.email.as_deref().and_then(|e| e.split('@').next()))
            .unwrap_or("My");

        let tenant = TenantActiveModel {
            id: Set(Uuid::new_v4()),
            name: Set(format!("{workspace_label}'s Workspace")),
            slug: Set(slug),
            owner_id: Set(user.id),
            ads_balance: Set(rust_decimal::Decimal::ZERO),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        let _owner_role_id = RbacSeedService::seed_tenant_roles(state, tenant.id, &txn).await?;

        MemberActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(tenant.id),
            user_id: Set(user.id),
            role_id: Set(
                RoleEntity::find()
                    .filter(RoleColumn::TenantId.eq(tenant.id))
                    .filter(RoleColumn::Name.eq("Owner"))
                    .one(&txn)
                    .await?
                    .map(|r| r.id)
                    .ok_or_else(|| {
                        crate::common::ApiError::Internal(anyhow::anyhow!("Owner role not found"))
                    })?,
            ),
            is_active: Set(true),
            invited_by: Set(user.id),
            joined_at: Set(now),
        }
        .insert(&txn)
        .await?;

        WorkspaceActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(tenant.id),
            name: Set("Default".to_string()),
            slug: Set("default".to_string()),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&txn)
        .await?;

        let roles = RoleEntity::find()
            .filter(RoleColumn::TenantId.eq(tenant.id))
            .all(&txn)
            .await?;
        TenantSeedService::seed_approval_workflows(&txn, tenant.id, &roles, user.id).await?;

        txn.commit().await?;

        service::ensure_for_tenant(state, tenant.id, "free").await?;
        TenantSeedService::seed_tenant_defaults(state, tenant.id, user).await?;

        Ok(tenant)
    }

    async fn ensure_profile(state: &AppState, user: &UserModel) -> ApiResult<()> {
        let existing = ProfileEntity::find()
            .filter(ProfileColumn::UserId.eq(user.id))
            .one(&state.db)
            .await?;

        let display_name = user
            .first_name
            .as_deref()
            .or(user.email.as_deref())
            .map(str::to_string);

        if let Some(profile) = existing {
            if profile.display_name.is_none() && display_name.is_some() {
                let mut active: ProfileActiveModel = profile.into();
                active.display_name = Set(display_name.clone());
                active.full_name = Set(display_name);
                if user.avatar.is_some() {
                    active.avatar_url = Set(user.avatar.clone());
                }
                active.update(&state.db).await?;
            }
            return Ok(());
        }

        let now = Utc::now().fixed_offset();
        ProfileActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user.id),
            display_name: Set(display_name.clone()),
            full_name: Set(display_name),
            avatar_url: Set(user.avatar.clone()),
            is_system_admin: Set(Some(false)),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(&state.db)
        .await?;

        Ok(())
    }
}
