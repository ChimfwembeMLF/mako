use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::whatsapp::menu::WhatsappMenuItem;
use crate::services::ai_context::{load_brand_profile, reply_system_prompt};
use crate::services::mistral::{ChatMessage, MistralService};

pub async fn generate_menu_item_reply(
    state: &AppState,
    tenant_id: uuid::Uuid,
    workspace_id: Option<uuid::Uuid>,
    service_name: &str,
    item: &WhatsappMenuItem,
) -> ApiResult<String> {
    let brand = load_brand_profile(state, tenant_id, workspace_id).await?;
    let guidance = if !item.response.trim().is_empty() {
        item.response.trim().to_string()
    } else {
        format!("Explain \"{}\" briefly and helpfully.", item.title)
    };

    let system = format!(
        "{}\n\nYou are replying on WhatsApp for {}. Keep answers short (under 600 chars), plain text, friendly. No markdown.",
        reply_system_prompt(brand.as_ref()),
        service_name
    );
    let user = format!(
        "Menu option selected: \"{}\"{}\n\nStaff guidance / facts to include:\n{}\n\nWrite the WhatsApp reply.",
        item.title,
        item.description
            .as_ref()
            .map(|d| format!(" ({d})"))
            .unwrap_or_default(),
        guidance
    );

    let (data, _, _) = MistralService::complete_json(
        &state.config.mistral,
        vec![
            ChatMessage {
                role: "system".into(),
                content: system,
            },
            ChatMessage {
                role: "user".into(),
                content: user,
            },
        ],
        Some(MistralService::default_model(&state.config.mistral)),
    )
    .await?;

    Ok(data
        .get("content")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| guidance.chars().take(600).collect()))
}

pub async fn generate_free_text_reply(
    state: &AppState,
    tenant_id: uuid::Uuid,
    workspace_id: Option<uuid::Uuid>,
    service_name: &str,
    inbound_text: &str,
    menu_titles: &[String],
) -> ApiResult<String> {
    let brand = load_brand_profile(state, tenant_id, workspace_id).await?;
    let menu_hint = if menu_titles.is_empty() {
        "\nThey can reply \"menu\" to see options.".into()
    } else {
        format!(
            "\nAvailable menu options: {}. Mention they can reply \"menu\" to see options.",
            menu_titles.join(", ")
        )
    };

    let system = format!(
        "{}\n\nWhatsApp assistant for {}. Short, helpful, plain text.{}",
        reply_system_prompt(brand.as_ref()),
        service_name,
        menu_hint
    );

    let (data, _, _) = MistralService::complete_json(
        &state.config.mistral,
        vec![
            ChatMessage {
                role: "system".into(),
                content: system,
            },
            ChatMessage {
                role: "user".into(),
                content: format!(
                    "Customer message:\n{inbound_text}\n\nWrite a helpful WhatsApp reply."
                ),
            },
        ],
        Some(MistralService::default_model(&state.config.mistral)),
    )
    .await?;

    Ok(data
        .get("content")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| {
            "Thanks for your message. Reply *menu* to see what we can help with.".into()
        }))
}
