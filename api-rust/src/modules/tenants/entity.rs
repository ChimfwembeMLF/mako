use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tenants")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(column_type = "Text")]
    pub name: String,
    #[sea_orm(column_type = "Text", unique)]
    pub slug: String,
    #[sea_orm(column_type = "Text")]
    pub logo_url: Option<String>,
    pub owner_id: Uuid,
    #[sea_orm(column_type = "JsonBinary")]
    pub theme_config: Option<Json>,
    #[sea_orm(column_type = "Decimal(Some((10, 2)))")]
    pub ads_balance: Decimal,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::super::users::entity::Entity",
        from = "Column::OwnerId",
        to = "super::super::users::entity::Column::Id"
    )]
    User,
    #[sea_orm(has_many = "super::super::workspaces::entity::Entity")]
    Workspaces,
    #[sea_orm(has_many = "super::super::tenant_members::entity::Entity")]
    TenantMembers,
}

impl Related<super::super::users::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl Related<super::super::workspaces::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Workspaces.def()
    }
}

impl Related<super::super::tenant_members::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TenantMembers.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
