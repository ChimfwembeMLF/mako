use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct WhatsappMenuItem {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub response: String,
    #[serde(default)]
    #[serde(rename = "aiGenerate")]
    pub ai_generate: bool,
}

pub fn normalize_menu_items(raw: &Value) -> Vec<WhatsappMenuItem> {
    let Some(items) = raw.as_array() else {
        return Vec::new();
    };

    items
        .iter()
        .enumerate()
        .filter_map(|(index, item)| {
            let row = item.as_object()?;
            let title = row.get("title").and_then(|v| v.as_str())?.trim();
            if title.is_empty() {
                return None;
            }
            let response = row
                .get("response")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let ai_generate = row
                .get("aiGenerate")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if response.is_empty() && !ai_generate {
                return None;
            }

            let id = row
                .get("id")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(|v| v.chars().take(200).collect::<String>())
                .unwrap_or_else(|| slug_id(title, index));

            let description = row
                .get("description")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(|v| v.chars().take(72).collect::<String>());

            Some(WhatsappMenuItem {
                id,
                title: title.chars().take(24).collect(),
                description,
                response: response.chars().take(4096).collect(),
                ai_generate,
            })
        })
        .take(10)
        .collect()
}

fn slug_id(title: &str, index: usize) -> String {
    let slug: String = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    let trimmed = slug.trim_matches('_');
    if trimmed.is_empty() {
        format!("option_{}", index + 1)
    } else {
        trimmed.chars().take(200).collect()
    }
}
