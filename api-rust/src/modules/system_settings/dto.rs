use serde::Deserialize;
use serde_json::Value;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct UpsertSettingDto {
    pub value: Value,
    pub description: Option<String>,
}
