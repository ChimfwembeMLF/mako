use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    pub provider: String,
    pub provider_id: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub role: String,
    pub email: Option<String>,
    pub password: Option<String>,
    pub phone: Option<String>,
    pub avatar: Option<String>,
    pub is_registered_with_google: Option<bool>,
    pub is_registered_with_facebook: Option<bool>,
    pub is_registered_with_linked_in: Option<bool>,
    pub is_registered_with_instagram: Option<bool>,
    pub google_access_token_enc: Option<String>,
    pub google_refresh_token_enc: Option<String>,
    pub google_token_expires_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::super::tenants::entity::Entity")]
    Tenants,
    #[sea_orm(has_many = "super::super::tenant_members::entity::Entity")]
    TenantMembers,
}

impl Related<super::super::tenants::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tenants.def()
    }
}

impl Related<super::super::tenant_members::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TenantMembers.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
