pub mod dto;
pub mod entity;
pub mod invitations;
pub mod service;

use axum::{
    extract::{Path, Query, State},
    routing::{delete, get, post},
    Json, Router,
};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::app_state::AppState;
use crate::common::guards::AuthUser;
use crate::common::{ApiError, ApiResult};
use crate::modules::tenant_members::entity::ActiveModel as MemberActiveModel;
use crate::modules::tenant_members::entity::{Column as MemberColumn, Entity as MemberEntity};

use self::dto::{CreateMemberDto, InviteMemberDto, UpdateMemberDto};
use self::service::{member_json, UpdateMemberPatch};
pub use service::TenantMembersService;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/invite", post(invite))
        .route("/me", get(find_mine))
        .route("/invitations/{id}", delete(revoke_invitation))
        .route("/", post(create).get(find_all))
        .route("/{id}", get(find_one).patch(update).delete(remove))
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Option<Uuid>,
    detailed: Option<String>,
}

#[derive(Deserialize)]
struct RevokeQuery {
    #[serde(rename = "tenantId")]
    tenant_id: Uuid,
}

async fn invite(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<InviteMemberDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    assert_tenant_access(&state, id, payload.tenant_id).await?;

    let result = TenantMembersService::invite(
        &state,
        &payload.email,
        payload.tenant_id,
        payload.role_id,
        id,
    )
    .await?;

    Ok(Json(result))
}

async fn create(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateMemberDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    assert_tenant_access(&state, id, payload.tenant_id).await?;

    let member = MemberActiveModel {
        id: Set(Uuid::new_v4()),
        tenant_id: Set(payload.tenant_id),
        user_id: Set(payload.user_id),
        role_id: Set(payload.role_id),
        is_active: Set(payload.is_active),
        invited_by: Set(payload.invited_by),
        joined_at: Set(payload.joined_at),
    };

    let saved = TenantMembersService::create(&state, member).await?;
    Ok(Json(member_json(&saved)))
}

async fn find_all(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> ApiResult<Json<Value>> {
    if let Some(tenant_id) = query.tenant_id {
        assert_tenant_access(&state, id, tenant_id).await?;
        if query.detailed.as_deref() == Some("true") {
            let rows = TenantMembersService::list_by_tenant(&state, tenant_id).await?;
            return Ok(Json(json!(rows)));
        }
        let rows = TenantMembersService::find_all(&state, Some(tenant_id)).await?;
        return Ok(Json(json!(rows
            .iter()
            .map(member_json)
            .collect::<Vec<_>>())));
    }

    let rows = TenantMembersService::find_all(&state, None).await?;
    Ok(Json(json!(rows
        .iter()
        .map(member_json)
        .collect::<Vec<_>>())))
}

async fn find_mine(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Value>> {
    let rows = TenantMembersService::find_for_user(&state, id).await?;
    Ok(Json(json!(rows
        .iter()
        .map(member_json)
        .collect::<Vec<_>>())))
}

async fn find_one(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(member_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let member = TenantMembersService::find_one(&state, member_id).await?;
    assert_tenant_access(&state, id, member.tenant_id).await?;
    Ok(Json(member_json(&member)))
}

async fn update(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(member_id): Path<Uuid>,
    Json(payload): Json<UpdateMemberDto>,
) -> ApiResult<Json<Value>> {
    payload
        .validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let member = TenantMembersService::find_one(&state, member_id).await?;
    assert_tenant_access(&state, id, member.tenant_id).await?;

    let updated = TenantMembersService::update(
        &state,
        member_id,
        UpdateMemberPatch {
            tenant_id: payload.tenant_id,
            user_id: payload.user_id,
            role_id: payload.role_id,
            is_active: payload.is_active,
            invited_by: payload.invited_by,
            joined_at: payload.joined_at,
        },
    )
    .await?;

    Ok(Json(member_json(&updated)))
}

async fn revoke_invitation(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(invitation_id): Path<Uuid>,
    Query(query): Query<RevokeQuery>,
) -> ApiResult<Json<Value>> {
    assert_tenant_access(&state, id, query.tenant_id).await?;
    TenantMembersService::revoke_invitation(&state, invitation_id, query.tenant_id).await?;
    Ok(Json(json!({ "success": true })))
}

async fn remove(
    AuthUser { id, .. }: AuthUser,
    State(state): State<AppState>,
    Path(member_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let member = TenantMembersService::find_one(&state, member_id).await?;
    assert_tenant_access(&state, id, member.tenant_id).await?;
    TenantMembersService::remove(&state, member_id).await?;
    Ok(Json(json!({ "success": true })))
}

async fn assert_tenant_access(state: &AppState, user_id: Uuid, tenant_id: Uuid) -> ApiResult<()> {
    let allowed = MemberEntity::find()
        .filter(MemberColumn::TenantId.eq(tenant_id))
        .filter(MemberColumn::UserId.eq(user_id))
        .filter(MemberColumn::IsActive.eq(true))
        .one(&state.db)
        .await?
        .is_some();

    if allowed {
        Ok(())
    } else {
        Err(ApiError::Forbidden(
            "You are not a member of this workspace".into(),
        ))
    }
}
