use std::env;

use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use chrono::{DateTime, Duration, FixedOffset, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::auth::oauth::google::encode_params;

const SETUP_TOKEN_TTL_SECS: i64 = 900;

const FACEBOOK_PUBLISHER_SCOPES: &[&str] = &[
    "pages_manage_posts",
    "pages_read_engagement",
    "pages_manage_engagement",
    "pages_show_list",
    "ads_management",
    "ads_read",
    "business_management",
];

const INSTAGRAM_PUBLISHER_SCOPES: &[&str] = &[
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_messages",
];

const LINKEDIN_PUBLISHER_SCOPES: &[&str] = &["openid", "profile", "email", "w_member_social"];

const GOOGLE_PUBLISHER_SCOPES: &[&str] = &["openid", "email", "profile"];

const YOUTUBE_PUBLISHER_SCOPES: &[&str] = &[
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
];

const TIKTOK_PUBLISHER_SCOPES: &[&str] = &[
    "user.info.basic",
    "user.info.profile",
    "video.upload",
    "video.publish",
];

const WHATSAPP_PUBLISHER_SCOPES: &[&str] = &[
    "business_management",
    "whatsapp_business_management",
    "whatsapp_business_messaging",
];

pub const OAUTH_PLATFORMS: &[&str] = &[
    "facebook",
    "linkedin",
    "instagram",
    "google",
    "youtube",
    "whatsapp",
    "tiktok",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthConnectState {
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub return_url: Option<String>,
    pub provider: String,
    pub redirect_uri: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code_verifier: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConnectResult {
    pub platform: String,
    pub account_name: String,
    pub external_id: Option<String>,
    pub username: Option<String>,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<FixedOffset>>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhatsAppPhoneOption {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_phone_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verified_name: Option<String>,
    pub waba_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub waba_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhatsAppSetupPayload {
    #[serde(rename = "type")]
    pub token_type: String,
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<Uuid>,
    pub access_token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    pub phones: Vec<WhatsAppPhoneOption>,
    pub exp: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacebookPageOption {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacebookSetupPayload {
    #[serde(rename = "type")]
    pub token_type: String,
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<Uuid>,
    pub access_token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    pub profile: FacebookProfile,
    pub pages: Vec<FacebookPageOption>,
    pub exp: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FacebookProfile {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeChannelOption {
    pub id: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YoutubeSetupPayload {
    #[serde(rename = "type")]
    pub token_type: String,
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<Uuid>,
    pub access_token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile: Option<FacebookProfile>,
    pub channels: Vec<YoutubeChannelOption>,
    pub exp: usize,
}

#[derive(Debug, Serialize)]
#[serde(untagged, rename_all = "camelCase")]
pub enum WhatsappSetupFromMetaResult {
    Ready {
        ready: bool,
        setup_token: String,
        phones: Vec<WhatsAppPhoneOption>,
        source: String,
    },
    NeedOAuth {
        ready: bool,
        #[serde(rename = "needOAuth")]
        need_oauth: bool,
        reason: String,
    },
}

fn scopes_to_param(scopes: &[&str]) -> String {
    scopes.join(",")
}

fn google_scopes_to_param(scopes: &[&str]) -> String {
    scopes.join(" ")
}

pub fn frontend_url(state: &AppState) -> String {
    env::var("FRONTEND_URL")
        .or_else(|_| env::var("CLIENT_URL"))
        .or_else(|_| env::var("APP_URL"))
        .unwrap_or_else(|_| state.config.oauth.frontend_url.clone())
        .trim_end_matches('/')
        .to_string()
}

pub fn api_base_url(state: &AppState) -> String {
    env::var("API_PUBLIC_URL")
        .or_else(|_| env::var("API_BASE_URL"))
        .unwrap_or_else(|_| format!("http://localhost:{}", state.config.port))
        .trim_end_matches('/')
        .to_string()
}

pub fn encode_state(state: &OAuthConnectState) -> String {
    let json = serde_json::to_string(state).unwrap_or_default();
    URL_SAFE_NO_PAD.encode(json.as_bytes())
}

pub fn decode_state(state: &str) -> Option<OAuthConnectState> {
    let mut raw = state.trim().to_string();
    for _ in 0..3 {
        if !raw.contains('%') {
            break;
        }
        raw = urlencoding::decode(&raw).ok()?.into_owned();
    }

    let b64 = raw.replace('-', "+").replace('_', "/");
    let pad = b64.len() % 4;
    let padded = if pad == 0 {
        b64
    } else {
        format!("{}{}", b64, "=".repeat(4 - pad))
    };

    let bytes = STANDARD.decode(padded).ok()?;
    serde_json::from_slice(&bytes).ok()
}

pub fn get_callback_url(_state: &AppState, api_base: &str, platform: &str) -> String {
    let env_key = format!("{}_SOCIAL_CALLBACK_URL", platform.to_uppercase());
    if let Ok(from_env) = env::var(&env_key) {
        let trimmed = from_env.trim();
        if !trimmed.is_empty() {
            return trimmed.trim_end_matches('/').to_string();
        }
    }

    let base = env::var("API_BASE_URL")
        .unwrap_or_else(|_| api_base.to_string())
        .trim_end_matches('/')
        .to_string();

    format!("{base}/api/v1/social-accounts/oauth/{platform}/callback")
}

pub fn attach_tiktok_pkce(mut connect_state: OAuthConnectState) -> OAuthConnectState {
    let mut buf = [0u8; 48];
    getrandom::fill(&mut buf).ok();
    let encoded = URL_SAFE_NO_PAD.encode(buf);
    let code_verifier = encoded.chars().take(64).collect();
    connect_state.code_verifier = Some(code_verifier);
    connect_state
}

pub fn get_authorize_url(
    state: &AppState,
    platform: &str,
    oauth_state: &str,
    redirect_uri: &str,
    code_verifier: Option<&str>,
) -> ApiResult<String> {
    match platform {
        "facebook" => Ok(facebook_authorize_url(state, oauth_state, redirect_uri)),
        "linkedin" => Ok(linkedin_authorize_url(state, oauth_state, redirect_uri)),
        "instagram" => Ok(instagram_authorize_url(state, oauth_state, redirect_uri)),
        "google" => Ok(google_authorize_url(state, oauth_state, redirect_uri)),
        "youtube" => Ok(youtube_authorize_url(state, oauth_state, redirect_uri)),
        "whatsapp" => Ok(whatsapp_authorize_url(state, oauth_state, redirect_uri)),
        "tiktok" => {
            let verifier = code_verifier.ok_or_else(|| {
                ApiError::BadRequest("TikTok OAuth requires PKCE code_verifier".into())
            })?;
            Ok(tiktok_authorize_url(
                state,
                oauth_state,
                redirect_uri,
                verifier,
            ))
        }
        _ => Err(ApiError::BadRequest(format!(
            "Unsupported platform: {platform}"
        ))),
    }
}

fn facebook_authorize_url(state: &AppState, oauth_state: &str, redirect_uri: &str) -> String {
    let app_id = require_env_or_empty("FACEBOOK_APP_ID", &state.config.oauth.facebook_app_id);
    let scope = scopes_to_param(FACEBOOK_PUBLISHER_SCOPES);
    let params = vec![
        ("client_id", app_id.as_str()),
        ("redirect_uri", redirect_uri),
        ("state", oauth_state),
        ("scope", scope.as_str()),
        ("response_type", "code"),
    ];
    format!(
        "https://www.facebook.com/v19.0/dialog/oauth?{}",
        encode_params(&params)
    )
}

fn linkedin_authorize_url(state: &AppState, oauth_state: &str, redirect_uri: &str) -> String {
    let client_id =
        require_env_or_empty("LINKEDIN_CLIENT_ID", &state.config.oauth.linkedin_client_id);
    let scope = scopes_to_param(LINKEDIN_PUBLISHER_SCOPES);
    let params = vec![
        ("response_type", "code"),
        ("client_id", client_id.as_str()),
        ("redirect_uri", redirect_uri),
        ("scope", scope.as_str()),
        ("state", oauth_state),
    ];
    format!(
        "https://www.linkedin.com/oauth/v2/authorization?{}",
        encode_params(&params)
    )
}

fn instagram_authorize_url(state: &AppState, oauth_state: &str, redirect_uri: &str) -> String {
    let app_id = require_env_or_empty("FACEBOOK_APP_ID", &state.config.oauth.facebook_app_id);
    let scope = scopes_to_param(INSTAGRAM_PUBLISHER_SCOPES);
    let params = vec![
        ("client_id", app_id.as_str()),
        ("redirect_uri", redirect_uri),
        ("scope", scope.as_str()),
        ("response_type", "code"),
        ("state", oauth_state),
    ];
    format!(
        "https://www.facebook.com/v19.0/dialog/oauth?{}",
        encode_params(&params)
    )
}

fn google_authorize_url(state: &AppState, oauth_state: &str, redirect_uri: &str) -> String {
    let client_id = require_env_or_empty("GOOGLE_CLIENT_ID", &state.config.oauth.google_client_id);
    let scope = google_scopes_to_param(GOOGLE_PUBLISHER_SCOPES);
    let params = vec![
        ("client_id", client_id.as_str()),
        ("redirect_uri", redirect_uri),
        ("response_type", "code"),
        ("scope", scope.as_str()),
        ("access_type", "offline"),
        ("prompt", "consent"),
        ("state", oauth_state),
    ];
    format!(
        "https://accounts.google.com/o/oauth2/v2/auth?{}",
        encode_params(&params)
    )
}

fn youtube_authorize_url(state: &AppState, oauth_state: &str, redirect_uri: &str) -> String {
    let client_id = require_env_or_empty("GOOGLE_CLIENT_ID", &state.config.oauth.google_client_id);
    let scope = google_scopes_to_param(YOUTUBE_PUBLISHER_SCOPES);
    let params = vec![
        ("client_id", client_id.as_str()),
        ("redirect_uri", redirect_uri),
        ("response_type", "code"),
        ("scope", scope.as_str()),
        ("access_type", "offline"),
        ("prompt", "consent"),
        ("state", oauth_state),
    ];
    format!(
        "https://accounts.google.com/o/oauth2/v2/auth?{}",
        encode_params(&params)
    )
}

fn whatsapp_authorize_url(state: &AppState, oauth_state: &str, redirect_uri: &str) -> String {
    let app_id = require_env_or_empty("FACEBOOK_APP_ID", &state.config.oauth.facebook_app_id);
    let scope = scopes_to_param(WHATSAPP_PUBLISHER_SCOPES);
    let params = vec![
        ("client_id", app_id.as_str()),
        ("redirect_uri", redirect_uri),
        ("state", oauth_state),
        ("scope", scope.as_str()),
        ("response_type", "code"),
    ];
    format!(
        "https://www.facebook.com/v19.0/dialog/oauth?{}",
        encode_params(&params)
    )
}

fn tiktok_authorize_url(
    _state: &AppState,
    oauth_state: &str,
    redirect_uri: &str,
    code_verifier: &str,
) -> String {
    let client_key = env::var("TIKTOK_CLIENT_KEY").unwrap_or_default();
    let digest = Sha256::digest(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(digest);
    let scope = scopes_to_param(TIKTOK_PUBLISHER_SCOPES);
    let params = vec![
        ("client_key", client_key.as_str()),
        ("redirect_uri", redirect_uri),
        ("scope", scope.as_str()),
        ("response_type", "code"),
        ("state", oauth_state),
        ("code_challenge", code_challenge.as_str()),
        ("code_challenge_method", "S256"),
    ];
    format!(
        "https://www.tiktok.com/v2/auth/authorize/?{}",
        encode_params(&params)
    )
}

fn require_env_or_empty(key: &str, fallback: &str) -> String {
    env::var(key).unwrap_or_else(|_| fallback.to_string())
}

fn setup_exp() -> usize {
    (Utc::now() + Duration::seconds(SETUP_TOKEN_TTL_SECS)).timestamp() as usize
}

fn sign_setup_token<T: Serialize>(state: &AppState, claims: &T) -> ApiResult<String> {
    encode(
        &Header::default(),
        claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|e| ApiError::BadRequest(e.to_string()))
}

pub fn create_facebook_setup_token(
    state: &AppState,
    mut payload: FacebookSetupPayload,
) -> ApiResult<String> {
    payload.token_type = "facebook_setup".into();
    payload.exp = setup_exp();
    sign_setup_token(state, &payload)
}

pub fn create_youtube_setup_token(
    state: &AppState,
    mut payload: YoutubeSetupPayload,
) -> ApiResult<String> {
    payload.token_type = "youtube_setup".into();
    payload.exp = setup_exp();
    sign_setup_token(state, &payload)
}

pub fn create_whatsapp_setup_token(
    state: &AppState,
    mut payload: WhatsAppSetupPayload,
) -> ApiResult<String> {
    payload.token_type = "whatsapp_setup".into();
    payload.exp = setup_exp();
    sign_setup_token(state, &payload)
}

pub fn verify_facebook_setup_token(
    state: &AppState,
    token: &str,
) -> ApiResult<FacebookSetupPayload> {
    let decoded = decode_setup_token::<FacebookSetupPayload>(state, token)?;
    if decoded.token_type != "facebook_setup"
        || decoded.pages.is_empty()
        || decoded.access_token.is_empty()
    {
        return Err(ApiError::BadRequest("Invalid Facebook setup token".into()));
    }
    Ok(decoded)
}

pub fn verify_youtube_setup_token(state: &AppState, token: &str) -> ApiResult<YoutubeSetupPayload> {
    let decoded = decode_setup_token::<YoutubeSetupPayload>(state, token)?;
    if decoded.token_type != "youtube_setup"
        || decoded.channels.is_empty()
        || decoded.access_token.is_empty()
    {
        return Err(ApiError::BadRequest("Invalid YouTube setup token".into()));
    }
    Ok(decoded)
}

pub fn verify_whatsapp_setup_token(
    state: &AppState,
    token: &str,
) -> ApiResult<WhatsAppSetupPayload> {
    let decoded = decode_setup_token::<WhatsAppSetupPayload>(state, token)?;
    if decoded.token_type != "whatsapp_setup"
        || decoded.phones.is_empty()
        || decoded.access_token.is_empty()
    {
        return Err(ApiError::BadRequest("Invalid WhatsApp setup token".into()));
    }
    Ok(decoded)
}

fn decode_setup_token<T: for<'de> Deserialize<'de>>(state: &AppState, token: &str) -> ApiResult<T> {
    decode::<T>(
        token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|_| ApiError::BadRequest("Setup expired — please connect again from Publisher".into()))
}

pub async fn handle_callback(
    state: &AppState,
    platform: &str,
    code: &str,
    redirect_uri: &str,
    code_verifier: Option<&str>,
) -> ApiResult<OAuthConnectResult> {
    match platform {
        "facebook" => Err(ApiError::BadRequest(
            "Facebook uses a separate finalize flow after Page selection".into(),
        )),
        "linkedin" => handle_linkedin_callback(state, code, redirect_uri).await,
        "instagram" => handle_instagram_callback(state, code, redirect_uri).await,
        "google" => handle_google_callback(state, code, redirect_uri).await,
        "youtube" => Err(ApiError::BadRequest(
            "YouTube uses a separate finalize flow after channel selection".into(),
        )),
        "whatsapp" => Err(ApiError::BadRequest(
            "WhatsApp uses a separate finalize flow after phone selection".into(),
        )),
        "tiktok" => handle_tiktok_callback(state, code, redirect_uri, code_verifier).await,
        _ => Err(ApiError::BadRequest(format!(
            "Unsupported platform: {platform}"
        ))),
    }
}

pub async fn prepare_whatsapp_connect(
    state: &AppState,
    code: &str,
    redirect_uri: &str,
) -> ApiResult<(
    String,
    Option<DateTime<FixedOffset>>,
    Vec<WhatsAppPhoneOption>,
)> {
    let short = exchange_facebook_code(state, code, redirect_uri).await?;
    let long_lived = exchange_facebook_long_lived(state, &short).await?;
    let phones = list_whatsapp_phone_numbers(state, &long_lived.access_token).await?;

    if phones.is_empty() {
        return Err(ApiError::BadRequest(
            "No WhatsApp Business phone numbers are linked to the Meta account you signed in with. \
             If you are the Mako  operator, configure WHATSAPP_PLATFORM_PHONE_NUMBER_ID and \
             WHATSAPP_PLATFORM_ACCESS_TOKEN on the server so clients can enable WhatsApp without Meta setup. \
             Otherwise your business needs a WhatsApp Business Account in Meta Business Settings \
             (Business settings → WhatsApp accounts), then connect again."
                .into(),
        ));
    }

    Ok((long_lived.access_token, long_lived.expires_at, phones))
}

pub async fn prepare_facebook_connect(
    state: &AppState,
    code: &str,
    redirect_uri: &str,
) -> ApiResult<(
    String,
    Option<DateTime<FixedOffset>>,
    FacebookProfile,
    Vec<FacebookPageOption>,
)> {
    let short = exchange_facebook_code(state, code, redirect_uri).await?;
    let long_lived = exchange_facebook_long_lived(state, &short).await?;
    let profile = get_facebook_profile(state, &long_lived.access_token).await?;
    let pages = get_facebook_pages(state, &long_lived.access_token).await?;

    if pages.is_empty() {
        return Err(ApiError::BadRequest(
            "No Facebook Pages found. Sign in with a Meta account that manages at least one Facebook Page, then try again.".into(),
        ));
    }

    let page_options = pages
        .iter()
        .map(|p| FacebookPageOption {
            id: p.id.clone(),
            name: p.name.clone(),
            category: p.category.clone(),
        })
        .collect();

    Ok((
        long_lived.access_token,
        long_lived.expires_at,
        profile,
        page_options,
    ))
}

pub async fn prepare_youtube_connect(
    state: &AppState,
    code: &str,
    redirect_uri: &str,
) -> ApiResult<(
    String,
    Option<String>,
    Option<DateTime<FixedOffset>>,
    Option<FacebookProfile>,
    Vec<YoutubeChannelOption>,
)> {
    let tokens = exchange_google_code(state, code, redirect_uri).await?;
    let access_token = tokens
        .access_token
        .ok_or_else(|| ApiError::BadRequest("YouTube token exchange failed".into()))?;

    let profile = fetch_google_profile(&access_token).await?;
    let channels = list_youtube_channels(&access_token).await?;

    if channels.is_empty() {
        return Err(ApiError::BadRequest(
            "No YouTube channel found. Create a YouTube channel with this Google account, then connect again.".into(),
        ));
    }

    let expires_at = tokens
        .expires_in
        .map(|secs| (Utc::now() + Duration::seconds(secs)).fixed_offset());

    Ok((
        access_token,
        tokens.refresh_token,
        expires_at,
        Some(profile),
        channels,
    ))
}

pub async fn build_facebook_connect_result(
    state: &AppState,
    payload: &FacebookSetupPayload,
    page_id: &str,
) -> ApiResult<OAuthConnectResult> {
    let listed = payload
        .pages
        .iter()
        .find(|p| p.id == page_id)
        .ok_or_else(|| {
            ApiError::BadRequest("Selected Page is not available for this setup session".into())
        })?;

    let pages = get_facebook_pages(state, &payload.access_token).await?;
    let page = pages
        .iter()
        .find(|p| p.id == page_id)
        .ok_or_else(|| {
            ApiError::BadRequest(
                "Could not access the selected Page. Confirm you still manage this Page in Meta, then connect again.".into(),
            )
        })?;

    let expires_at = payload
        .expires_at
        .as_ref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok());

    Ok(OAuthConnectResult {
        platform: "facebook".into(),
        account_name: if !page.name.is_empty() {
            page.name.clone()
        } else if !listed.name.is_empty() {
            listed.name.clone()
        } else {
            payload
                .profile
                .name
                .clone()
                .unwrap_or_else(|| "Facebook Page".into())
        },
        external_id: Some(page.id.clone()),
        username: payload.profile.name.clone(),
        access_token: payload.access_token.clone(),
        refresh_token: None,
        expires_at,
        metadata: Some(json!({
            "profile": payload.profile,
            "page": { "id": page.id, "name": page.name, "category": page.category },
            "page_id": page.id,
            "page_name": page.name,
            "page_token": page.access_token,
            "pages": pages.iter().map(|p| json!({
                "id": p.id,
                "name": p.name,
                "category": p.category,
            })).collect::<Vec<_>>(),
        })),
    })
}

pub fn build_youtube_connect_result(
    payload: &YoutubeSetupPayload,
    channel_id: &str,
) -> ApiResult<OAuthConnectResult> {
    let channel = payload
        .channels
        .iter()
        .find(|c| c.id == channel_id)
        .ok_or_else(|| {
            ApiError::BadRequest("Selected channel is not available for this setup session".into())
        })?;

    let expires_at = payload
        .expires_at
        .as_ref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok());

    Ok(OAuthConnectResult {
        platform: "youtube".into(),
        account_name: channel.title.clone(),
        external_id: Some(channel.id.clone()),
        username: channel
            .custom_url
            .clone()
            .or_else(|| Some(channel.title.clone())),
        access_token: payload.access_token.clone(),
        refresh_token: payload.refresh_token.clone(),
        expires_at,
        metadata: Some(json!({
            "profile": payload.profile,
            "channel_id": channel.id,
            "channel_title": channel.title,
            "custom_url": channel.custom_url,
            "thumbnail_url": channel.thumbnail_url,
        })),
    })
}

pub async fn meta_token_has_whatsapp_permissions(
    state: &AppState,
    access_token: &str,
) -> ApiResult<bool> {
    let scopes = debug_meta_token_scopes(state, access_token).await?;
    Ok(scopes.iter().any(|s| s == "whatsapp_business_messaging"))
}

pub async fn discover_whatsapp_phones(
    state: &AppState,
    access_token: &str,
) -> ApiResult<Vec<WhatsAppPhoneOption>> {
    list_whatsapp_phone_numbers(state, access_token).await
}

struct LongLivedToken {
    access_token: String,
    expires_at: Option<DateTime<FixedOffset>>,
}

#[derive(Deserialize)]
struct FacebookPageRaw {
    id: String,
    name: String,
    #[serde(default)]
    category: Option<String>,
    #[serde(default)]
    access_token: Option<String>,
}

async fn exchange_facebook_code(
    state: &AppState,
    code: &str,
    redirect_uri: &str,
) -> ApiResult<String> {
    let app_id =
        env::var("FACEBOOK_APP_ID").unwrap_or_else(|_| state.config.oauth.facebook_app_id.clone());
    let app_secret = env::var("FACEBOOK_APP_SECRET")
        .unwrap_or_else(|_| state.config.oauth.facebook_app_secret.clone());

    if app_id.is_empty() || app_secret.is_empty() {
        return Err(ApiError::BadRequest(
            "Facebook app credentials are not configured".into(),
        ));
    }

    let url = format!(
        "https://graph.facebook.com/v19.0/oauth/access_token?client_id={}&client_secret={}&redirect_uri={}&code={}",
        urlencoding::encode(&app_id),
        urlencoding::encode(&app_secret),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(code),
    );

    let body: Value = Client::new()
        .get(&url)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    if let Some(msg) = body
        .get("error")
        .and_then(|e| e.get("message"))
        .and_then(|m| m.as_str())
    {
        return Err(ApiError::BadRequest(msg.to_string()));
    }

    body.get("access_token")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| ApiError::BadRequest("Facebook code exchange failed".into()))
}

async fn exchange_facebook_long_lived(
    state: &AppState,
    access_token: &str,
) -> ApiResult<LongLivedToken> {
    let app_id =
        env::var("FACEBOOK_APP_ID").unwrap_or_else(|_| state.config.oauth.facebook_app_id.clone());
    let app_secret = env::var("FACEBOOK_APP_SECRET")
        .unwrap_or_else(|_| state.config.oauth.facebook_app_secret.clone());

    if app_id.is_empty() || app_secret.is_empty() {
        return Err(ApiError::BadRequest(
            "Facebook app credentials are not configured".into(),
        ));
    }

    let url = format!(
        "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id={}&client_secret={}&fb_exchange_token={}",
        urlencoding::encode(&app_id),
        urlencoding::encode(&app_secret),
        urlencoding::encode(access_token),
    );

    let body: Value = Client::new()
        .get(&url)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let token = body
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::BadRequest("Facebook long-lived token exchange failed".into()))?;

    let expires_at = body
        .get("expires_in")
        .and_then(|v| v.as_i64())
        .map(|secs| (Utc::now() + Duration::seconds(secs)).fixed_offset());

    Ok(LongLivedToken {
        access_token: token.to_string(),
        expires_at,
    })
}

async fn get_facebook_profile(_state: &AppState, token: &str) -> ApiResult<FacebookProfile> {
    let url = format!(
        "https://graph.facebook.com/v19.0/me?fields=id,name&access_token={}",
        urlencoding::encode(token)
    );
    Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))
}

async fn get_facebook_pages(_state: &AppState, token: &str) -> ApiResult<Vec<FacebookPageRaw>> {
    let url = format!(
        "https://graph.facebook.com/v19.0/me/accounts?fields=id,name,category,access_token&access_token={}",
        urlencoding::encode(token)
    );
    let body: Value = Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(body
        .get("data")
        .and_then(|d| serde_json::from_value(d.clone()).ok())
        .unwrap_or_default())
}

async fn handle_linkedin_callback(
    state: &AppState,
    code: &str,
    redirect_uri: &str,
) -> ApiResult<OAuthConnectResult> {
    let client_id = env::var("LINKEDIN_CLIENT_ID")
        .unwrap_or_else(|_| state.config.oauth.linkedin_client_id.clone());
    let client_secret = env::var("LINKEDIN_CLIENT_SECRET")
        .unwrap_or_else(|_| state.config.oauth.linkedin_client_secret.clone());

    if client_id.is_empty() || client_secret.is_empty() {
        return Err(ApiError::BadRequest(
            "LinkedIn credentials are not configured".into(),
        ));
    }

    let body = format!(
        "grant_type=authorization_code&code={}&redirect_uri={}&client_id={}&client_secret={}",
        urlencoding::encode(code),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(&client_id),
        urlencoding::encode(&client_secret),
    );

    let token_resp: Value = Client::new()
        .post("https://www.linkedin.com/oauth/v2/accessToken")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let access_token = token_resp
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::BadRequest("LinkedIn token exchange failed".into()))?;

    let profile: Value = Client::new()
        .get("https://api.linkedin.com/v2/userinfo")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let given = profile
        .get("given_name")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let family = profile
        .get("family_name")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let account_name = format!("{given} {family}").trim().to_string();

    let expires_at = token_resp
        .get("expires_in")
        .and_then(|v| v.as_i64())
        .map(|secs| (Utc::now() + Duration::seconds(secs)).fixed_offset());

    Ok(OAuthConnectResult {
        platform: "linkedin".into(),
        account_name: if account_name.is_empty() {
            "LinkedIn Account".into()
        } else {
            account_name
        },
        external_id: profile
            .get("sub")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        username: profile
            .get("email")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        access_token: access_token.to_string(),
        refresh_token: token_resp
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        expires_at,
        metadata: Some(json!({
            "profile": profile,
            "person_id": profile.get("sub"),
        })),
    })
}

async fn handle_instagram_callback(
    state: &AppState,
    code: &str,
    redirect_uri: &str,
) -> ApiResult<OAuthConnectResult> {
    let short = exchange_facebook_code(state, code, redirect_uri).await?;
    let long_lived = exchange_facebook_long_lived(state, &short).await?;
    let pages = get_facebook_pages(state, &long_lived.access_token).await?;

    if pages.is_empty() {
        return Err(ApiError::BadRequest(
            "No Facebook Pages found. Connect a Facebook Page that is linked to your Instagram professional account.".into(),
        ));
    }

    for page in pages {
        let page_token = page
            .access_token
            .as_deref()
            .unwrap_or(&long_lived.access_token);
        if let Some(ig) = get_instagram_business_account_for_page(&page.id, page_token).await? {
            let profile = get_instagram_business_profile(&ig.id, page_token).await?;
            return Ok(OAuthConnectResult {
                platform: "instagram".into(),
                account_name: profile
                    .username
                    .clone()
                    .or(profile.name.clone())
                    .or(Some(page.name.clone()))
                    .unwrap_or_else(|| "Instagram Account".into()),
                external_id: profile.id.clone().or(Some(ig.id.clone())),
                username: profile.username.clone(),
                access_token: page_token.to_string(),
                refresh_token: None,
                expires_at: long_lived.expires_at,
                metadata: Some(json!({
                    "profile": profile,
                    "page_id": page.id,
                    "page_name": page.name,
                    "page_token": page_token,
                    "instagram_business_account_id": ig.id,
                })),
            });
        }
    }

    Err(ApiError::BadRequest(
        "No Instagram Business account linked to your Facebook Pages. In Meta Business Settings, link an Instagram professional account to a Page, then try again.".into(),
    ))
}

#[derive(Deserialize)]
struct IgBusinessAccount {
    id: String,
}

#[derive(Deserialize, Default, Serialize)]
struct IgProfile {
    id: Option<String>,
    username: Option<String>,
    name: Option<String>,
}

async fn get_instagram_business_account_for_page(
    page_id: &str,
    page_token: &str,
) -> ApiResult<Option<IgBusinessAccount>> {
    let url = format!(
        "https://graph.facebook.com/v19.0/{page_id}?fields=instagram_business_account&access_token={}",
        urlencoding::encode(page_token)
    );
    let body: Value = Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    if body.get("error").is_some() {
        return Ok(None);
    }

    Ok(body
        .get("instagram_business_account")
        .and_then(|v| serde_json::from_value(v.clone()).ok()))
}

async fn get_instagram_business_profile(
    ig_business_id: &str,
    access_token: &str,
) -> ApiResult<IgProfile> {
    let url = format!(
        "https://graph.facebook.com/v19.0/{ig_business_id}?fields=id,username,name&access_token={}",
        urlencoding::encode(access_token)
    );
    let profile: IgProfile = Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    if profile.id.is_none() {
        return Err(ApiError::BadRequest(
            "Could not load Instagram business profile".into(),
        ));
    }
    Ok(profile)
}

#[derive(Deserialize)]
struct GoogleTokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
}

async fn exchange_google_code(
    state: &AppState,
    code: &str,
    redirect_uri: &str,
) -> ApiResult<GoogleTokenResponse> {
    let client_id = env::var("GOOGLE_CLIENT_ID")
        .unwrap_or_else(|_| state.config.oauth.google_client_id.clone());
    let client_secret = env::var("GOOGLE_CLIENT_SECRET")
        .unwrap_or_else(|_| state.config.oauth.google_client_secret.clone());

    if client_id.is_empty() || client_secret.is_empty() {
        return Err(ApiError::BadRequest(
            "Google credentials are not configured".into(),
        ));
    }

    let resp = Client::new()
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let body: Value = resp
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    if let Some(err) = body.get("error").and_then(|v| v.as_str()) {
        let desc = body
            .get("error_description")
            .and_then(|v| v.as_str())
            .unwrap_or(err);
        return Err(ApiError::BadRequest(desc.to_string()));
    }

    serde_json::from_value(body)
        .map_err(|_| ApiError::BadRequest("Google token exchange failed".into()))
}

async fn fetch_google_profile(access_token: &str) -> ApiResult<FacebookProfile> {
    let body: Value = Client::new()
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(FacebookProfile {
        id: body.get("id").and_then(|v| v.as_str()).map(str::to_string),
        name: body
            .get("name")
            .and_then(|v| v.as_str())
            .map(str::to_string),
    })
}

async fn list_youtube_channels(access_token: &str) -> ApiResult<Vec<YoutubeChannelOption>> {
    let body: Value = Client::new()
        .get("https://www.googleapis.com/youtube/v3/channels")
        .query(&[("part", "snippet"), ("mine", "true"), ("maxResults", "25")])
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let items = body
        .get("items")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(items
        .into_iter()
        .filter_map(|item| {
            let id = item.get("id")?.as_str()?.to_string();
            let snippet = item.get("snippet")?;
            Some(YoutubeChannelOption {
                id,
                title: snippet
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("YouTube Channel")
                    .to_string(),
                custom_url: snippet
                    .get("customUrl")
                    .and_then(|v| v.as_str())
                    .map(str::to_string),
                thumbnail_url: snippet
                    .get("thumbnails")
                    .and_then(|t| t.get("default"))
                    .and_then(|d| d.get("url"))
                    .and_then(|u| u.as_str())
                    .map(str::to_string),
            })
        })
        .collect())
}

async fn handle_google_callback(
    state: &AppState,
    code: &str,
    redirect_uri: &str,
) -> ApiResult<OAuthConnectResult> {
    let tokens = exchange_google_code(state, code, redirect_uri).await?;
    let access_token = tokens
        .access_token
        .ok_or_else(|| ApiError::BadRequest("Google token exchange failed".into()))?;

    let profile = fetch_google_profile(&access_token).await?;
    let expires_at = tokens
        .expires_in
        .map(|secs| (Utc::now() + Duration::seconds(secs)).fixed_offset());

    Ok(OAuthConnectResult {
        platform: "google".into(),
        account_name: profile
            .name
            .clone()
            .unwrap_or_else(|| "Google Account".into()),
        external_id: profile.id.clone(),
        username: profile.name.clone(),
        access_token,
        refresh_token: tokens.refresh_token,
        expires_at,
        metadata: Some(json!({ "profile": profile })),
    })
}

async fn handle_tiktok_callback(
    _state: &AppState,
    code: &str,
    redirect_uri: &str,
    code_verifier: Option<&str>,
) -> ApiResult<OAuthConnectResult> {
    let client_key = env::var("TIKTOK_CLIENT_KEY").unwrap_or_default();
    let client_secret = env::var("TIKTOK_CLIENT_SECRET").unwrap_or_default();

    if client_key.is_empty() || client_secret.is_empty() {
        return Err(ApiError::BadRequest(
            "TikTok credentials are not configured".into(),
        ));
    }

    let mut body = format!(
        "client_key={}&client_secret={}&code={}&grant_type=authorization_code&redirect_uri={}",
        urlencoding::encode(&client_key),
        urlencoding::encode(&client_secret),
        urlencoding::encode(code),
        urlencoding::encode(redirect_uri),
    );
    if let Some(verifier) = code_verifier {
        body.push_str(&format!("&code_verifier={}", urlencoding::encode(verifier)));
    }

    let resp: Value = Client::new()
        .post("https://open.tiktokapis.com/v2/oauth/token/")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let token = parse_tiktok_token_response(&resp)?;
    let profile = fetch_tiktok_user_profile(&token.access_token).await?;

    let display_name = profile
        .display_name
        .as_deref()
        .or(profile.username.as_deref())
        .unwrap_or("TikTok Account");

    Ok(OAuthConnectResult {
        platform: "tiktok".into(),
        account_name: display_name.to_string(),
        external_id: token.open_id.clone().or(profile.open_id.clone()),
        username: profile.username.clone(),
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: token.expires_at,
        metadata: Some(json!({
            "open_id": token.open_id.or(profile.open_id),
            "union_id": profile.union_id,
            "avatar_url": profile.avatar_url,
            "username": profile.username,
            "scope": token.scope,
            "refresh_expires_at": token.refresh_expires_at.map(|d| d.to_rfc3339()),
        })),
    })
}

struct TikTokTokens {
    access_token: String,
    refresh_token: Option<String>,
    open_id: Option<String>,
    scope: Option<String>,
    expires_at: Option<DateTime<FixedOffset>>,
    refresh_expires_at: Option<DateTime<FixedOffset>>,
}

fn parse_tiktok_token_response(body: &Value) -> ApiResult<TikTokTokens> {
    if let Some(err) = body.get("error").and_then(|v| v.as_str()) {
        let desc = body
            .get("error_description")
            .and_then(|v| v.as_str())
            .unwrap_or(err);
        return Err(ApiError::BadRequest(desc.to_string()));
    }
    if let Some(code) = body
        .get("error")
        .and_then(|e| e.get("code"))
        .and_then(|c| c.as_str())
    {
        if code != "ok" {
            let msg = body
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or(code);
            return Err(ApiError::BadRequest(msg.to_string()));
        }
    }

    let token_obj = if body.get("access_token").is_some() {
        body
    } else {
        body.get("data")
            .ok_or_else(|| ApiError::BadRequest("TikTok token exchange failed".into()))?
    };

    let access_token = token_obj
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::BadRequest("TikTok token exchange failed".into()))?
        .to_string();

    let expires_at = token_obj
        .get("expires_in")
        .and_then(|v| v.as_i64())
        .map(|secs| (Utc::now() + Duration::seconds(secs)).fixed_offset());
    let refresh_expires_at = token_obj
        .get("refresh_expires_in")
        .and_then(|v| v.as_i64())
        .map(|secs| (Utc::now() + Duration::seconds(secs)).fixed_offset());

    Ok(TikTokTokens {
        access_token,
        refresh_token: token_obj
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        open_id: token_obj
            .get("open_id")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        scope: token_obj
            .get("scope")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        expires_at,
        refresh_expires_at,
    })
}

#[derive(Default, Deserialize)]
struct TikTokProfile {
    open_id: Option<String>,
    union_id: Option<String>,
    avatar_url: Option<String>,
    display_name: Option<String>,
    username: Option<String>,
}

async fn fetch_tiktok_user_profile(access_token: &str) -> ApiResult<TikTokProfile> {
    let body: Value = Client::new()
        .get("https://open.tiktokapis.com/v2/user/info/")
        .query(&[(
            "fields",
            "open_id,union_id,avatar_url,display_name,username",
        )])
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    if let Some(code) = body
        .get("error")
        .and_then(|e| e.get("code"))
        .and_then(|c| c.as_str())
    {
        if code != "ok" {
            return Ok(TikTokProfile::default());
        }
    }

    Ok(body
        .get("data")
        .and_then(|d| d.get("user"))
        .and_then(|u| serde_json::from_value(u.clone()).ok())
        .unwrap_or_default())
}

async fn debug_meta_token_scopes(state: &AppState, access_token: &str) -> ApiResult<Vec<String>> {
    let app_id =
        env::var("FACEBOOK_APP_ID").unwrap_or_else(|_| state.config.oauth.facebook_app_id.clone());
    let app_secret = env::var("FACEBOOK_APP_SECRET")
        .unwrap_or_else(|_| state.config.oauth.facebook_app_secret.clone());

    if app_id.is_empty() || app_secret.is_empty() {
        return Ok(vec![]);
    }

    let body: Value = Client::new()
        .get("https://graph.facebook.com/v19.0/debug_token")
        .query(&[
            ("input_token", access_token),
            ("access_token", &format!("{app_id}|{app_secret}")),
        ])
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    if !body
        .get("data")
        .and_then(|d| d.get("is_valid"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Ok(vec![]);
    }

    Ok(body
        .get("data")
        .and_then(|d| d.get("scopes"))
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default())
}

async fn list_whatsapp_phone_numbers(
    state: &AppState,
    access_token: &str,
) -> ApiResult<Vec<WhatsAppPhoneOption>> {
    let mut phones = Vec::new();
    let mut seen = std::collections::HashSet::new();

    let biz_body: Value = Client::new()
        .get("https://graph.facebook.com/v19.0/me/businesses")
        .query(&[("fields", "id,name"), ("access_token", access_token)])
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .unwrap_or(json!({}));

    if let Some(businesses) = biz_body.get("data").and_then(|d| d.as_array()) {
        for biz in businesses {
            let Some(biz_id) = biz.get("id").and_then(|v| v.as_str()) else {
                continue;
            };
            let waba_body: Value = match Client::new()
                .get(format!(
                    "https://graph.facebook.com/v19.0/{biz_id}/owned_whatsapp_business_accounts"
                ))
                .query(&[("fields", "id,name"), ("access_token", access_token)])
                .send()
                .await
            {
                Ok(resp) => resp.json().await.unwrap_or(json!({})),
                Err(_) => json!({}),
            };

            if let Some(wabas) = waba_body.get("data").and_then(|d| d.as_array()) {
                for waba in wabas {
                    let Some(waba_id) = waba.get("id").and_then(|v| v.as_str()) else {
                        continue;
                    };
                    let waba_name = waba.get("name").and_then(|v| v.as_str());
                    let waba_phones =
                        get_waba_phone_numbers(access_token, waba_id, waba_name).await?;
                    for phone in waba_phones {
                        if seen.insert(phone.id.clone()) {
                            phones.push(phone);
                        }
                    }
                }
            }
        }
    }

    if phones.is_empty() {
        let via_pages = list_whatsapp_phone_numbers_via_pages(state, access_token).await?;
        for phone in via_pages {
            if seen.insert(phone.id.clone()) {
                phones.push(phone);
            }
        }
    }

    Ok(phones)
}

async fn get_waba_phone_numbers(
    access_token: &str,
    waba_id: &str,
    waba_name: Option<&str>,
) -> ApiResult<Vec<WhatsAppPhoneOption>> {
    let body: Value = Client::new()
        .get(format!(
            "https://graph.facebook.com/v19.0/{waba_id}/phone_numbers"
        ))
        .query(&[
            ("fields", "id,display_phone_number,verified_name"),
            ("access_token", access_token),
        ])
        .send()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
        .json()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(body
        .get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|phone| {
                    Some(WhatsAppPhoneOption {
                        id: phone.get("id")?.as_str()?.to_string(),
                        display_phone_number: phone
                            .get("display_phone_number")
                            .and_then(|v| v.as_str())
                            .map(str::to_string),
                        verified_name: phone
                            .get("verified_name")
                            .and_then(|v| v.as_str())
                            .map(str::to_string),
                        waba_id: waba_id.to_string(),
                        waba_name: waba_name.map(str::to_string),
                    })
                })
                .collect()
        })
        .unwrap_or_default())
}

async fn list_whatsapp_phone_numbers_via_pages(
    state: &AppState,
    access_token: &str,
) -> ApiResult<Vec<WhatsAppPhoneOption>> {
    let mut phones = Vec::new();
    let pages = get_facebook_pages(state, access_token).await?;

    for page in pages {
        let page_token = page.access_token.as_deref().unwrap_or(access_token);
        let body: Value = match Client::new()
            .get(format!("https://graph.facebook.com/v19.0/{}", page.id))
            .query(&[
                (
                    "fields",
                    "whatsapp_business_account{id,name,phone_numbers{id,display_phone_number,verified_name}}",
                ),
                ("access_token", page_token),
            ])
            .send()
            .await
        {
            Ok(resp) => resp.json().await.unwrap_or(json!({})),
            Err(_) => json!({}),
        };

        let waba = body.get("whatsapp_business_account");
        let Some(waba) = waba else { continue };
        let waba_id = waba.get("id").and_then(|v| v.as_str()).unwrap_or_default();
        let waba_name = waba
            .get("name")
            .and_then(|v| v.as_str())
            .or(Some(page.name.as_str()));

        if let Some(data) = waba
            .get("phone_numbers")
            .and_then(|p| p.get("data"))
            .and_then(|d| d.as_array())
        {
            for phone in data {
                if let Some(id) = phone.get("id").and_then(|v| v.as_str()) {
                    phones.push(WhatsAppPhoneOption {
                        id: id.to_string(),
                        display_phone_number: phone
                            .get("display_phone_number")
                            .and_then(|v| v.as_str())
                            .map(str::to_string),
                        verified_name: phone
                            .get("verified_name")
                            .and_then(|v| v.as_str())
                            .map(str::to_string),
                        waba_id: waba_id.to_string(),
                        waba_name: waba_name.map(str::to_string),
                    });
                }
            }
        }
    }

    Ok(phones)
}

pub fn format_oauth_error(err: &ApiError) -> String {
    err.to_string()
}
