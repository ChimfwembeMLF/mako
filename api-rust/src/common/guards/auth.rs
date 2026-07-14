use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde_json::json;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::modules::auth::service::Claims;

pub struct AuthUser {
    pub id: Uuid,
    #[allow(dead_code)]
    pub provider: Option<String>,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|header| header.to_str().ok())
            .filter(|header| header.starts_with("Bearer "))
            .map(|header| header.trim_start_matches("Bearer "));

        let token =
            auth_header.ok_or_else(|| unauthorized("Missing or invalid Authorization header"))?;

        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|_| unauthorized("Invalid token"))?;

        if token_data.claims.token_type.as_deref() == Some("refresh") {
            return Err(unauthorized("Refresh token cannot be used as access token"));
        }

        let id = Uuid::parse_str(&token_data.claims.sub)
            .map_err(|_| unauthorized("Invalid token subject"))?;

        Ok(AuthUser {
            id,
            provider: token_data.claims.provider,
        })
    }
}

fn unauthorized(message: &str) -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({
            "success": false,
            "statusCode": 401,
            "error": message,
        })),
    )
        .into_response()
}
