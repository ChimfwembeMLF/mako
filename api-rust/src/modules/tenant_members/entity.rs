use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tenant_members")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub role_id: Uuid,
    pub is_active: bool,
    pub invited_by: Uuid,
    pub joined_at: DateTimeWithTimeZone,
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
        belongs_to = "super::super::users::entity::Entity",
        from = "Column::InvitedBy",
        to = "super::super::users::entity::Column::Id"
    )]
    Inviter,
}

impl Related<super::super::tenants::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tenant.def()
    }
}

impl Related<super::super::users::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

// Cannot implement Related twice automatically for Inviter, but queries can manually join.

impl ActiveModelBehavior for ActiveModel {}
