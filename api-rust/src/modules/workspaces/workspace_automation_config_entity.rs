use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "workspace_automation_configs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub is_active: bool,
    #[sea_orm(column_type = "Text")]
    pub timezone: String,
    #[sea_orm(column_type = "Text")]
    pub generate_at: String,
    pub posts_per_cycle: i32,
    pub plan_ahead_days: i32,
    pub publishing_days: Json,
    pub posting_times: Json,
    pub platforms: Json,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::entity::Entity",
        from = "Column::WorkspaceId",
        to = "super::entity::Column::Id"
    )]
    Workspace,
}

impl Related<super::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Workspace.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
