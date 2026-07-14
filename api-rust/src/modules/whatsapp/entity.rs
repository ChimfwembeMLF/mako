pub mod flow_config {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "whatsapp_flow_configs")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub tenant_id: Uuid,
        pub workspace_id: Option<Uuid>,
        pub enabled: bool,
        #[sea_orm(column_type = "Text")]
        pub service_name: String,
        #[sea_orm(column_type = "Text", nullable)]
        pub welcome_message: Option<String>,
        #[sea_orm(column_type = "Text")]
        pub flow_type: String,
        #[sea_orm(column_type = "JsonBinary")]
        pub menu_items: Json,
        pub ai_fallback_enabled: bool,
        #[sea_orm(column_type = "Text", array)]
        pub welcome_triggers: Vec<String>,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod flow_session {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "whatsapp_flow_sessions")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub tenant_id: Uuid,
        #[sea_orm(column_type = "Text")]
        pub phone: String,
        #[sea_orm(column_type = "Text")]
        pub current_state: String,
        #[sea_orm(column_type = "JsonBinary")]
        pub context: Json,
        pub expires_at: Option<DateTimeWithTimeZone>,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod message {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "whatsapp_messages")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub tenant_id: Uuid,
        pub workspace_id: Option<Uuid>,
        pub contact_id: Option<Uuid>,
        pub lead_id: Option<Uuid>,
        #[sea_orm(column_type = "Text", nullable)]
        pub wa_message_id: Option<String>,
        #[sea_orm(column_type = "Text")]
        pub phone: String,
        #[sea_orm(column_type = "Text")]
        pub direction: String,
        #[sea_orm(column_type = "Text")]
        pub body: String,
        #[sea_orm(column_type = "Text")]
        pub status: String,
        #[sea_orm(column_type = "Text", nullable)]
        pub error_message: Option<String>,
        #[sea_orm(column_type = "JsonBinary")]
        pub attachments: Json,
        #[sea_orm(column_type = "JsonBinary")]
        pub reactions: Json,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}
