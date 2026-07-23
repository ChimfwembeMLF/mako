use reqwest::Client;
use serde_json::Value;

use crate::common::{ApiError, ApiResult};
use crate::config::PawaPayConfig;

const PAWAPAY_V2_SANDBOX: &str = "https://api.sandbox.pawapay.io/v2";
const PAWAPAY_V2_PROD: &str = "https://api.pawapay.io/v2";

#[derive(Clone, Debug)]
pub struct InitiateDepositInput {
    pub deposit_id: String,
    pub amount: String,
    pub currency: String,
    pub correspondent: String,
    pub phone: Option<String>,
    pub customer_message: String,
}

#[derive(Clone)]
pub struct PawaPayService {
    config: PawaPayConfig,
    client: Client,
}

impl PawaPayService {
    pub fn new(config: PawaPayConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    pub fn is_enabled(&self) -> bool {
        !self.config.api_token.trim().is_empty()
    }

    pub fn should_auto_complete(&self) -> bool {
        self.config.payments_dev_auto_complete
    }

    pub fn base_url(&self) -> String {
        let raw = if self.config.env.eq_ignore_ascii_case("sandbox") {
            first_non_empty(&self.config.base_url_sandbox, &self.config.sandbox_api_url)
        } else {
            first_non_empty(&self.config.base_url_prod, &self.config.api_url)
        };

        let fallback = if self.config.env.eq_ignore_ascii_case("sandbox") {
            PAWAPAY_V2_SANDBOX
        } else {
            PAWAPAY_V2_PROD
        };

        normalize_pawapay_v2_base_url(if raw.is_empty() { fallback } else { raw })
    }

    pub async fn initiate_deposit(&self, input: InitiateDepositInput) -> ApiResult<()> {
        if !self.is_enabled() {
            return Ok(());
        }

        let payload = serde_json::json!({
            "depositId": input.deposit_id,
            "amount": input.amount,
            "currency": input.currency,
            "payer": {
                "type": "MMO",
                "accountDetails": {
                    "provider": input.correspondent,
                    "phoneNumber": input.phone,
                }
            },
            "customerMessage": truncate_customer_message(&input.customer_message),
        });

        let response = self
            .client
            .post(format!("{}/deposits", self.base_url()))
            .header(
                "Authorization",
                format!("Bearer {}", self.config.api_token.trim()),
            )
            .json(&payload)
            .send()
            .await
            .map_err(|err| {
                ApiError::BadRequest(format!("Failed to communicate with payment gateway: {err}"))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let message = response.text().await.unwrap_or_default();
            return Err(ApiError::BadRequest(format!(
                "Failed to communicate with payment gateway ({status}): {message}"
            )));
        }

        Ok(())
    }

    pub fn supports_webhook_signing(&self) -> bool {
        !self.config.private_key.trim().is_empty() && !self.config.public_key_id.trim().is_empty()
    }

    pub fn webhook_signing_key_id(&self) -> &str {
        self.config.public_key_id.trim()
    }

    pub fn webhook_private_key(&self) -> &str {
        self.config.private_key.trim()
    }

    pub async fn get_deposit_status(&self, deposit_id: &str) -> ApiResult<Option<String>> {
        if !self.is_enabled() {
            return Ok(None);
        }

        let response = self
            .client
            .get(format!("{}/deposits/{deposit_id}", self.base_url()))
            .header(
                "Authorization",
                format!("Bearer {}", self.config.api_token.trim()),
            )
            .send()
            .await
            .map_err(|err| {
                ApiError::BadRequest(format!("Failed to check payment status: {err}"))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let message = response.text().await.unwrap_or_default();
            return Err(ApiError::BadRequest(format!(
                "Failed to check payment status ({status}): {message}"
            )));
        }

        let data: Value = response.json().await.map_err(|err| {
            ApiError::BadRequest(format!("Invalid PawaPay status response: {err}"))
        })?;

        if let Some(array) = data.as_array() {
            let status = array
                .first()
                .and_then(|item| item.get("status"))
                .and_then(Value::as_str)
                .map(str::to_string);
            return Ok(status);
        }

        Ok(data
            .get("status")
            .and_then(Value::as_str)
            .map(str::to_string))
    }
}

fn normalize_pawapay_v2_base_url(url: &str) -> String {
    let mut base = url.trim().trim_end_matches('/').to_string();
    if base.ends_with("/v1") {
        base = base.trim_end_matches("/v1").to_string();
    }
    if !base.ends_with("/v2") {
        base.push_str("/v2");
    }
    base
}

fn truncate_customer_message(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= 22 {
        return trimmed.to_string();
    }
    trimmed.chars().take(22).collect()
}

fn first_non_empty<'a>(primary: &'a str, secondary: &'a str) -> &'a str {
    if !primary.trim().is_empty() {
        primary
    } else if !secondary.trim().is_empty() {
        secondary
    } else {
        ""
    }
}
