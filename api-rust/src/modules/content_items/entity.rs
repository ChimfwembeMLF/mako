use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

use super::timetz::Timetz;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "content_items")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Uuid,
    pub user_id: Uuid,
    pub brand_profile_id: Option<Uuid>,
    #[sea_orm(column_type = "Text")]
    pub content_type: String,
    #[sea_orm(column_type = "Text")]
    pub title: String,
    #[sea_orm(column_type = "Text")]
    pub content: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub campaign_theme: Option<String>,
    pub campaign_id: Option<Uuid>,
    #[sea_orm(column_type = "Text", nullable)]
    pub status: Option<String>,
    #[sea_orm(column_type = "Text", nullable, array)]
    pub platforms: Option<Vec<String>>,
    #[sea_orm(column_type = "JsonBinary", nullable)]
    pub platform_payloads: Option<Json>,
    pub scheduled_date: Option<Date>,
    #[sea_orm(nullable)]
    pub scheduled_time: Option<Timetz>,
    pub published_at: Option<DateTimeWithTimeZone>,
    #[sea_orm(column_type = "Text", nullable)]
    pub external_post_id: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub publish_failed_reason: Option<String>,
    pub publish_attempts: i32,
    pub deleted_at: Option<DateTimeWithTimeZone>,
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
        belongs_to = "super::super::workspaces::entity::Entity",
        from = "Column::WorkspaceId",
        to = "super::super::workspaces::entity::Column::Id"
    )]
    Workspace,
    #[sea_orm(
        belongs_to = "super::super::users::entity::Entity",
        from = "Column::UserId",
        to = "super::super::users::entity::Column::Id"
    )]
    User,
    #[sea_orm(
        belongs_to = "super::super::brand_profiles::entity::Entity",
        from = "Column::BrandProfileId",
        to = "super::super::brand_profiles::entity::Column::Id"
    )]
    BrandProfile,
}

impl ActiveModelBehavior for ActiveModel {}
