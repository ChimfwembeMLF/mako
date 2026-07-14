use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishResult {
    pub published: bool,
    pub message: String,
    #[serde(rename = "externalPostId", skip_serializing_if = "Option::is_none")]
    pub external_post_id: Option<String>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ContentToPublish {
    pub id: Uuid,
    pub content: String,
    pub title: Option<String>,
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAttachment {
    pub id: String,
    pub media_url: String,
    pub media_type: String,
    pub alt_text: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct PlatformPayloadStored {
    pub content: Option<String>,
    pub title: Option<String>,
    pub media: Option<Vec<PlatformMediaItem>>,
    #[serde(rename = "whatsappTemplate")]
    pub whatsapp_template: Option<String>,
    #[serde(rename = "whatsappTemplateLanguage")]
    pub whatsapp_template_language: Option<String>,
    #[serde(rename = "whatsappUseTemplate")]
    pub whatsapp_use_template: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PlatformMediaItem {
    pub url: String,
    #[serde(rename = "type")]
    pub media_type: Option<String>,
    pub name: Option<String>,
}

pub const MAX_PUBLISH_ATTEMPTS: i32 = 5;
