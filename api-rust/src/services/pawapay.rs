use reqwest::Client;
use serde_json::Value;

use crate::common::{ApiError, ApiResult};
use crate::config::PawaPayConfig;

#[derive(Clone, Debug)]
pub struct InitiateDepositInput {
    pub deposit_id: String,
    pub amount: String,
    pub currency: String,
    pub country: String,
    pub correspondent: String,
    pub phone: Option<String>,
    pub statement_description: String,
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
        if self.config.env.eq_ignore_ascii_case("sandbox") {
            return first_non_empty(&[
                &self.config.sandbox_api_url,
                &self.config.base_url_sandbox,
                "https://api.sandbox.pawapay.cloud/v1",
            ])
            .trim_end_matches('/')
            .to_string();
        }

        first_non_empty(&[
            &self.config.api_url,
            &self.config.base_url_prod,
            "https://api.pawapay.io/v1",
        ])
        .trim_end_matches('/')
        .to_string()
    }

    pub async fn initiate_deposit(&self, input: InitiateDepositInput) -> ApiResult<()> {
        if !self.is_enabled() {
            return Ok(());
        }

        let payload = serde_json::json!({
            "depositId": input.deposit_id,
            "amount": input.amount,
            "currency": input.currency,
            "country": input.country,
            "correspondent": input.correspondent,
            "payer": {
                "type": "MSISDN",
                "address": {
                    "value": input.phone,
                }
            },
            "statementDescription": input.statement_description,
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

fn first_non_empty<'a>(values: &'a [&'a str]) -> &'a str {
    values
        .iter()
        .copied()
        .find(|value| !value.trim().is_empty())
        .unwrap_or_default()
}
