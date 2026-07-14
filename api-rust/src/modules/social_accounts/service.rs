use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::social_accounts::dto::ConnectSocialAccountDto;
use crate::modules::social_accounts::entity::{
    ActiveModel as SocialAccountActiveModel, Column as SocialAccountColumn,
    Entity as SocialAccountEntity, Model as SocialAccountModel,
};
use crate::modules::social_accounts::oauth::{
    self, OAuthConnectResult, WhatsappSetupFromMetaResult,
};
use crate::modules::tenant_members::entity::{Column as MemberColumn, Entity as MemberEntity};

pub struct SocialAccountsService;

impl SocialAccountsService {
    pub fn to_public_json(account: &SocialAccountModel) -> Value {
        json!({
            "id": account.id,
            "tenantId": account.tenant_id,
            "workspaceId": account.workspace_id,
            "userId": account.user_id,
            "platform": account.platform,
            "accountName": account.account_name,
            "externalId": account.external_id,
            "username": account.username,
            "expiresAt": account.expires_at,
            "connected": account.connected,
            "metadata": account.metadata,
            "created_at": account.created_at,
            "updated_at": account.updated_at,
            "deleted_at": account.deleted_at,
        })
    }

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

    fn scope_filters(tenant_id: Uuid, workspace_id: Option<Uuid>) -> sea_orm::Condition {
        use sea_orm::Condition;
        let mut condition = Condition::all().add(SocialAccountColumn::TenantId.eq(tenant_id));
        match workspace_id {
            Some(ws) => condition = condition.add(SocialAccountColumn::WorkspaceId.eq(ws)),
            None => condition = condition.add(SocialAccountColumn::WorkspaceId.is_null()),
        }
        condition
    }

    pub async fn connect_account(
        state: &AppState,
        mut dto: ConnectSocialAccountDto,
    ) -> ApiResult<Value> {
        let user_id = dto
            .user_id
            .ok_or_else(|| ApiError::Unauthorized("UserId is required".into()))?;

        if dto.tenant_id.is_nil() {
            return Err(ApiError::Forbidden("tenantId is required".into()));
        }

        Self::assert_tenant_access(state, user_id, dto.tenant_id).await?;
        dto.user_id = Some(user_id);

        let scope = Self::scope_filters(dto.tenant_id, dto.workspace_id);
        let mut finder = SocialAccountEntity::find()
            .filter(scope)
            .filter(SocialAccountColumn::Platform.eq(dto.platform.clone()));

        if let Some(ref external_id) = dto.external_id {
            finder = finder.filter(SocialAccountColumn::ExternalId.eq(external_id.clone()));
        } else {
            finder = finder.filter(SocialAccountColumn::ExternalId.is_null());
        }

        let existing = finder.one(&state.db).await?;
        let now = Utc::now().fixed_offset();

        let saved = if let Some(existing) = existing {
            let mut active: SocialAccountActiveModel = existing.into();
            active.workspace_id = Set(dto.workspace_id);
            active.user_id = Set(user_id);
            active.account_name = Set(dto.account_name);
            active.external_id = Set(dto.external_id);
            active.username = Set(dto.username);
            active.access_token = Set(Some(dto.access_token));
            active.refresh_token = Set(dto.refresh_token);
            active.expires_at = Set(dto.expires_at);
            active.connected = Set(true);
            active.metadata = Set(dto.metadata.map(|m| m.into()));
            active.updated_at = Set(now);
            active.update(&state.db).await?
        } else {
            SocialAccountActiveModel {
                id: Set(Uuid::new_v4()),
                tenant_id: Set(dto.tenant_id),
                workspace_id: Set(dto.workspace_id),
                user_id: Set(user_id),
                platform: Set(dto.platform),
                account_name: Set(dto.account_name),
                external_id: Set(dto.external_id),
                username: Set(dto.username),
                access_token: Set(Some(dto.access_token)),
                refresh_token: Set(dto.refresh_token),
                expires_at: Set(dto.expires_at),
                connected: Set(dto.connected.unwrap_or(true)),
                metadata: Set(dto.metadata.map(|m| m.into())),
                deleted_at: Set(None),
                created_at: Set(now),
                updated_at: Set(now),
            }
            .insert(&state.db)
            .await?
        };

        Ok(Self::to_public_json(&saved))
    }

    pub async fn connect_from_oauth_result(
        state: &AppState,
        tenant_id: Uuid,
        workspace_id: Option<Uuid>,
        user_id: Uuid,
        result: OAuthConnectResult,
    ) -> ApiResult<Value> {
        Self::connect_account(
            state,
            ConnectSocialAccountDto {
                tenant_id,
                workspace_id,
                user_id: Some(user_id),
                platform: result.platform,
                account_name: result.account_name,
                external_id: result.external_id,
                username: result.username,
                access_token: result.access_token,
                refresh_token: result.refresh_token,
                expires_at: result.expires_at,
                connected: Some(true),
                metadata: result.metadata,
            },
        )
        .await
    }

    pub async fn find_by_tenant(
        state: &AppState,
        tenant_id: Uuid,
        user_id: Uuid,
        workspace_id: Option<Uuid>,
    ) -> ApiResult<Vec<Value>> {
        Self::assert_tenant_access(state, user_id, tenant_id).await?;

        let accounts = SocialAccountEntity::find()
            .filter(Self::scope_filters(tenant_id, workspace_id))
            .filter(SocialAccountColumn::Connected.eq(true))
            .order_by_desc(SocialAccountColumn::CreatedAt)
            .all(&state.db)
            .await?;

        Ok(accounts
            .iter()
            .map(Self::to_public_json)
            .collect::<Vec<_>>())
    }

    pub async fn find_by_user(state: &AppState, user_id: Uuid) -> ApiResult<Vec<Value>> {
        let accounts = SocialAccountEntity::find()
            .filter(SocialAccountColumn::UserId.eq(user_id))
            .all(&state.db)
            .await?;

        Ok(accounts
            .iter()
            .map(Self::to_public_json)
            .collect::<Vec<_>>())
    }

    async fn find_one_for_user(
        state: &AppState,
        id: Uuid,
        user_id: Uuid,
    ) -> ApiResult<SocialAccountModel> {
        SocialAccountEntity::find_by_id(id)
            .filter(SocialAccountColumn::UserId.eq(user_id))
            .one(&state.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("Not found".into()))
    }

    async fn find_one_for_tenant(
        state: &AppState,
        id: Uuid,
        tenant_id: Uuid,
        user_id: Uuid,
    ) -> ApiResult<SocialAccountModel> {
        Self::assert_tenant_access(state, user_id, tenant_id).await?;

        SocialAccountEntity::find_by_id(id)
            .filter(SocialAccountColumn::TenantId.eq(tenant_id))
            .one(&state.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("Not found".into()))
    }

    pub async fn disconnect(
        state: &AppState,
        id: Uuid,
        user_id: Uuid,
        tenant_id: Option<Uuid>,
    ) -> ApiResult<Value> {
        let account = if let Some(tenant_id) = tenant_id {
            Self::find_one_for_tenant(state, id, tenant_id, user_id).await?
        } else {
            Self::find_one_for_user(state, id, user_id).await?
        };

        let mut active: SocialAccountActiveModel = account.into();
        active.connected = Set(false);
        active.access_token = Set(Some(String::new()));
        active.refresh_token = Set(None);
        active.expires_at = Set(None);
        active.updated_at = Set(Utc::now().fixed_offset());

        if let sea_orm::Set(Some(ref mut meta)) = active.metadata {
            if let Some(obj) = meta.as_object_mut() {
                obj.remove("page_token");
                obj.remove("page_id");
                obj.remove("page_name");
            }
        }

        let saved = active.update(&state.db).await?;
        Ok(Self::to_public_json(&saved))
    }

    pub async fn remove(
        state: &AppState,
        id: Uuid,
        user_id: Uuid,
        tenant_id: Option<Uuid>,
    ) -> ApiResult<()> {
        if let Some(tenant_id) = tenant_id {
            Self::find_one_for_tenant(state, id, tenant_id, user_id).await?;
        } else {
            Self::find_one_for_user(state, id, user_id).await?;
        }

        let result = SocialAccountEntity::delete_by_id(id)
            .exec(&state.db)
            .await?;
        if result.rows_affected == 0 {
            return Err(ApiError::NotFound("Not found".into()));
        }
        Ok(())
    }

    pub async fn prepare_whatsapp_from_existing_meta(
        state: &AppState,
        tenant_id: Uuid,
        user_id: Uuid,
        workspace_id: Option<Uuid>,
    ) -> ApiResult<WhatsappSetupFromMetaResult> {
        Self::assert_tenant_access(state, user_id, tenant_id).await?;

        let facebook = SocialAccountEntity::find()
            .filter(SocialAccountColumn::TenantId.eq(tenant_id))
            .filter(SocialAccountColumn::Platform.eq("facebook"))
            .filter(SocialAccountColumn::Connected.eq(true))
            .order_by_desc(SocialAccountColumn::UpdatedAt)
            .one(&state.db)
            .await?;

        let Some(facebook) = facebook else {
            return Ok(WhatsappSetupFromMetaResult::NeedOAuth {
                ready: false,
                need_oauth: true,
                reason: "no_facebook".into(),
            });
        };

        let access_token = facebook
            .access_token
            .as_deref()
            .map(str::trim)
            .filter(|t| !t.is_empty());

        let Some(access_token) = access_token else {
            return Ok(WhatsappSetupFromMetaResult::NeedOAuth {
                ready: false,
                need_oauth: true,
                reason: "no_facebook".into(),
            });
        };

        if !oauth::meta_token_has_whatsapp_permissions(state, access_token).await? {
            return Ok(WhatsappSetupFromMetaResult::NeedOAuth {
                ready: false,
                need_oauth: true,
                reason: "missing_scopes".into(),
            });
        }

        let phones = oauth::discover_whatsapp_phones(state, access_token).await?;
        if phones.is_empty() {
            return Ok(WhatsappSetupFromMetaResult::NeedOAuth {
                ready: false,
                need_oauth: true,
                reason: "no_phones".into(),
            });
        }

        let setup_token = oauth::create_whatsapp_setup_token(
            state,
            oauth::WhatsAppSetupPayload {
                token_type: String::new(),
                user_id,
                tenant_id,
                workspace_id,
                access_token: access_token.to_string(),
                expires_at: facebook.expires_at.map(|d| d.to_rfc3339()),
                phones: phones.clone(),
                exp: 0,
            },
        )?;

        Ok(WhatsappSetupFromMetaResult::Ready {
            ready: true,
            setup_token,
            phones,
            source: "facebook".into(),
        })
    }
}
