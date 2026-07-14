use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "social_accounts")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
    pub user_id: Uuid,
    #[sea_orm(column_type = "Text")]
    pub platform: String,
    #[sea_orm(column_type = "Text")]
    pub account_name: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub external_id: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub username: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub access_token: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTimeWithTimeZone>,
    pub connected: bool,
    #[sea_orm(column_type = "JsonBinary", nullable)]
    pub metadata: Option<Json>,
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
