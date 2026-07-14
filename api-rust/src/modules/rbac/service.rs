use chrono::Utc;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use serde::Serialize;
use std::collections::HashSet;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::profiles::entity::{Column as ProfileColumn, Entity as ProfileEntity};
use crate::modules::role_permissions::entity::{
    Column as RolePermColumn, Entity as RolePermEntity,
};
use crate::modules::roles::entity::Entity as RoleEntity;
use crate::modules::tenant_members::entity::{Column as MemberColumn, Entity as MemberEntity};
use crate::modules::user_permissions::entity::{
    Column as UserPermColumn, Entity as UserPermEntity,
};
use crate::modules::users::entity::Entity as UserEntity;

use super::constants::SUPER_ADMIN_PERMISSIONS;

#[derive(Serialize)]
pub struct EffectivePermissions {
    pub permissions: Vec<String>,
    #[serde(rename = "isSystemAdmin")]
    pub is_system_admin: bool,
    #[serde(rename = "isSuperAdmin")]
    pub is_super_admin: bool,
    #[serde(rename = "roleId")]
    pub role_id: Option<Uuid>,
    #[serde(rename = "roleName")]
    pub role_name: Option<String>,
}

pub struct RbacService;

impl RbacService {
    pub async fn has_roles(
        state: &AppState,
        user_id: Uuid,
        tenant_id: Uuid,
        required_roles: &[String],
    ) -> ApiResult<bool> {
        if required_roles.is_empty() {
            return Ok(false);
        }

        let member = MemberEntity::find()
            .filter(MemberColumn::UserId.eq(user_id))
            .filter(MemberColumn::TenantId.eq(tenant_id))
            .filter(MemberColumn::IsActive.eq(true))
            .one(&state.db)
            .await?;

        let Some(member) = member else {
            return Ok(false);
        };

        let role = RoleEntity::find_by_id(member.role_id)
            .one(&state.db)
            .await?;
        Ok(role
            .map(|r| required_roles.iter().any(|name| &r.name == name))
            .unwrap_or(false))
    }

    pub async fn has_permission(
        state: &AppState,
        user_id: Uuid,
        tenant_id: Uuid,
        permission: &str,
    ) -> ApiResult<bool> {
        let effective = Self::get_effective_permissions(state, user_id, tenant_id).await?;
        Ok(effective.permissions.iter().any(|p| p == permission))
    }

    pub async fn get_effective_permissions(
        state: &AppState,
        user_id: Uuid,
        tenant_id: Uuid,
    ) -> ApiResult<EffectivePermissions> {
        let profile = ProfileEntity::find()
            .filter(ProfileColumn::UserId.eq(user_id))
            .one(&state.db)
            .await?;

        let user = UserEntity::find_by_id(user_id).one(&state.db).await?;

        let is_super_admin = profile
            .as_ref()
            .and_then(|p| p.is_system_admin)
            .unwrap_or(false)
            || user
                .as_ref()
                .map(|u| u.role == "SUPER_ADMIN")
                .unwrap_or(false);

        let member = MemberEntity::find()
            .filter(MemberColumn::UserId.eq(user_id))
            .filter(MemberColumn::TenantId.eq(tenant_id))
            .filter(MemberColumn::IsActive.eq(true))
            .one(&state.db)
            .await?;

        let Some(member) = member else {
            return Ok(EffectivePermissions {
                permissions: vec![],
                is_system_admin: is_super_admin,
                is_super_admin,
                role_id: None,
                role_name: None,
            });
        };

        let role = RoleEntity::find_by_id(member.role_id)
            .one(&state.db)
            .await?;

        let role_perms = RolePermEntity::find()
            .filter(RolePermColumn::RoleId.eq(member.role_id))
            .all(&state.db)
            .await?;

        let mut granted: HashSet<String> =
            role_perms.into_iter().map(|rp| rp.permission_key).collect();

        let now = Utc::now().fixed_offset();
        let overrides = UserPermEntity::find()
            .filter(UserPermColumn::UserId.eq(user_id))
            .filter(UserPermColumn::TenantId.eq(tenant_id))
            .all(&state.db)
            .await?;

        for ov in overrides {
            if ov.valid_from.map(|v| v > now).unwrap_or(false) {
                continue;
            }
            if ov.valid_until.map(|v| v < now).unwrap_or(false) {
                continue;
            }
            match ov.effect.as_str() {
                "allow" => {
                    granted.insert(ov.permission_key);
                }
                "deny" => {
                    granted.remove(&ov.permission_key);
                }
                _ => {}
            }
        }

        if is_super_admin {
            for key in SUPER_ADMIN_PERMISSIONS {
                granted.insert((*key).to_string());
            }
        }

        let mut permissions: Vec<String> = granted.into_iter().collect();
        permissions.sort();

        Ok(EffectivePermissions {
            permissions,
            is_system_admin: is_super_admin,
            is_super_admin,
            role_id: role.as_ref().map(|r| r.id),
            role_name: role.map(|r| r.name),
        })
    }
}
