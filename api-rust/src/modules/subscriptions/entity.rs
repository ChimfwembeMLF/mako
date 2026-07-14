use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tenant_subscriptions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub tenant_id: Uuid,
    #[sea_orm(column_type = "Text")]
    pub plan: String,
    #[sea_orm(column_type = "Text")]
    pub status: String,
    pub daily_workflow_enabled: bool,
    pub billing_period_start: DateTimeWithTimeZone,
    pub billing_period_end: DateTimeWithTimeZone,
    pub auto_renew_enabled: bool,
    #[sea_orm(column_type = "Text", nullable)]
    pub renewal_phone: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub renewal_correspondent: Option<String>,
    pub renewal_attempts: i32,
    pub last_renewal_attempt_at: Option<DateTimeWithTimeZone>,
    pub updated_at: DateTimeWithTimeZone,
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
