use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

pub mod campaign {
    use super::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "ad_campaigns")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub tenant_id: Uuid,
        #[sea_orm(column_type = "Text")]
        pub platform: String,
        #[sea_orm(column_type = "Text", nullable)]
        pub platform_campaign_id: Option<String>,
        #[sea_orm(column_type = "Text")]
        pub name: String,
        #[sea_orm(column_type = "Text")]
        pub status: String,
        #[sea_orm(column_type = "Decimal(Some((10, 2)))")]
        pub daily_budget: Decimal,
        #[sea_orm(column_type = "Text", nullable)]
        pub target_audience: Option<String>,
        #[sea_orm(column_type = "Text", nullable)]
        pub target_url: Option<String>,
        #[sea_orm(column_type = "Text", nullable)]
        pub location: Option<String>,
        pub start_date: Option<Date>,
        pub end_date: Option<Date>,
        #[sea_orm(column_type = "Text", nullable)]
        pub age_range: Option<String>,
        pub native_impressions: i32,
        pub native_clicks: i32,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {
        #[sea_orm(
            belongs_to = "super::super::super::tenants::entity::Entity",
            from = "Column::TenantId",
            to = "super::super::super::tenants::entity::Column::Id"
        )]
        Tenant,
        #[sea_orm(has_many = "super::creative::Entity")]
        Creatives,
    }

    impl Related<super::super::super::tenants::entity::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::Tenant.def()
        }
    }

    impl Related<super::creative::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::Creatives.def()
        }
    }

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod creative {
    use super::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "ad_creatives")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub campaign_id: Uuid,
        #[sea_orm(column_type = "Text")]
        pub headline: String,
        #[sea_orm(column_type = "Text")]
        pub body: String,
        #[sea_orm(column_type = "Text", nullable)]
        pub media_url: Option<String>,
        pub is_published: bool,
        #[sea_orm(column_type = "Text", nullable)]
        pub platform_ad_id: Option<String>,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {
        #[sea_orm(
            belongs_to = "super::campaign::Entity",
            from = "Column::CampaignId",
            to = "super::campaign::Column::Id"
        )]
        Campaign,
    }

    impl Related<super::campaign::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::Campaign.def()
        }
    }

    impl ActiveModelBehavior for ActiveModel {}
}

pub use campaign::{
    ActiveModel as CampaignActiveModel, Column as CampaignColumn, Entity as CampaignEntity,
    Model as CampaignModel,
};
pub use creative::{
    ActiveModel as CreativeActiveModel, Column as CreativeColumn, Entity as CreativeEntity,
    Model as CreativeModel,
};
