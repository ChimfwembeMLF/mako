use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

pub mod notifications {
    use super::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "notifications")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub tenant_id: Uuid,
        pub user_id: Uuid,
        #[sea_orm(column_name = "type", column_type = "Text")]
        pub notification_type: String,
        #[sea_orm(column_type = "Text")]
        pub title: String,
        #[sea_orm(column_type = "Text")]
        pub body: String,
        #[sea_orm(column_type = "Text", nullable)]
        pub link: Option<String>,
        #[sea_orm(column_name = "read")]
        pub is_read: bool,
        pub email_sent: bool,
        #[sea_orm(column_type = "JsonBinary", nullable)]
        pub metadata: Option<Json>,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod notification_preferences {
    use super::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "notification_preferences")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub user_id: Uuid,
        #[sea_orm(primary_key, auto_increment = false)]
        pub tenant_id: Uuid,
        pub email_publish_success: bool,
        pub email_billing: bool,
        pub email_weekly_digest: bool,
        pub email_hot_leads: bool,
        pub in_app_enabled: bool,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}
