use axum::{routing::get, Json, Router};
use serde_json::{json, Value};
use std::env;

use crate::app_state::AppState;
use crate::common::ApiResult;

pub fn router() -> Router<AppState> {
    Router::new().route("/capabilities", get(capabilities))
}

async fn capabilities() -> ApiResult<Json<Value>> {
    let platform_configured = is_whatsapp_platform_enabled();
    let connection_mode = if platform_configured {
        "platform"
    } else {
        "oauth"
    };

    let display_name = env::var("WHATSAPP_PLATFORM_DISPLAY_NAME")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let display_phone = env::var("WHATSAPP_PLATFORM_DISPLAY_PHONE")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let platforms: Vec<Value> = platform_capabilities()
        .into_iter()
        .map(|mut p| {
            if p["id"] != "whatsapp" {
                return p;
            }

            if platform_configured {
                p["oauth"] = json!(false);
                p["notes"] = json!("Included with Mako  — enable for this workspace. No Meta Developer setup required for your clients.");
            } else {
                p["notes"] = json!("For businesses with their own Meta WhatsApp Business account. Your clients sign in with Meta — no Developer Console access needed on their side.");
            }

            p
        })
        .collect();

    Ok(Json(json!({
        "platforms": platforms,
        "whatsapp": {
            "connectionMode": connection_mode,
            "platformConfigured": platform_configured,
            "displayName": display_name,
            "displayPhone": display_phone,
        }
    })))
}

fn is_whatsapp_platform_enabled() -> bool {
    if env::var("WHATSAPP_PLATFORM_ENABLED").ok().as_deref() == Some("false") {
        return false;
    }

    let phone_number_id = env::var("WHATSAPP_PLATFORM_PHONE_NUMBER_ID")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let access_token = env::var("WHATSAPP_PLATFORM_ACCESS_TOKEN")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    if phone_number_id.is_some() && access_token.is_some() {
        return true;
    }

    env::var("WHATSAPP_PLATFORM_ENABLED").ok().as_deref() == Some("true")
}

fn platform_capabilities() -> Vec<Value> {
    vec![
        json!({
            "id": "facebook",
            "label": "Facebook",
            "connect": true,
            "publish": true,
            "comments": true,
            "messaging": true,
            "oauth": true,
            "status": "available",
        }),
        json!({
            "id": "instagram",
            "label": "Instagram",
            "connect": true,
            "publish": true,
            "comments": true,
            "messaging": true,
            "oauth": true,
            "status": "available",
            "notes": "Requires Instagram Business linked to a Facebook Page.",
        }),
        json!({
            "id": "linkedin",
            "label": "LinkedIn",
            "connect": true,
            "publish": true,
            "comments": false,
            "messaging": false,
            "oauth": true,
            "status": "available",
            "notes": "Publishing uses w_member_social. Comment sync/replies require LinkedIn Marketing API partner access (r_member_social), not included in standard OAuth.",
        }),
        json!({
            "id": "twitter",
            "label": "X / Twitter",
            "connect": true,
            "publish": true,
            "comments": false,
            "messaging": false,
            "oauth": false,
            "status": "available",
            "notes": "Manual OAuth 1.0a credentials required.",
        }),
        json!({
            "id": "whatsapp",
            "label": "WhatsApp",
            "connect": true,
            "publish": true,
            "comments": false,
            "messaging": true,
            "oauth": true,
            "status": "available",
            "notes": "Connect via Meta to pick a WhatsApp Business phone number.",
        }),
        json!({
            "id": "youtube",
            "label": "YouTube",
            "connect": true,
            "publish": true,
            "comments": true,
            "messaging": false,
            "oauth": true,
            "status": "available",
            "notes": "Upload videos via YouTube Data API v3. Requires a Google Cloud project with YouTube API enabled.",
        }),
        json!({
            "id": "tiktok",
            "label": "TikTok",
            "connect": true,
            "publish": true,
            "comments": false,
            "messaging": false,
            "oauth": true,
            "status": "available",
            "notes": "OAuth + Content Posting API. Unaudited apps may be limited to private posts until TikTok app review approves video.publish.",
        }),
        json!({
            "id": "google",
            "label": "Google",
            "connect": true,
            "publish": false,
            "comments": false,
            "messaging": false,
            "oauth": true,
            "status": "coming_soon",
        }),
        json!({
            "id": "email",
            "label": "Email",
            "connect": false,
            "publish": false,
            "comments": false,
            "messaging": false,
            "oauth": false,
            "status": "coming_soon",
            "notes": "Copy generation only — sending not yet integrated.",
        }),
        json!({
            "id": "ad_copy",
            "label": "Ad Copy",
            "connect": false,
            "publish": false,
            "comments": false,
            "messaging": false,
            "oauth": false,
            "status": "coming_soon",
            "notes": "Copy generation only.",
        }),
        json!({
            "id": "content",
            "label": "General",
            "connect": false,
            "publish": false,
            "comments": false,
            "messaging": false,
            "oauth": false,
            "status": "available",
            "notes": "Templates and AI generation only.",
        }),
    ]
}
