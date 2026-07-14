use chrono::{Duration, Utc};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::whatsapp::entity::flow_config::{
    ActiveModel as FlowConfigActiveModel, Column as FlowConfigColumn, Entity as FlowConfigEntity,
    Model as FlowConfigModel,
};
use crate::modules::whatsapp::entity::flow_session::{
    ActiveModel as FlowSessionActiveModel, Column as FlowSessionColumn, Entity as FlowSessionEntity,
    Model as FlowSessionModel,
};
use crate::modules::whatsapp::menu::normalize_menu_items;

const SESSION_TTL_HOURS: i64 = 24;

pub async fn get_flow_config(
    state: &AppState,
    tenant_id: Uuid,
    workspace_id: Option<Uuid>,
) -> ApiResult<FlowConfigModel> {
    let mut query = FlowConfigEntity::find().filter(FlowConfigColumn::TenantId.eq(tenant_id));
    if let Some(ws) = workspace_id {
        query = query.filter(FlowConfigColumn::WorkspaceId.eq(ws));
    }

    if let Some(config) = query.one(&state.db).await? {
        return Ok(config);
    }

    let now = Utc::now().fixed_offset();
    FlowConfigActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        workspace_id: Set(workspace_id),
        enabled: Set(false),
        service_name: Set("MyService".into()),
        flow_type: Set("configurable_menu".into()),
        menu_items: Set(json!([])),
        ai_fallback_enabled: Set(true),
        welcome_triggers: Set(vec![
            "hi".into(),
            "hello".into(),
            "menu".into(),
            "start".into(),
            "0".into(),
        ]),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await
    .map_err(Into::into)
}

pub fn flow_config_context(config: &FlowConfigModel) -> Value {
    json!({
        "menuItems": normalize_menu_items(&config.menu_items),
        "welcomeMessage": config.welcome_message,
        "welcomeTriggers": config.welcome_triggers,
    })
}

pub async fn get_session(
    state: &AppState,
    tenant_id: Uuid,
    phone: &str,
) -> ApiResult<Option<FlowSessionModel>> {
    let session = FlowSessionEntity::find()
        .filter(FlowSessionColumn::TenantId.eq(tenant_id))
        .filter(FlowSessionColumn::Phone.eq(phone))
        .one(&state.db)
        .await?;

    let Some(session) = session else {
        return Ok(None);
    };

    if let Some(expires_at) = session.expires_at {
        if expires_at < Utc::now().fixed_offset() {
            FlowSessionEntity::delete_by_id(session.id)
                .exec(&state.db)
                .await?;
            return Ok(None);
        }
    }

    Ok(Some(session))
}

pub async fn save_session(
    state: &AppState,
    tenant_id: Uuid,
    phone: &str,
    current_state: &str,
    context: Value,
) -> ApiResult<()> {
    let expires_at = Utc::now().fixed_offset() + Duration::hours(SESSION_TTL_HOURS);
    let now = Utc::now().fixed_offset();

    if let Some(existing) = FlowSessionEntity::find()
        .filter(FlowSessionColumn::TenantId.eq(tenant_id))
        .filter(FlowSessionColumn::Phone.eq(phone))
        .one(&state.db)
        .await?
    {
        let mut active: FlowSessionActiveModel = existing.into();
        active.current_state = Set(current_state.into());
        active.context = Set(context);
        active.expires_at = Set(Some(expires_at));
        active.updated_at = Set(now);
        active.update(&state.db).await?;
        return Ok(());
    }

    FlowSessionActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        phone: Set(phone.to_string()),
        current_state: Set(current_state.into()),
        context: Set(context),
        expires_at: Set(Some(expires_at)),
        created_at: Set(now),
        updated_at: Set(now),
    }
    .insert(&state.db)
    .await?;
    Ok(())
}

pub async fn clear_session(state: &AppState, tenant_id: Uuid, phone: &str) -> ApiResult<()> {
    FlowSessionEntity::delete_many()
        .filter(FlowSessionColumn::TenantId.eq(tenant_id))
        .filter(FlowSessionColumn::Phone.eq(phone))
        .exec(&state.db)
        .await?;
    Ok(())
}
