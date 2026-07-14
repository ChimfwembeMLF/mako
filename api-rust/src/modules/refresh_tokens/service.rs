use chrono::{Duration, Utc};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::refresh_tokens::entity::{
    ActiveModel as RefreshTokenActiveModel, Column as RefreshTokenColumn,
    Entity as RefreshTokenEntity,
};

pub struct RefreshTokenService;

impl RefreshTokenService {
    fn hash_token(token: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub async fn save(state: &AppState, user_id: Uuid, refresh_token: &str) -> ApiResult<()> {
        Self::revoke(state, user_id).await?;
        let now = Utc::now().fixed_offset();
        RefreshTokenActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id),
            token_hash: Set(Self::hash_token(refresh_token)),
            expires_at: Set(now + Duration::seconds(state.config.refresh_expiry_secs as i64)),
            created_at: Set(now),
        }
        .insert(&state.db)
        .await?;
        Ok(())
    }

    pub async fn is_valid(state: &AppState, user_id: Uuid, refresh_token: &str) -> ApiResult<bool> {
        let record = RefreshTokenEntity::find()
            .filter(RefreshTokenColumn::UserId.eq(user_id))
            .one(&state.db)
            .await?;

        let Some(record) = record else {
            return Ok(false);
        };

        let now = Utc::now().fixed_offset();
        if record.expires_at < now {
            RefreshTokenEntity::delete_by_id(record.id)
                .exec(&state.db)
                .await?;
            return Ok(false);
        }

        Ok(record.token_hash == Self::hash_token(refresh_token))
    }

    pub async fn revoke(state: &AppState, user_id: Uuid) -> ApiResult<()> {
        RefreshTokenEntity::delete_many()
            .filter(RefreshTokenColumn::UserId.eq(user_id))
            .exec(&state.db)
            .await?;
        Ok(())
    }
}
