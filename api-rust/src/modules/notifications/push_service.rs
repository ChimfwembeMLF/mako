use crate::app_state::AppState;
use crate::common::ApiResult;
use reqwest::Client;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use serde_json::json;
use uuid::Uuid;

pub async fn send_expo_push_notification(
    state: &AppState,
    user_id: Uuid,
    title: &str,
    body: &str,
    url: Option<&str>,
) -> ApiResult<()> {
    // 1. Get push tokens for the user
    use crate::modules::users::device_push_token_entity::{Column as PushTokenColumn, Entity as PushTokenEntity};

    let tokens = PushTokenEntity::find()
        .filter(PushTokenColumn::UserId.eq(user_id))
        .all(&state.db)
        .await?;

    if tokens.is_empty() {
        return Ok(());
    }

    let expo_tokens: Vec<String> = tokens.into_iter().map(|t| t.token).collect();

    // 2. Prepare payload
    let mut message = json!({
        "to": expo_tokens,
        "title": title,
        "body": body,
        "sound": "default",
    });

    if let Some(u) = url {
        message["data"] = json!({ "url": u });
    }

    // 3. Send via reqwest
    let client = Client::new();
    let res = client
        .post("https://exp.host/--/api/v2/push/send")
        .json(&message)
        .send()
        .await;

    if let Err(e) = res {
        tracing::error!("Failed to send expo push notification: {}", e);
    }

    Ok(())
}
