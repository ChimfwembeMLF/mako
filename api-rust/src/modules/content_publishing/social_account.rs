use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::social_accounts::entity::{
    Column as SocialColumn, Entity as SocialEntity, Model as SocialModel,
};

pub struct SocialPublishAccountService;

impl SocialPublishAccountService {
    pub async fn get_for_publish(
        state: &AppState,
        tenant_id: Uuid,
        user_id: Uuid,
        platform: &str,
        workspace_id: Option<Uuid>,
    ) -> ApiResult<Option<SocialModel>> {
        let mut query = SocialEntity::find()
            .filter(SocialColumn::TenantId.eq(tenant_id))
            .filter(SocialColumn::Platform.eq(platform))
            .filter(SocialColumn::Connected.eq(true));

        if let Some(ws) = workspace_id {
            query = query.filter(SocialColumn::WorkspaceId.eq(ws));
        }

        if let Some(account) = query
            .clone()
            .filter(SocialColumn::UserId.eq(user_id))
            .one(&state.db)
            .await?
        {
            return Ok(Some(account));
        }

        Ok(query.one(&state.db).await?)
    }

    pub fn facebook_page_token(account: &SocialModel) -> Option<String> {
        account
            .metadata
            .as_ref()
            .and_then(|m| m.get("page_token"))
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .or_else(|| account.access_token.clone())
    }

    pub fn facebook_page_id(account: &SocialModel) -> Option<String> {
        account
            .metadata
            .as_ref()
            .and_then(|m| m.get("page_id"))
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .or_else(|| account.external_id.clone())
    }

    pub fn instagram_token(account: &SocialModel) -> Option<String> {
        account
            .metadata
            .as_ref()
            .and_then(|m| m.get("page_token"))
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .or_else(|| account.access_token.clone())
    }

    pub fn instagram_business_id(account: &SocialModel) -> Option<String> {
        account.external_id.clone().or_else(|| {
            account
                .metadata
                .as_ref()
                .and_then(|m| m.get("instagram_business_account_id"))
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
    }

    pub fn linkedin_token(account: &SocialModel) -> Option<String> {
        account.access_token.clone()
    }

    pub fn linkedin_person_id(account: &SocialModel) -> Option<String> {
        account
            .metadata
            .as_ref()
            .and_then(|m| m.get("person_id").or_else(|| m.get("sub")))
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .or_else(|| account.external_id.clone())
    }

    pub fn whatsapp_phone_number_id(account: &SocialModel) -> Option<String> {
        account
            .metadata
            .as_ref()
            .and_then(|m| m.get("phone_number_id"))
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .or_else(|| account.external_id.clone())
    }

    pub fn is_platform_managed_whatsapp(account: &SocialModel) -> bool {
        account
            .metadata
            .as_ref()
            .and_then(|m| m.get("platform_managed"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    }
}
