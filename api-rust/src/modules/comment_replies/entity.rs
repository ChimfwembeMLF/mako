use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "comment_replies")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub content_id: Uuid,
    #[sea_orm(column_type = "Text")]
    pub platform: String,
    #[sea_orm(column_type = "Text")]
    pub external_comment_id: String,
    #[sea_orm(column_type = "Text")]
    pub external_post_id: String,
    #[sea_orm(column_type = "Text")]
    pub commenter_name: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub commenter_avatar_url: Option<String>,
    #[sea_orm(column_type = "Text")]
    pub comment_text: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub reply_text: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub reply_type: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub status: Option<String>,
    pub rule_id: Option<Uuid>,
    pub sent_at: Option<DateTimeWithTimeZone>,
    #[sea_orm(column_type = "Text", nullable)]
    pub parent_comment_id: Option<String>,
    pub like_count: i32,
    pub is_from_brand: bool,
    #[sea_orm(column_type = "JsonBinary")]
    pub attachments: Json,
    #[sea_orm(column_type = "JsonBinary")]
    pub reactions: Json,
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
