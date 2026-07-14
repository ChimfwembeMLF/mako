use serde::Deserialize;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreatePermissionDto {
    pub key: String,
    pub label: String,
    pub description: Option<String>,
    pub module: Option<String>,
}

#[derive(Deserialize, Validate)]
pub struct UpdatePermissionDto {
    pub label: Option<String>,
    pub description: Option<String>,
    pub module: Option<String>,
}
