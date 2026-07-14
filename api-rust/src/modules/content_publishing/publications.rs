use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde_json::Value;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::content_publications::entity::{
    ActiveModel as PublicationActiveModel, Column as PublicationColumn, Entity as PublicationEntity,
};

pub struct PublicationsService;

impl PublicationsService {
    pub async fn find_by_content_id(
        state: &AppState,
        content_id: Uuid,
    ) -> ApiResult<Vec<crate::modules::content_publications::entity::Model>> {
        Ok(PublicationEntity::find()
            .filter(PublicationColumn::ContentId.eq(content_id))
            .order_by_desc(PublicationColumn::CreatedAt)
            .all(&state.db)
            .await?)
    }

    pub async fn record(state: &AppState, params: RecordPublicationParams) -> ApiResult<()> {
        let now = Utc::now().fixed_offset();
        let is_published = params.status == "published";
        PublicationActiveModel {
            id: Set(Uuid::new_v4()),
            tenant_id: Set(params.tenant_id),
            workspace_id: Set(params.workspace_id),
            content_id: Set(params.content_id),
            user_id: Set(params.user_id),
            platform: Set(params.platform),
            external_post_id: Set(params.external_post_id),
            published_content: Set(params.published_content),
            published_title: Set(params.published_title),
            published_media: Set(params.published_media.map(Into::into)),
            social_account_id: Set(params.social_account_id),
            status: Set(params.status),
            error_message: Set(params.error_message),
            published_at: Set(if is_published { Some(now) } else { None }),
            like_count: Set(0),
            comment_count: Set(0),
            share_count: Set(0),
            view_count: Set(0),
            engagement_score: Set(0),
            engagement_synced_at: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&state.db)
        .await?;
        Ok(())
    }
}

pub struct RecordPublicationParams {
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
    pub content_id: Uuid,
    pub user_id: Uuid,
    pub platform: String,
    pub external_post_id: Option<String>,
    pub published_content: String,
    pub published_title: Option<String>,
    pub published_media: Option<Value>,
    pub social_account_id: Option<Uuid>,
    pub status: String,
    pub error_message: Option<String>,
}
