use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::brand_profiles::entity::{
    ActiveModel as BrandProfileActiveModel, Column as BrandProfileColumn,
    Entity as BrandProfileEntity,
};
use crate::modules::users::entity::Model as UserModel;
use crate::modules::workspaces::entity::{Column as WorkspaceColumn, Entity as WorkspaceEntity};

pub struct BrandProfileSeedService;

impl BrandProfileSeedService {
    /// Create an empty brand profile shell when a workspace is created (Nest parity).
    pub async fn ensure_for_workspace(
        state: &AppState,
        tenant_id: Uuid,
        workspace_id: Uuid,
        user_id: Uuid,
    ) -> ApiResult<()> {
        if BrandProfileEntity::find()
            .filter(BrandProfileColumn::WorkspaceId.eq(workspace_id))
            .filter(BrandProfileColumn::TenantId.eq(tenant_id))
            .one(&state.db)
            .await?
            .is_some()
        {
            return Ok(());
        }

        let workspace = WorkspaceEntity::find_by_id(workspace_id)
            .filter(WorkspaceColumn::TenantId.eq(tenant_id))
            .one(&state.db)
            .await?;

        let Some(workspace) = workspace else {
            return Ok(());
        };

        let now = Utc::now().fixed_offset();
        BrandProfileActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(tenant_id),
            user_id: Set(user_id),
            workspace_id: Set(Some(workspace_id)),
            brand_type: Set("business".to_string()),
            company_name: Set(Some(workspace.name.clone())),
            tone_of_voice: Set(Some("Professional, clear, and friendly".to_string())),
            brand_personality: Set(Some("Helpful and trustworthy".to_string())),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&state.db)
        .await?;

        Ok(())
    }

    /// Minimal brand profile on the default workspace for new tenants.
    pub async fn ensure_starter_for_user(
        state: &AppState,
        tenant_id: Uuid,
        user: &UserModel,
    ) -> ApiResult<()> {
        let default_workspace = WorkspaceEntity::find()
            .filter(WorkspaceColumn::TenantId.eq(tenant_id))
            .all(&state.db)
            .await?
            .into_iter()
            .min_by_key(|w| w.created_at);

        if let Some(ref workspace) = default_workspace {
            if BrandProfileEntity::find()
                .filter(BrandProfileColumn::WorkspaceId.eq(workspace.id))
                .filter(BrandProfileColumn::TenantId.eq(tenant_id))
                .one(&state.db)
                .await?
                .is_some()
            {
                return Ok(());
            }

            if let Some(legacy) = BrandProfileEntity::find()
                .filter(BrandProfileColumn::TenantId.eq(tenant_id))
                .filter(BrandProfileColumn::UserId.eq(user.id))
                .filter(BrandProfileColumn::WorkspaceId.is_null())
                .one(&state.db)
                .await?
            {
                let mut active: BrandProfileActiveModel = legacy.into();
                active.workspace_id = Set(Some(workspace.id));
                active.update(&state.db).await?;
                return Ok(());
            }
        }

        if BrandProfileEntity::find()
            .filter(BrandProfileColumn::TenantId.eq(tenant_id))
            .filter(BrandProfileColumn::UserId.eq(user.id))
            .filter(BrandProfileColumn::WorkspaceId.is_null())
            .one(&state.db)
            .await?
            .is_some()
        {
            return Ok(());
        }

        let company_name = user
            .first_name
            .as_deref()
            .or(user.email.as_deref().and_then(|e| e.split('@').next()))
            .map(str::trim)
            .filter(|s| !s.is_empty());

        let Some(company_name) = company_name else {
            return Ok(());
        };

        let now = Utc::now().fixed_offset();
        BrandProfileActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(tenant_id),
            user_id: Set(user.id),
            workspace_id: Set(default_workspace.as_ref().map(|w| w.id)),
            brand_type: Set("business".to_string()),
            company_name: Set(Some(
                default_workspace
                    .map(|w| w.name)
                    .unwrap_or_else(|| company_name.to_string()),
            )),
            tone_of_voice: Set(Some("Professional, clear, and friendly".to_string())),
            brand_personality: Set(Some("Helpful and trustworthy".to_string())),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&state.db)
        .await?;

        Ok(())
    }
}
