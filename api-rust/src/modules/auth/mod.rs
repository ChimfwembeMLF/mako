pub mod controller;
pub mod dto;
pub mod gmail;
pub mod oauth;
pub mod service;
pub mod session;

use crate::app_state::AppState;
use axum::Router;

pub fn router() -> Router<AppState> {
    controller::router()
}
