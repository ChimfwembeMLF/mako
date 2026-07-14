use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "brand_profiles")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub workspace_id: Option<Uuid>,
    #[sea_orm(column_type = "Text")]
    pub brand_type: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub company_name: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub industry: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub description: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub services: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub target_audience: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub audience_pain_points: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub tone_of_voice: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub brand_personality: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub current_offers: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub unique_selling_points: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub faqs: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub case_studies: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub banned_words: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub banned_topics: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub competitors: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub keywords: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub website_url: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    pub deleted_at: Option<DateTimeWithTimeZone>,
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
        belongs_to = "super::super::users::entity::Entity",
        from = "Column::UserId",
        to = "super::super::users::entity::Column::Id"
    )]
    User,
    #[sea_orm(
        belongs_to = "super::super::workspaces::entity::Entity",
        from = "Column::WorkspaceId",
        to = "super::super::workspaces::entity::Column::Id"
    )]
    Workspace,
}

impl Related<super::super::tenants::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tenant.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
