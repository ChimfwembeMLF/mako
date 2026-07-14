use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateRolePermissionDto {
    #[serde(rename = "roleId")]
    pub role_id: Uuid,
    #[serde(rename = "permissionKey")]
    pub permission_key: String,
}

#[derive(Deserialize, Validate)]
pub struct UpdateRolePermissionDto {
    #[serde(rename = "roleId")]
    pub role_id: Option<Uuid>,
    #[serde(rename = "permissionKey")]
    pub permission_key: Option<String>,
}
