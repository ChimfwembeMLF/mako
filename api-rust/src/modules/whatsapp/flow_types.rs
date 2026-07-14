use serde_json::Value;
use uuid::Uuid;

use super::menu::WhatsappMenuItem;
use super::messaging::{FlowButton, FlowListSection};

pub const FLOW_STATE_MAIN_MENU: &str = "MAIN_MENU";

#[derive(Clone, Debug)]
pub struct FlowInboundInput {
    pub tenant_id: Uuid,
    pub phone: String,
    pub text: String,
    pub interactive_id: Option<String>,
    pub service_name: String,
    pub ai_fallback_enabled: bool,
}

#[derive(Clone, Debug)]
pub enum FlowOutboundMessage {
    Text { body: String },
    Buttons {
        body: String,
        buttons: Vec<FlowButton>,
    },
    List {
        body: String,
        button_label: String,
        sections: Vec<FlowListSection>,
    },
}

#[derive(Clone, Debug)]
pub struct FlowStepResult {
    pub next_state: String,
    pub context: Value,
    pub messages: Vec<FlowOutboundMessage>,
    pub end_session: bool,
    pub ai_menu_item: Option<WhatsappMenuItem>,
    pub ai_free_text: Option<String>,
}

impl Default for FlowStepResult {
    fn default() -> Self {
        Self {
            next_state: FLOW_STATE_MAIN_MENU.into(),
            context: Value::Null,
            messages: Vec::new(),
            end_session: false,
            ai_menu_item: None,
            ai_free_text: None,
        }
    }
}
