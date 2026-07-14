use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "whatsapp_templates")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
    #[sea_orm(column_type = "Text")]
    pub name: String,
    #[sea_orm(column_type = "Text")]
    pub language: String,
    #[sea_orm(column_type = "Text")]
    pub category: String,
    #[sea_orm(column_type = "Text")]
    pub status: String,
    #[sea_orm(column_type = "JsonBinary")]
    pub components: Json,
    #[sea_orm(column_type = "JsonBinary")]
    pub variables: Json,
    #[sea_orm(column_type = "Text", nullable)]
    pub meta_template_id: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub rejection_reason: Option<String>,
    pub synced_at: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
