use lettre::message::header::ContentType;
use lettre::message::Mailbox;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use axum::Router;

use crate::app_state::AppState;
use crate::common::ApiResult;

pub mod gmail_connect;

pub struct MailService;

impl MailService {
    pub async fn send_password_reset_email(
        state: &AppState,
        to: &str,
        reset_link: &str,
    ) -> ApiResult<()> {
        let subject = "Reset your Mako password";
        let text = format!(
            "You requested a password reset for your Mako account.\n\nReset your password: {reset_link}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email."
        );
        let html = format!(
            "<p>You requested a password reset for your Mako account.</p><p><a href=\"{reset_link}\">Reset your password</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>"
        );

        if !state.config.mail.is_configured() {
            tracing::warn!(to = %to, link = %reset_link, "Mail not configured — password reset link");
            return Ok(());
        }

        Self::send_html(state, to, subject, &text, &html).await?;
        tracing::info!(to = %to, "Password reset email sent");
        Ok(())
    }

    pub async fn send_workspace_invite_email(
        state: &AppState,
        to: &str,
        workspace_name: &str,
        signup_link: &str,
    ) -> ApiResult<()> {
        let app_name = &state.config.mail.app_name;
        let subject = format!("You've been invited to {workspace_name} on {app_name}");
        let text = format!(
            "You've been invited to join \"{workspace_name}\" on {app_name}.\n\nCreate your account or sign in with this email ({to}) to access the workspace:\n{signup_link}\n\nThis invitation expires in 7 days."
        );
        let html = format!(
            "<p>You've been invited to join <strong>{workspace_name}</strong> on {app_name}.</p><p>Create your account or sign in with <strong>{to}</strong> to access the workspace:</p><p><a href=\"{signup_link}\">Accept invitation</a></p><p>This invitation expires in 7 days.</p>"
        );

        if !state.config.mail.is_configured() {
            tracing::warn!(to = %to, link = %signup_link, "Mail not configured — workspace invite");
            return Ok(());
        }

        Self::send_html(state, to, &subject, &text, &html).await?;
        tracing::info!(to = %to, "Workspace invite email sent");
        Ok(())
    }

    pub async fn send_generic_email(
        state: &AppState,
        to: &str,
        subject: &str,
        text: &str,
    ) -> ApiResult<()> {
        if !state.config.mail.is_configured() {
            tracing::warn!(to = %to, subject = %subject, "Mail not configured — would send email");
            return Ok(());
        }

        let html = format!("<pre>{text}</pre>");
        Self::send_html(state, to, subject, text, &html).await?;
        tracing::info!(to = %to, subject = %subject, "Email sent");
        Ok(())
    }

    async fn send_html(
        state: &AppState,
        to: &str,
        subject: &str,
        text: &str,
        html: &str,
    ) -> ApiResult<()> {
        let mail = &state.config.mail;
        let from: Mailbox = mail
            .from
            .parse()
            .map_err(|e| crate::common::ApiError::BadRequest(format!("Invalid MAIL_FROM: {e}")))?;
        let to_mailbox: Mailbox = to
            .parse()
            .map_err(|e| crate::common::ApiError::BadRequest(format!("Invalid recipient: {e}")))?;

        let email = Message::builder()
            .from(from)
            .to(to_mailbox)
            .subject(subject)
            .multipart(
                lettre::message::MultiPart::alternative()
                    .singlepart(
                        lettre::message::SinglePart::builder()
                            .header(ContentType::TEXT_PLAIN)
                            .body(text.to_string()),
                    )
                    .singlepart(
                        lettre::message::SinglePart::builder()
                            .header(ContentType::TEXT_HTML)
                            .body(html.to_string()),
                    ),
            )
            .map_err(|e| crate::common::ApiError::BadRequest(e.to_string()))?;

        let creds = Credentials::new(mail.username.clone(), mail.password.clone());
        let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay(&mail.host)
            .map_err(|e| crate::common::ApiError::BadRequest(e.to_string()))?
            .port(mail.port)
            .credentials(creds)
            .build();

        mailer
            .send(email)
            .await
            .map_err(|e| crate::common::ApiError::BadRequest(format!("SMTP send failed: {e}")))?;

        Ok(())
    }
}

pub fn router() -> Router<AppState> {
    gmail_connect::router()
}
