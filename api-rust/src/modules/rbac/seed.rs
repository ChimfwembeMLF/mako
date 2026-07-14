use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::permissions::entity::{
    ActiveModel as PermissionActiveModel, Entity as PermissionEntity,
};
use crate::modules::role_permissions::entity::{
    ActiveModel as RolePermActiveModel, Column as RolePermColumn, Entity as RolePermEntity,
};
use crate::modules::roles::entity::{
    ActiveModel as RoleActiveModel, Column as RoleColumn, Entity as RoleEntity,
};

use super::definitions::{permissions_for_role, system_role_definitions, PERMISSION_DEFINITIONS};

pub struct RbacSeedService;

impl RbacSeedService {
    pub async fn ensure_permissions_seeded(state: &AppState) -> ApiResult<()> {
        for def in PERMISSION_DEFINITIONS {
            if PermissionEntity::find_by_id(def.key)
                .one(&state.db)
                .await?
                .is_some()
            {
                continue;
            }
            PermissionActiveModel {
                key: Set(def.key.to_string()),
                label: Set(def.label.to_string()),
                description: Set(None),
                module: Set(Some(def.module.to_string())),
            }
            .insert(&state.db)
            .await?;
        }
        Ok(())
    }

    pub async fn seed_tenant_roles(
        _state: &AppState,
        tenant_id: Uuid,
        txn: &sea_orm::DatabaseTransaction,
    ) -> ApiResult<Uuid> {
        let mut owner_role_id = None;

        for role_def in system_role_definitions() {
            let role = RoleActiveModel {
                id: Set(Uuid::new_v4()),
                tenant_id: Set(tenant_id),
                name: Set(role_def.name.to_string()),
                description: Set(Some(role_def.description.to_string())),
                is_system: Set(Some(true)),
                created_at: Set(chrono::Utc::now().fixed_offset()),
            }
            .insert(txn)
            .await?;

            if role_def.name == "Owner" {
                owner_role_id = Some(role.id);
            }

            for key in permissions_for_role(&role_def) {
                let exists = RolePermEntity::find()
                    .filter(RolePermColumn::RoleId.eq(role.id))
                    .filter(RolePermColumn::PermissionKey.eq(key))
                    .one(txn)
                    .await?
                    .is_some();

                if !exists {
                    RolePermActiveModel {
                        role_id: Set(role.id),
                        permission_key: Set(key.to_string()),
                    }
                    .insert(txn)
                    .await?;
                }
            }
        }

        owner_role_id.ok_or_else(|| {
            crate::common::ApiError::Internal(anyhow::anyhow!("Owner role not seeded"))
        })
    }

    /// Backfill Owner role permissions for tenants created before seeding was added.
    pub async fn ensure_owner_permissions(state: &AppState, tenant_id: Uuid) -> ApiResult<()> {
        let owner = RoleEntity::find()
            .filter(RoleColumn::TenantId.eq(tenant_id))
            .filter(RoleColumn::Name.eq("Owner"))
            .one(&state.db)
            .await?;

        let Some(owner) = owner else {
            return Ok(());
        };

        let owner_def = system_role_definitions()
            .iter()
            .find(|r| r.name == "Owner")
            .expect("Owner role definition");

        for key in permissions_for_role(&owner_def) {
            let exists = RolePermEntity::find()
                .filter(RolePermColumn::RoleId.eq(owner.id))
                .filter(RolePermColumn::PermissionKey.eq(key))
                .one(&state.db)
                .await?
                .is_some();

            if !exists {
                RolePermActiveModel {
                    role_id: Set(owner.id),
                    permission_key: Set(key.to_string()),
                }
                .insert(&state.db)
                .await?;
            }
        }

        Ok(())
    }
}
