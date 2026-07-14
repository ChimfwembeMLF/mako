use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::app_state::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub token_type: Option<String>,
}

pub struct AuthService;

impl AuthService {
    pub fn hash_password(password: &str) -> anyhow::Result<String> {
        Ok(bcrypt::hash(password, bcrypt::DEFAULT_COST)?)
    }

    pub fn verify_password(password: &str, hashed: &str) -> anyhow::Result<bool> {
        Ok(bcrypt::verify(password, hashed)?)
    }

    pub fn access_token(state: &AppState, user_id: Uuid, provider: &str) -> anyhow::Result<String> {
        Self::sign(
            state,
            Claims {
                sub: user_id.to_string(),
                exp: Self::expiry(state.config.jwt_expiry_secs),
                provider: Some(provider.to_string()),
                token_type: None,
            },
        )
    }

    pub fn refresh_token(
        state: &AppState,
        user_id: Uuid,
        provider: &str,
    ) -> anyhow::Result<String> {
        Self::sign(
            state,
            Claims {
                sub: user_id.to_string(),
                exp: Self::expiry(state.config.refresh_expiry_secs),
                provider: Some(provider.to_string()),
                token_type: Some("refresh".to_string()),
            },
        )
    }

    fn sign(state: &AppState, claims: Claims) -> anyhow::Result<String> {
        Ok(encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        )?)
    }

    pub fn reset_token(state: &AppState, user_id: Uuid) -> anyhow::Result<String> {
        Self::sign(
            state,
            Claims {
                sub: user_id.to_string(),
                exp: Self::expiry(3600),
                provider: None,
                token_type: Some("reset".to_string()),
            },
        )
    }

    pub fn verify_claims(state: &AppState, token: &str) -> anyhow::Result<Claims> {
        use jsonwebtoken::{decode, DecodingKey, Validation};
        let data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
            &Validation::default(),
        )?;
        Ok(data.claims)
    }

    fn expiry(seconds: usize) -> usize {
        chrono::Utc::now().timestamp() as usize + seconds
    }
}
