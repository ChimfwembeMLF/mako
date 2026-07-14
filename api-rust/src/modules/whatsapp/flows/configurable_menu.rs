use serde_json::json;

use crate::modules::whatsapp::flow_types::{
    FlowInboundInput, FlowOutboundMessage, FlowStepResult, FLOW_STATE_MAIN_MENU,
};
use crate::modules::whatsapp::menu::WhatsappMenuItem;
use crate::modules::whatsapp::messaging::{FlowButton, FlowListRow, FlowListSection};

pub struct ConfigurableMenuFlow;

impl ConfigurableMenuFlow {
    pub fn handle(
        state: &str,
        input: &FlowInboundInput,
        context: &serde_json::Value,
    ) -> FlowStepResult {
        let menu_items: Vec<WhatsappMenuItem> = context
            .get("menuItems")
            .map(|v| serde_json::from_value(v.clone()).unwrap_or_default())
            .unwrap_or_default();
        let welcome_message = context
            .get("welcomeMessage")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let welcome_triggers: Vec<String> = context
            .get("welcomeTriggers")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_lowercase()))
                    .collect()
            })
            .unwrap_or_default();
        let ai_fallback_enabled = input.ai_fallback_enabled;

        if menu_items.is_empty() {
            return FlowStepResult {
                next_state: FLOW_STATE_MAIN_MENU.into(),
                context: json!({ "menuItems": [], "welcomeMessage": welcome_message }),
                messages: vec![FlowOutboundMessage::Text {
                    body: "This menu is not set up yet. The business owner needs to add menu options in Lead Agent → WhatsApp → Menu bot.".into(),
                }],
                ..Default::default()
            };
        }

        let choice = normalize_choice(input);
        if choice == "menu"
            || choice == "0"
            || choice == "back"
            || choice == "main_menu"
            || welcome_triggers.contains(&choice)
        {
            return main_menu(
                &input.service_name,
                &menu_items,
                welcome_message.as_deref(),
                false,
            );
        }

        if state == FLOW_STATE_MAIN_MENU || state.is_empty() {
            if let Some(item) = resolve_menu_choice(&choice, &menu_items) {
                return show_item_response(item, &menu_items, welcome_message.as_deref());
            }
            if ai_fallback_enabled
                && !input.text.trim().is_empty()
                && !is_menu_command(&choice)
            {
                return FlowStepResult {
                    next_state: FLOW_STATE_MAIN_MENU.into(),
                    context: json!({ "menuItems": menu_items, "welcomeMessage": welcome_message }),
                    ai_free_text: Some(input.text.trim().to_string()),
                    ..Default::default()
                };
            }
            return main_menu(
                &input.service_name,
                &menu_items,
                welcome_message.as_deref(),
                true,
            );
        }

        if let Some(item) = resolve_menu_choice(&choice, &menu_items) {
            return show_item_response(item, &menu_items, welcome_message.as_deref());
        }

        if ai_fallback_enabled && !input.text.trim().is_empty() {
            return FlowStepResult {
                next_state: FLOW_STATE_MAIN_MENU.into(),
                context: json!({ "menuItems": menu_items, "welcomeMessage": welcome_message }),
                ai_free_text: Some(input.text.trim().to_string()),
                ..Default::default()
            };
        }

        main_menu(
            &input.service_name,
            &menu_items,
            welcome_message.as_deref(),
            true,
        )
    }
}

fn normalize_choice(input: &FlowInboundInput) -> String {
    if let Some(id) = input.interactive_id.as_ref().filter(|v| !v.trim().is_empty()) {
        return id.trim().to_lowercase();
    }
    input.text.trim().to_lowercase()
}

fn is_menu_command(choice: &str) -> bool {
    matches!(choice, "menu" | "0" | "back" | "main_menu")
}

fn resolve_menu_choice<'a>(
    choice: &str,
    menu_items: &'a [WhatsappMenuItem],
) -> Option<&'a WhatsappMenuItem> {
    if choice.is_empty() {
        return None;
    }
    if let Some(item) = menu_items
        .iter()
        .find(|item| item.id.to_lowercase() == choice)
    {
        return Some(item);
    }
    if let Ok(numeric) = choice.parse::<usize>() {
        if numeric >= 1 && numeric <= menu_items.len() {
            return menu_items.get(numeric - 1);
        }
    }
    menu_items
        .iter()
        .find(|item| item.title.to_lowercase() == choice)
}

fn main_menu(
    service_name: &str,
    menu_items: &[WhatsappMenuItem],
    welcome_message: Option<&str>,
    invalid_choice: bool,
) -> FlowStepResult {
    let intro = welcome_message
        .map(|w| w.replace("{serviceName}", service_name).replace("{servicename}", service_name))
        .filter(|w| !w.trim().is_empty())
        .unwrap_or_else(|| format!("Welcome to {service_name}"));

    let mut messages = Vec::new();
    if invalid_choice {
        messages.push(FlowOutboundMessage::Text {
            body: "Sorry, that option is not recognized. Please choose from the menu below.".into(),
        });
    }

    if menu_items.len() <= 3 {
        messages.push(FlowOutboundMessage::Buttons {
            body: format!("{intro}\n\nTap an option:"),
            buttons: menu_items
                .iter()
                .map(|item| FlowButton {
                    id: item.id.clone(),
                    title: item.title.chars().take(20).collect(),
                })
                .collect(),
        });
    } else {
        messages.push(FlowOutboundMessage::List {
            body: format!("{intro}\n\nChoose what you need:"),
            button_label: "View options".into(),
            sections: vec![FlowListSection {
                title: Some("Menu".into()),
                rows: menu_items
                    .iter()
                    .enumerate()
                    .map(|(index, item)| FlowListRow {
                        id: item.id.clone(),
                        title: format!("{}. {}", index + 1, item.title)
                            .chars()
                            .take(24)
                            .collect(),
                        description: item.description.clone(),
                    })
                    .collect(),
            }],
        });
    }

    messages.push(FlowOutboundMessage::Text {
        body: format!(
            "Tip: reply with a number (1–{}) like USSD, or tap the menu above.",
            menu_items.len()
        ),
    });

    FlowStepResult {
        next_state: FLOW_STATE_MAIN_MENU.into(),
        context: json!({ "menuItems": menu_items, "welcomeMessage": welcome_message }),
        messages,
        ..Default::default()
    }
}

fn show_item_response(
    item: &WhatsappMenuItem,
    menu_items: &[WhatsappMenuItem],
    welcome_message: Option<&str>,
) -> FlowStepResult {
    if item.ai_generate {
        return FlowStepResult {
            next_state: FLOW_STATE_MAIN_MENU.into(),
            context: json!({ "menuItems": menu_items, "welcomeMessage": welcome_message }),
            ai_menu_item: Some(item.clone()),
            ..Default::default()
        };
    }

    FlowStepResult {
        next_state: FLOW_STATE_MAIN_MENU.into(),
        context: json!({ "menuItems": menu_items, "welcomeMessage": welcome_message }),
        messages: vec![
            FlowOutboundMessage::Text {
                body: item.response.clone(),
            },
            FlowOutboundMessage::Buttons {
                body: "Anything else?".into(),
                buttons: vec![FlowButton {
                    id: "main_menu".into(),
                    title: "Main menu".into(),
                }],
            },
        ],
        ..Default::default()
    }
}
