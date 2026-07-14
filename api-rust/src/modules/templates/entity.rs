use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "content_templates")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
    pub user_id: Uuid,
    #[sea_orm(column_type = "Text")]
    pub name: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub description: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub content_type: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub body: Option<String>,
    #[sea_orm(column_type = "Text", nullable, array)]
    pub platforms: Option<Vec<String>>,
    pub is_active: bool,
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
}

impl Related<super::super::tenants::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tenant.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
