pub mod chunk {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "knowledge_chunks")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub tenant_id: Uuid,
        pub document_id: Uuid,
        pub chunk_index: i32,
        #[sea_orm(column_type = "Text")]
        pub content: String,
        pub token_count: Option<i32>,
        #[sea_orm(column_type = "Text", nullable)]
        pub embedding: Option<String>,
        #[sea_orm(column_type = "JsonBinary", nullable)]
        pub metadata: Option<Json>,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod document {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "knowledge_documents")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub tenant_id: Uuid,
        pub workspace_id: Option<Uuid>,
        pub uploaded_by: Uuid,
        #[sea_orm(column_type = "Text")]
        pub title: String,
        #[sea_orm(column_type = "Text")]
        pub source_type: String,
        #[sea_orm(column_type = "Text", nullable)]
        pub mime_type: Option<String>,
        #[sea_orm(column_type = "Text", nullable)]
        pub storage_url: Option<String>,
        pub file_size_bytes: Option<i64>,
        #[sea_orm(column_type = "Text")]
        pub status: String,
        #[sea_orm(column_type = "Text", nullable)]
        pub error_message: Option<String>,
        pub chunk_count: i32,
        #[sea_orm(column_type = "JsonBinary", nullable)]
        pub metadata: Option<Json>,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}
