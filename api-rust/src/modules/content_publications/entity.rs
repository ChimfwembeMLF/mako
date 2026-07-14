use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "content_publications")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
    pub content_id: Uuid,
    pub user_id: Uuid,
    #[sea_orm(column_type = "Text")]
    pub platform: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub external_post_id: Option<String>,
    #[sea_orm(column_type = "Text")]
    pub published_content: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub published_title: Option<String>,
    #[sea_orm(column_type = "JsonBinary", nullable)]
    pub published_media: Option<Json>,
    pub social_account_id: Option<Uuid>,
    #[sea_orm(column_type = "Text")]
    pub status: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub error_message: Option<String>,
    pub published_at: Option<DateTimeWithTimeZone>,
    pub like_count: i32,
    pub comment_count: i32,
    pub share_count: i32,
    pub view_count: i32,
    pub engagement_score: i32,
    pub engagement_synced_at: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::super::tenants::entity::Entity",
        from = "Column::TenantId",
        to = "super::super::tenants::entity::Column::Id"
    )]
    Tenant,
    #[sea_orm(
        belongs_to = "super::super::content_items::entity::Entity",
        from = "Column::ContentId",
        to = "super::super::content_items::entity::Column::Id"
    )]
    ContentItem,
}

impl ActiveModelBehavior for ActiveModel {}
