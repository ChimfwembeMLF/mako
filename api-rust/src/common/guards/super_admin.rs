use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use serde_json::json;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::modules::profiles::entity::{Column as ProfileColumn, Entity as ProfileEntity};
use crate::modules::users::entity::Entity as UserEntity;

pub struct SuperAdminUser {
    #[allow(dead_code)]
    pub id: Uuid,
}

impl FromRequestParts<AppState> for SuperAdminUser {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let AuthUser { id, .. } = AuthUser::from_request_parts(parts, state)
            .await
            .map_err(|r| r)?;

        let profile = ProfileEntity::find()
            .filter(ProfileColumn::UserId.eq(id))
            .one(&state.db)
            .await
            .map_err(|_| forbidden("Super admin access required"))?;

        let user = UserEntity::find_by_id(id)
            .one(&state.db)
            .await
            .map_err(|_| forbidden("Super admin access required"))?;

        let is_super = profile
            .as_ref()
            .and_then(|p| p.is_system_admin)
            .unwrap_or(false)
            || user
                .as_ref()
                .map(|u| u.role == "SUPER_ADMIN")
                .unwrap_or(false);

        if !is_super {
            return Err(forbidden("Super admin access required"));
        }

        Ok(SuperAdminUser { id })
    }
}

fn forbidden(message: &str) -> Response {
    (
        StatusCode::FORBIDDEN,
        Json(json!({
            "success": false,
            "statusCode": 403,
            "error": message,
        })),
    )
        .into_response()
}
