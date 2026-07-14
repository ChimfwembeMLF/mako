use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "deposits")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(column_name = "deposit_id", column_type = "Text", unique)]
    pub deposit_id: String,
    pub tenant_id: Uuid,
    #[sea_orm(column_type = "Text", nullable)]
    pub plan: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub status: Option<String>,
    #[sea_orm(column_type = "Decimal(Some((10, 2)))", nullable)]
    pub amount: Option<Decimal>,
    #[sea_orm(column_type = "Text", nullable)]
    pub currency: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub correspondent: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub msisdn: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub phone: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub provider: Option<String>,
    pub is_renewal: bool,
    #[sea_orm(column_type = "JsonBinary", nullable)]
    pub raw_payload: Option<Json>,
    pub created_at: DateTimeWithTimeZone,
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
