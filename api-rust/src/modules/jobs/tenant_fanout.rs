use std::collections::HashMap;

use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::content_publications::entity::{
    Column as PublicationColumn, Entity as PublicationEntity,
};
use crate::modules::subscriptions::service::find_eligible_for_daily_cron;

#[derive(Clone, Debug)]
pub struct TenantUserRef {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
}

pub async fn list_tenants_for_comment_sync(state: &AppState) -> ApiResult<Vec<TenantUserRef>> {
    let pubs = PublicationEntity::find()
        .filter(PublicationColumn::Status.eq("published"))
        .order_by_desc(PublicationColumn::PublishedAt)
        .all(&state.db)
        .await?;

    let mut seen = HashMap::new();
    for pub_row in pubs {
        if pub_row.external_post_id.is_none() || seen.contains_key(&pub_row.tenant_id) {
            continue;
        }
        seen.insert(pub_row.tenant_id, pub_row.user_id);
    }

    Ok(seen
        .into_iter()
        .map(|(tenant_id, user_id)| TenantUserRef { tenant_id, user_id })
        .collect())
}

pub async fn list_tenants_for_daily_workflow(state: &AppState) -> ApiResult<Vec<Uuid>> {
    find_eligible_for_daily_cron(state).await
}
