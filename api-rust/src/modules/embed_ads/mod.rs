use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Redirect, Response},
    routing::get,
    Router,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};

use crate::app_state::AppState;
use crate::modules::ads::entity::{
    CampaignActiveModel, CampaignColumn, CampaignEntity, CreativeColumn, CreativeEntity,
};

const STATUS_ACTIVE: &str = "ACTIVE";

pub fn router() -> Router<AppState> {
    Router::new()
        // Axum allows one param per segment — capture "id.js" via wildcard (Nest: widget/:id.js)
        .route("/widget/{*rest}", get(serve_widget))
        .route("/click/{id}", get(track_click))
}

async fn serve_widget(State(state): State<AppState>, Path(rest): Path<String>) -> Response {
    let Some(platform_campaign_id) = rest.strip_suffix(".js") else {
        return (
            StatusCode::NOT_FOUND,
            [(header::CONTENT_TYPE, "application/javascript")],
            r#"console.error("Ad widget path must end with .js");"#,
        )
            .into_response();
    };
    let campaign = match CampaignEntity::find()
        .filter(CampaignColumn::PlatformCampaignId.eq(platform_campaign_id))
        .one(&state.db)
        .await
    {
        Ok(Some(c)) if c.status == STATUS_ACTIVE => c,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                [(header::CONTENT_TYPE, "application/javascript")],
                r#"console.error("Ad not found or inactive");"#,
            )
                .into_response();
        }
    };

    let creative = match CreativeEntity::find()
        .filter(CreativeColumn::CampaignId.eq(campaign.id))
        .one(&state.db)
        .await
    {
        Ok(Some(c)) => c,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                [(header::CONTENT_TYPE, "application/javascript")],
                r#"console.error("Ad creative not found");"#,
            )
                .into_response();
        }
    };

    let impressions = campaign.native_impressions + 1;
    let mut active: CampaignActiveModel = campaign.into();
    active.native_impressions = Set(impressions);
    let _ = active.update(&state.db).await;

    let api_base = std::env::var("API_PUBLIC_URL")
        .or_else(|_| std::env::var("APP_URL"))
        .unwrap_or_else(|_| format!("http://localhost:{}", state.config.port));

    let redirect_url = format!("{api_base}/embed-ads/click/{platform_campaign_id}");
    let headline = serde_json::to_string(&creative.headline).unwrap_or_default();
    let body = serde_json::to_string(&creative.body).unwrap_or_default();

    let js_content = format!(
        r#"(function() {{
  var container = document.createElement('div');
  container.style.cssText = 'font-family: system-ui, sans-serif; max-width: 728px; margin: 20px auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; cursor: pointer;';
  container.onclick = function() {{ window.open('{redirect_url}', '_blank'); }};
  var headline = document.createElement('h3');
  headline.innerText = {headline};
  var body = document.createElement('p');
  body.innerText = {body};
  container.appendChild(headline);
  container.appendChild(body);
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  if (currentScript && currentScript.parentNode) {{
    currentScript.parentNode.insertBefore(container, currentScript.nextSibling);
  }}
}})();"#
    );

    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/javascript")],
        js_content,
    )
        .into_response()
}

async fn track_click(
    State(state): State<AppState>,
    Path(platform_campaign_id): Path<String>,
) -> Response {
    let campaign = match CampaignEntity::find()
        .filter(CampaignColumn::PlatformCampaignId.eq(&platform_campaign_id))
        .one(&state.db)
        .await
    {
        Ok(Some(c)) if c.status == STATUS_ACTIVE => c,
        _ => {
            return (StatusCode::NOT_FOUND, "Ad not found or inactive").into_response();
        }
    };

    let mut active: CampaignActiveModel = campaign.clone().into();
    active.native_clicks = Set(campaign.native_clicks + 1);
    let _ = active.update(&state.db).await;

    let target = campaign
        .target_url
        .unwrap_or_else(|| "https://google.com".into());

    Redirect::temporary(&target).into_response()
}
