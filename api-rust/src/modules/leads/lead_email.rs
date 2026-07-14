use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::auth::gmail::GmailService;
use crate::modules::mail::MailService;

#[derive(serde::Deserialize, Validate)]
pub struct SendLeadEmailDto {
    #[validate(email)]
    pub to: String,
    #[validate(length(min = 1))]
    pub subject: String,
    #[validate(length(min = 1))]
    pub body: String,
}

pub struct LeadEmailService;

impl LeadEmailService {
    pub async fn send_lead_email(
        state: &AppState,
        user_id: Uuid,
        params: SendLeadEmailDto,
    ) -> ApiResult<serde_json::Value> {
        match GmailService::send_email_as_user(
            state,
            user_id,
            &params.to,
            &params.subject,
            &params.body,
        )
        .await
        {
            Ok(result) => Ok(serde_json::json!({ "id": result.id })),
            Err(err) => {
                tracing::warn!(
                    user_id = %user_id,
                    error = %err,
                    "Gmail send failed, falling back to SMTP"
                );
                MailService::send_generic_email(state, &params.to, &params.subject, &params.body)
                    .await?;
                Ok(serde_json::json!({ "via": "smtp" }))
            }
        }
    }
}
