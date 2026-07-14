use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::brand_profiles::entity::{
    Column as BrandProfileColumn, Entity as BrandProfileEntity, Model as BrandProfileModel,
};
use crate::modules::tenants::entity::Entity as TenantEntity;

pub async fn load_brand_profile(
    state: &AppState,
    tenant_id: uuid::Uuid,
    workspace_id: Option<uuid::Uuid>,
) -> ApiResult<Option<BrandProfileModel>> {
    let tenant = TenantEntity::find_by_id(tenant_id)
        .one(&state.db)
        .await?;
    let Some(tenant) = tenant else {
        return Ok(None);
    };

    if let Some(ws) = workspace_id {
        if let Some(profile) = BrandProfileEntity::find()
            .filter(BrandProfileColumn::TenantId.eq(tenant_id))
            .filter(BrandProfileColumn::WorkspaceId.eq(ws))
            .one(&state.db)
            .await?
        {
            return Ok(Some(profile));
        }
    }

    Ok(BrandProfileEntity::find()
        .filter(BrandProfileColumn::TenantId.eq(tenant_id))
        .filter(BrandProfileColumn::UserId.eq(tenant.owner_id))
        .filter(BrandProfileColumn::WorkspaceId.is_null())
        .one(&state.db)
        .await?)
}

pub fn brand_prompt_suffix(brand: Option<&BrandProfileModel>) -> String {
    if let Some(brand) = brand {
        format!(
            "Brand context: companyName={}, toneOfVoice={}, targetAudience={}, keywords={}",
            brand.company_name.as_deref().unwrap_or(""),
            brand.tone_of_voice.as_deref().unwrap_or(""),
            brand.target_audience.as_deref().unwrap_or(""),
            brand.keywords.as_deref().unwrap_or("")
        )
    } else {
        "No brand profile yet; use neutral professional tone.".into()
    }
}

pub fn reply_system_prompt(brand: Option<&BrandProfileModel>) -> String {
    format!(
        "You write helpful, concise customer support replies. {}",
        brand_prompt_suffix(brand)
    )
}
