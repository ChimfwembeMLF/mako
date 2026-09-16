use crate::app_state::AppState;
use crate::modules::system_settings::entity::Entity as SettingEntity;
use crate::common::encryption::EncryptionService;
use sea_orm::EntityTrait;
use serde_json::Value;

pub async fn get_integration(state: &AppState, key: &str) -> Option<String> {
    let row = SettingEntity::find_by_id("platform_integrations").one(&state.db).await.ok()??;
    
    let map = row.value.as_object()?;
    let entry = map.get(key)?.as_object()?;
    
    let encrypted_data = entry.get("encryptedData")?.as_str()?;
    let iv = entry.get("iv")?.as_str()?;
    let auth_tag = entry.get("authTag")?.as_str()?;
    
    let enc_key = std::env::var("ENCRYPTION_KEY").unwrap_or_else(|_| "default-secret-key-32-chars-long".to_string());
    let encryption_service = EncryptionService::new(&enc_key);

    encryption_service.decrypt(encrypted_data, iv, auth_tag).ok()
}

pub async fn get_integration_with_env_fallback(state: &AppState, key: &str) -> Option<String> {
    if let Some(val) = get_integration(state, key).await {
        if !val.trim().is_empty() {
            return Some(val);
        }
    }
    std::env::var(key).ok()
}
