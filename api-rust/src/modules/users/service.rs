use chrono::{DateTime, Utc};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, Order, PaginatorTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::token_crypto::{decrypt_token, encrypt_token};
use crate::common::{ApiError, ApiResult};
use crate::modules::users::dto::PageOptionsDto;
use crate::modules::users::entity::{
    ActiveModel as UserActiveModel, Column as UserColumn, Entity as UserEntity, Model as UserModel,
};

pub struct GoogleOAuthTokensInput {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

pub struct GoogleOAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

pub struct SocialUserInput {
    pub provider: String,
    pub provider_id: Option<String>,
    pub email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub avatar: Option<String>,
    pub is_registered_with_google: bool,
    pub is_registered_with_facebook: bool,
    pub is_registered_with_linkedin: bool,
    pub is_registered_with_instagram: bool,
}

pub struct UsersService;

impl UsersService {
    pub async fn find_by_email(state: &AppState, email: &str) -> ApiResult<Option<UserModel>> {
        Ok(UserEntity::find()
            .filter(UserColumn::Email.eq(email))
            .one(&state.db)
            .await?)
    }

    pub async fn find_by_provider(
        state: &AppState,
        provider: &str,
        provider_id: &str,
    ) -> ApiResult<Option<UserModel>> {
        Ok(UserEntity::find()
            .filter(UserColumn::Provider.eq(provider))
            .filter(UserColumn::ProviderId.eq(provider_id))
            .one(&state.db)
            .await?)
    }

    pub async fn find_by_id(state: &AppState, id: Uuid) -> ApiResult<Option<UserModel>> {
        Ok(UserEntity::find_by_id(id).one(&state.db).await?)
    }

    pub async fn get_users(
        state: &AppState,
        page_options: &PageOptionsDto,
    ) -> ApiResult<(u64, Vec<UserModel>)> {
        let page = page_options.page();
        let take = page_options.take();
        let order = if page_options.order_desc() {
            Order::Desc
        } else {
            Order::Asc
        };

        let paginator = UserEntity::find()
            .order_by(UserColumn::CreatedAt, order)
            .paginate(&state.db, take);

        let item_count = paginator.num_items().await?;
        let data = paginator.fetch_page(page - 1).await?;

        Ok((item_count, data))
    }

    pub async fn create_social_user(
        state: &AppState,
        input: SocialUserInput,
    ) -> ApiResult<UserModel> {
        let now = Utc::now().fixed_offset();
        Ok(UserActiveModel {
            id: Set(Uuid::new_v4()),
            email: Set(input.email),
            first_name: Set(input.first_name),
            last_name: Set(input.last_name),
            avatar: Set(input.avatar),
            provider: Set(input.provider),
            provider_id: Set(input.provider_id),
            role: Set("USER".to_string()),
            is_registered_with_google: Set(Some(input.is_registered_with_google)),
            is_registered_with_facebook: Set(Some(input.is_registered_with_facebook)),
            is_registered_with_linked_in: Set(Some(input.is_registered_with_linkedin)),
            is_registered_with_instagram: Set(Some(input.is_registered_with_instagram)),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&state.db)
        .await?)
    }

    pub async fn update_password(
        state: &AppState,
        user_id: Uuid,
        hashed_password: String,
    ) -> ApiResult<()> {
        let user = UserEntity::find_by_id(user_id)
            .one(&state.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("User not found".into()))?;

        let mut active: UserActiveModel = user.into();
        active.password = Set(Some(hashed_password));
        active.updated_at = Set(Utc::now().fixed_offset());
        active.update(&state.db).await?;
        Ok(())
    }

    pub async fn update_google_oauth_tokens(
        state: &AppState,
        user_id: Uuid,
        tokens: GoogleOAuthTokensInput,
    ) -> ApiResult<()> {
        let user = UserEntity::find_by_id(user_id)
            .one(&state.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("User not found".into()))?;

        let mut active: UserActiveModel = user.into();
        active.google_access_token_enc = Set(Some(encrypt_token(&tokens.access_token)?));
        active.google_token_expires_at = Set(tokens.expires_at.map(|dt| dt.fixed_offset()));
        if let Some(refresh) = tokens.refresh_token {
            active.google_refresh_token_enc = Set(Some(encrypt_token(&refresh)?));
        }
        active.updated_at = Set(Utc::now().fixed_offset());
        active.update(&state.db).await?;
        Ok(())
    }

    pub async fn get_google_oauth_tokens(
        state: &AppState,
        user_id: Uuid,
    ) -> ApiResult<Option<GoogleOAuthTokens>> {
        let user = UserEntity::find_by_id(user_id)
            .one(&state.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("User not found".into()))?;

        let access_enc = match user.google_access_token_enc {
            Some(v) => v,
            None => return Ok(None),
        };

        Ok(Some(GoogleOAuthTokens {
            access_token: decrypt_token(&access_enc)?,
            refresh_token: user
                .google_refresh_token_enc
                .as_ref()
                .map(|enc| decrypt_token(enc))
                .transpose()?,
            expires_at: user
                .google_token_expires_at
                .map(|dt| dt.with_timezone(&Utc)),
        }))
    }

    pub async fn clear_google_oauth_tokens(state: &AppState, user_id: Uuid) -> ApiResult<()> {
        let user = UserEntity::find_by_id(user_id)
            .one(&state.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("User not found".into()))?;

        let mut active: UserActiveModel = user.into();
        active.google_access_token_enc = Set(None);
        active.google_refresh_token_enc = Set(None);
        active.google_token_expires_at = Set(None);
        active.updated_at = Set(Utc::now().fixed_offset());
        active.update(&state.db).await?;
        Ok(())
    }
}
