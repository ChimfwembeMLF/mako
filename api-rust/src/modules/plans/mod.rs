pub mod constants;

use axum::{extract::State, routing::get, Json, Router};
use sea_orm::EntityTrait;
use serde_json::Value;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::plans::constants::{
    default_plans_record, merge_stored_plans, plans_list, BILLING_PLANS_SETTING_KEY,
};
use crate::modules::system_settings::entity::Entity as SettingEntity;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(list))
}

async fn list(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let record = load_plans(&state).await?;
    Ok(Json(serde_json::Value::Array(plans_list(&record))))
}

pub async fn load_plans(state: &AppState) -> ApiResult<Value> {
    let stored = SettingEntity::find_by_id(BILLING_PLANS_SETTING_KEY)
        .one(&state.db)
        .await?;

    Ok(match stored {
        Some(row) => merge_stored_plans(&row.value),
        None => default_plans_record(),
    })
}
