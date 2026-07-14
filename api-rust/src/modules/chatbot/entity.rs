pub mod config {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "chatbot_configs")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub tenant_id: Uuid,
        pub workspace_id: Option<Uuid>,
        pub brand_profile_id: Option<Uuid>,
        #[sea_orm(column_type = "Text")]
        pub name: String,
        #[sea_orm(column_type = "Text", nullable)]
        pub welcome_message: Option<String>,
        #[sea_orm(column_type = "Text", nullable)]
        pub system_prompt_extra: Option<String>,
        #[sea_orm(column_type = "Text")]
        pub model: String,
        pub temperature: f32,
        pub max_context_messages: i32,
        pub rag_enabled: bool,
        pub rag_top_k: i32,
        pub rag_min_score: f32,
        pub widget_enabled: bool,
        #[sea_orm(column_type = "JsonBinary", nullable)]
        pub widget_theme: Option<Json>,
        #[sea_orm(column_type = "Text", nullable, array)]
        pub allowed_origins: Option<Vec<String>>,
        pub is_active: bool,
        pub use_mistral_library: bool,
        #[sea_orm(column_type = "Text", nullable)]
        pub mistral_library_id: Option<String>,
        #[sea_orm(column_type = "Text", nullable)]
        pub mistral_agent_id: Option<String>,
        pub widget_tts_enabled: bool,
        #[sea_orm(column_type = "Text", nullable)]
        pub mistral_voice_id: Option<String>,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod api_key {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "chatbot_api_keys")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub tenant_id: Uuid,
        pub config_id: Uuid,
        #[sea_orm(column_type = "Text")]
        pub key_prefix: String,
        #[sea_orm(column_type = "Text")]
        pub key_hash: String,
        #[sea_orm(column_type = "Text", nullable)]
        pub label: Option<String>,
        pub last_used_at: Option<DateTimeWithTimeZone>,
        pub revoked_at: Option<DateTimeWithTimeZone>,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod tts_voice {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "chatbot_tts_voices")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub tenant_id: Uuid,
        #[sea_orm(column_type = "Text")]
        pub mistral_voice_id: String,
        #[sea_orm(column_type = "Text")]
        pub name: String,
        pub created_by: Option<Uuid>,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod session {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "chat_sessions")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub tenant_id: Uuid,
        pub workspace_id: Option<Uuid>,
        pub config_id: Uuid,
        #[sea_orm(column_type = "Text")]
        pub channel: String,
        #[sea_orm(column_type = "Text", nullable)]
        pub visitor_id: Option<String>,
        pub user_id: Option<Uuid>,
        #[sea_orm(column_type = "Text", nullable)]
        pub title: Option<String>,
        #[sea_orm(column_type = "JsonBinary", nullable)]
        pub metadata: Option<Json>,
        pub last_message_at: Option<DateTimeWithTimeZone>,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod message {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "chat_messages")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub tenant_id: Uuid,
        pub session_id: Uuid,
        #[sea_orm(column_type = "Text")]
        pub role: String,
        #[sea_orm(column_type = "Text")]
        pub content: String,
        #[sea_orm(column_type = "JsonBinary", nullable)]
        pub citations: Option<Json>,
        pub tokens_used: Option<i32>,
        #[sea_orm(column_type = "Text", nullable)]
        pub model: Option<String>,
        pub latency_ms: Option<i32>,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}
