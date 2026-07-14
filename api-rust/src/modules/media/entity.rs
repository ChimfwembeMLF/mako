use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "media_assets")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
    pub content_id: Option<Uuid>,
    #[sea_orm(column_type = "Text")]
    pub media_url: String,
    #[sea_orm(column_type = "Text")]
    pub media_type: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub name: Option<String>,
    #[sea_orm(column_type = "Text", nullable, array)]
    pub tags: Option<Vec<String>>,
    pub uploaded_by: Option<Uuid>,
    pub file_size_bytes: Option<i64>,
    pub width_px: Option<i32>,
    pub height_px: Option<i32>,
    #[sea_orm(column_type = "Text", nullable)]
    pub alt_text: Option<String>,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::super::tenants::entity::Entity",
        from = "Column::TenantId",
        to = "super::super::tenants::entity::Column::Id"
    )]
    Tenant,
    #[sea_orm(
        belongs_to = "super::super::content_items::entity::Entity",
        from = "Column::ContentId",
        to = "super::super::content_items::entity::Column::Id"
    )]
    ContentItem,
    #[sea_orm(
        belongs_to = "super::super::users::entity::Entity",
        from = "Column::UploadedBy",
        to = "super::super::users::entity::Column::Id"
    )]
    Uploader,
}

impl Related<super::super::tenants::entity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tenant.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
