use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "social_messages")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
    #[sea_orm(column_type = "Text")]
    pub platform: String,
    #[sea_orm(column_type = "Text")]
    pub thread_id: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub external_message_id: Option<String>,
    #[sea_orm(column_type = "Text")]
    pub participant_id: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub participant_name: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub participant_avatar_url: Option<String>,
    #[sea_orm(column_type = "Text")]
    pub direction: String,
    #[sea_orm(column_type = "Text")]
    pub body: String,
    #[sea_orm(column_type = "JsonBinary")]
    pub attachments: Json,
    #[sea_orm(column_type = "JsonBinary")]
    pub reactions: Json,
    #[sea_orm(column_type = "Text")]
    pub status: String,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::super::tenants::entity::Entity",
        from = "Column::TenantId",
        to = "super::super::tenants::entity::Column::Id"
    )]
    Tenant,
}

impl Related<super::super::tenants::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tenant.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
