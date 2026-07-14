use axum::http::{header::SET_COOKIE, HeaderMap, HeaderValue};
use axum::response::Response;
use hmac::{Hmac, Mac};
use sha2::Sha256;

use crate::app_state::AppState;

const COOKIE_NAME: &str = "mako.oauth.state";
const MAX_AGE_SEC: u64 = 600;

type HmacSha256 = Hmac<Sha256>;

pub struct OAuthCookieState;

impl OAuthCookieState {
    pub fn issue_pair(state: &AppState) -> (String, String) {
        let oauth_state = uuid::Uuid::new_v4().to_string().replace('-', "");
        let signature = Self::sign(state, &oauth_state);
        let cookie_value = format!("{oauth_state}.{signature}");
        (oauth_state, cookie_value)
    }

    pub fn append_set_cookie(state: &AppState, response: &mut Response, cookie_value: &str) {
        let cookie = Self::cookie_header(state, cookie_value, MAX_AGE_SEC);
        if let Ok(value) = HeaderValue::from_str(&cookie) {
            response.headers_mut().append(SET_COOKIE, value);
        }
    }

    pub fn clear_cookie(state: &AppState, response: &mut Response) {
        let cookie = Self::cookie_header(state, "", 0);
        if let Ok(value) = HeaderValue::from_str(&cookie) {
            response.headers_mut().append(SET_COOKIE, value);
        }
    }

    pub fn verify(headers: &HeaderMap, state: &AppState, provided_state: &str) -> bool {
        let Some(raw_cookie) = Self::parse_cookie(headers) else {
            return false;
        };

        let Some((stored_state, signature)) = raw_cookie.rsplit_once('.') else {
            return false;
        };

        let expected = Self::sign(state, stored_state);
        if signature.len() != expected.len() {
            return false;
        }

        let mut ok = true;
        for (a, b) in signature.bytes().zip(expected.bytes()) {
            ok &= a == b;
        }
        if !ok {
            return false;
        }

        stored_state == provided_state
    }

    fn secret(state: &AppState) -> String {
        std::env::var("SESSION_SECRET")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .unwrap_or_else(|| state.config.jwt_secret.clone())
    }

    fn sign(state: &AppState, value: &str) -> String {
        let mut mac =
            HmacSha256::new_from_slice(Self::secret(state).as_bytes()).expect("hmac key");
        mac.update(value.as_bytes());
        mac.finalize()
            .into_bytes()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect()
    }

    fn cookie_secure() -> bool {
        match std::env::var("SESSION_SECURE")
            .ok()
            .map(|v| v.trim().to_lowercase())
            .as_deref()
        {
            Some("true") => true,
            Some("false") => false,
            _ => std::env::var("NODE_ENV")
                .map(|v| v.to_lowercase() == "production")
                .unwrap_or(false),
        }
    }

    fn cookie_header(_state: &AppState, value: &str, max_age: u64) -> String {
        let encoded = urlencoding::encode(value);
        let mut parts = vec![
            format!("{COOKIE_NAME}={encoded}"),
            "Path=/".to_string(),
            "HttpOnly".to_string(),
            "SameSite=Lax".to_string(),
            format!("Max-Age={max_age}"),
        ];
        if Self::cookie_secure() {
            parts.push("Secure".to_string());
        }
        parts.join("; ")
    }

    fn parse_cookie(headers: &HeaderMap) -> Option<String> {
        let header = headers.get(axum::http::header::COOKIE)?.to_str().ok()?;
        for part in header.split(';') {
            let (key, value) = part.trim().split_once('=')?;
            if key.trim() == COOKIE_NAME {
                return urlencoding::decode(value.trim())
                    .ok()
                    .map(|v| v.into_owned());
            }
        }
        None
    }
}
