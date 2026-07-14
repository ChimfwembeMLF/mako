pub mod dto;
pub mod entity;
pub mod service;

use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde_json::{json, Value};

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::ApiResult;
use crate::modules::users::dto::PageOptionsDto;
use crate::modules::users::entity::Model as UserModel;
use crate::modules::users::service::UsersService;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(list_users))
}

async fn list_users(
    AuthUser { .. }: AuthUser,
    State(state): State<AppState>,
    Query(page_options): Query<PageOptionsDto>,
) -> ApiResult<Json<Value>> {
    let (item_count, users) = UsersService::get_users(&state, &page_options).await?;
    let page = page_options.page();
    let take = page_options.take();
    let page_count = if item_count == 0 {
        0
    } else {
        item_count.div_ceil(take)
    };

    Ok(Json(json!({
        "success": true,
        "message": "Users retrieved successfully",
        "data": users.iter().map(user_dto_json).collect::<Vec<_>>(),
        "metaData": {
            "page": page,
            "take": take,
            "itemCount": item_count,
            "pageCount": page_count,
            "hasPreviousPage": page > 1,
            "hasNextPage": page < page_count,
        }
    })))
}

fn user_dto_json(user: &UserModel) -> Value {
    json!({
        "id": user.id,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "role": user.role,
        "email": user.email,
        "avatar": user.avatar,
        "phone": user.phone,
        "createdAt": user.created_at,
    })
}
