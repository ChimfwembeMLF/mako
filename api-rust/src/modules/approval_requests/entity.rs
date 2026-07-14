use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "approval_requests")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tenant_id: Uuid,
    #[sea_orm(column_type = "Text")]
    pub action_key: String,
    #[sea_orm(column_type = "Text")]
    pub resource_type: String,
    pub resource_id: Uuid,
    #[sea_orm(column_type = "Text", nullable)]
    pub payload: Option<String>,
    pub requested_by: Uuid,
    pub reviewed_by: Option<Uuid>,
    #[sea_orm(column_type = "Text")]
    pub status: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub requester_notes: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub reviewer_notes: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub reviewed_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
