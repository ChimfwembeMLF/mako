use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::leads::entity::{
    ActiveModel as LeadActiveModel, Column as LeadColumn, Entity as LeadEntity, Model as LeadModel,
};
use crate::modules::tenants::entity::Entity as TenantEntity;
use crate::modules::whatsapp::entity::message::{
    ActiveModel as MessageActiveModel, Entity as MessageEntity,
};
use crate::modules::whatsapp_contacts::entity::{
    ActiveModel as ContactActiveModel, Model as ContactModel,
};
use crate::services::mistral::{ChatMessage, MistralService};

pub struct CaptureInboundParams {
    pub tenant_id: Uuid,
    pub contact: ContactModel,
    pub message: String,
    pub message_row_id: Uuid,
}

pub async fn capture_inbound(
    state: &AppState,
    params: CaptureInboundParams,
) -> ApiResult<Option<Uuid>> {
    let tenant = TenantEntity::find_by_id(params.tenant_id)
        .one(&state.db)
        .await?;
    let Some(tenant) = tenant else {
        return Ok(params.contact.lead_id);
    };

    let lead = upsert_from_whatsapp(
        state,
        params.tenant_id,
        tenant.owner_id,
        &params.contact.phone,
        params.contact.name.as_deref(),
        &params.message,
    )
    .await?;

    let mut contact = params.contact;
    if contact.lead_id != Some(lead.id) {
        let mut active: ContactActiveModel = contact.clone().into();
        active.lead_id = Set(Some(lead.id));
        contact = active.update(&state.db).await?;
    }

    let mut message_active: MessageActiveModel = MessageEntity::find_by_id(params.message_row_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| crate::common::ApiError::NotFound("Message not found".into()))?
        .into();
    message_active.lead_id = Set(Some(lead.id));
    message_active.update(&state.db).await?;

    let state_clone = state.clone();
    let lead_id = lead.id;
    let owner_id = tenant.owner_id;
    let classify_tenant_id = params.tenant_id;
    let classify_name = contact
        .name
        .clone()
        .unwrap_or_else(|| format!("WhatsApp {}", contact.phone));
    let classify_email = whatsapp_email(&contact.phone);
    let classify_message = params.message.clone();
    tokio::spawn(async move {
        if let Err(err) = classify_lead_async(
            &state_clone,
            classify_tenant_id,
            owner_id,
            lead_id,
            classify_name,
            classify_email,
            classify_message,
        )
        .await
        {
            tracing::warn!(error = %err, "Lead classify skipped");
        }
    });

    Ok(Some(lead.id))
}

async fn upsert_from_whatsapp(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    phone: &str,
    name: Option<&str>,
    message: &str,
) -> ApiResult<LeadModel> {
    let email = whatsapp_email(phone);
    if let Some(existing) = LeadEntity::find()
        .filter(LeadColumn::TenantId.eq(tenant_id))
        .filter(LeadColumn::Email.eq(&email))
        .one(&state.db)
        .await?
    {
        let mut active: crate::modules::leads::entity::ActiveModel = existing.clone().into();
        active.message = Set(Some(message.to_string()));
        if existing.status.as_deref() == Some("closed") {
            active.status = Set(Some("open".into()));
        }
        if let Some(name) = name.map(str::trim).filter(|v| !v.is_empty()) {
            if existing.name.starts_with("WhatsApp ") {
                active.name = Set(name.to_string());
            }
        }
        active.updated_at = Set(Utc::now().fixed_offset());
        return Ok(active.update(&state.db).await?);
    }

    let now = Utc::now().fixed_offset();
    Ok(LeadActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(tenant_id),
        workspace_id: Set(None),
        user_id: Set(user_id),
        name: Set(
            name.map(str::trim)
                .filter(|v| !v.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| format!("WhatsApp {phone}")),
        ),
        email: Set(email),
        source: Set("whatsapp".into()),
        message: Set(Some(message.to_string())),
        classification: Set(Some("inbound".into())),
        status: Set(Some("new".into())),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(&state.db)
    .await?)
}

fn whatsapp_email(phone: &str) -> String {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    format!("wa+{digits}@inbox.mako")
}

async fn classify_lead_async(
    state: &AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    lead_id: Uuid,
    name: String,
    email: String,
    message: String,
) -> ApiResult<()> {
    let (data, _, _) = MistralService::complete_json(
        &state.config.mistral,
        vec![
            ChatMessage {
                role: "system".into(),
                content: "Classify inbound leads as hot, warm, or cold. Return JSON: {\"label\":\"hot|warm|cold\",\"suggestedReply\":\"short reply\"}".into(),
            },
            ChatMessage {
                role: "user".into(),
                content: format!("Name: {name}\nEmail: {email}\nMessage: {message}"),
            },
        ],
        Some(MistralService::default_model(&state.config.mistral)),
    )
    .await?;

    let label = data
        .get("label")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let ai_reply = data
        .get("suggestedReply")
        .and_then(|v| v.as_str())
        .map(str::to_string);

    if label.is_some() || ai_reply.is_some() {
        let mut active: crate::modules::leads::entity::ActiveModel =
            LeadEntity::find_by_id(lead_id)
                .one(&state.db)
                .await?
                .ok_or_else(|| crate::common::ApiError::NotFound("Lead not found".into()))?
                .into();
        if let Some(label) = label {
            active.classification = Set(Some(label));
        }
        if let Some(reply) = ai_reply.filter(|v| !v.trim().is_empty()) {
            active.ai_reply = Set(Some(reply));
        }
        active.updated_at = Set(Utc::now().fixed_offset());
        active.update(&state.db).await?;
    }

    let _ = (tenant_id, user_id);
    Ok(())
}
