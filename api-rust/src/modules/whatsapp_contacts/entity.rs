use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "whatsapp_contacts")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
    #[sea_orm(column_type = "Text")]
    pub phone: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub name: Option<String>,
    pub opted_in: bool,
    pub opted_in_at: Option<DateTimeWithTimeZone>,
    #[sea_orm(column_type = "Text", nullable, array)]
    pub tags: Option<Vec<String>>,
    pub lead_id: Option<Uuid>,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
