use chrono::{Duration, Utc};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::{ApiError, ApiResult};
use crate::modules::profiles::entity::{Column as ProfileColumn, Entity as ProfileEntity};
use crate::modules::tenant_members::entity::{
    ActiveModel as MemberActiveModel, Column as MemberColumn, Entity as MemberEntity,
    Model as MemberModel,
};
use crate::modules::tenant_members::invitations::{
    ActiveModel as InvitationActiveModel, Column as InvitationColumn, Entity as InvitationEntity,
    Model as InvitationModel,
};
use crate::modules::tenants::entity::Entity as TenantEntity;
use crate::modules::users::entity::{Column as UserColumn, Entity as UserEntity};

const INVITE_TTL_DAYS: i64 = 7;

pub struct TenantMembersService;

impl TenantMembersService {
    pub async fn create(state: &AppState, dto: MemberActiveModel) -> ApiResult<MemberModel> {
        Ok(dto.insert(&state.db).await?)
    }

    pub async fn find_all(
        state: &AppState,
        tenant_id: Option<Uuid>,
    ) -> ApiResult<Vec<MemberModel>> {
        let rows = if let Some(tenant_id) = tenant_id {
            MemberEntity::find()
                .filter(MemberColumn::TenantId.eq(tenant_id))
                .order_by_asc(MemberColumn::JoinedAt)
                .all(&state.db)
                .await?
        } else {
            MemberEntity::find().all(&state.db).await?
        };
        Ok(rows)
    }

    pub async fn find_for_user(state: &AppState, user_id: Uuid) -> ApiResult<Vec<MemberModel>> {
        Ok(MemberEntity::find()
            .filter(MemberColumn::UserId.eq(user_id))
            .filter(MemberColumn::IsActive.eq(true))
            .all(&state.db)
            .await?)
    }

    pub async fn find_one(state: &AppState, id: Uuid) -> ApiResult<MemberModel> {
        MemberEntity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("TenantMembers not found".into()))
    }

    pub async fn list_by_tenant(
        state: &AppState,
        tenant_id: Uuid,
    ) -> ApiResult<Vec<serde_json::Value>> {
        let members = MemberEntity::find()
            .filter(MemberColumn::TenantId.eq(tenant_id))
            .filter(MemberColumn::IsActive.eq(true))
            .order_by_asc(MemberColumn::JoinedAt)
            .all(&state.db)
            .await?;

        let mut rows = Vec::with_capacity(members.len());
        for member in members {
            rows.push(detailed_member_row(state, &member, "active").await?);
        }

        let now = Utc::now().fixed_offset();
        let pending = InvitationEntity::find()
            .filter(InvitationColumn::TenantId.eq(tenant_id))
            .filter(InvitationColumn::Status.eq("pending"))
            .filter(InvitationColumn::ExpiresAt.gt(now))
            .order_by_desc(InvitationColumn::CreatedAt)
            .all(&state.db)
            .await?;

        for inv in pending {
            rows.push(serde_json::json!({
                "id": inv.id,
                "tenantId": inv.tenant_id,
                "userId": null,
                "roleId": inv.role_id,
                "isActive": false,
                "joinedAt": inv.created_at,
                "status": "pending",
                "profile": {
                    "fullName": null,
                    "displayName": null,
                    "email": inv.email,
                    "avatarUrl": null,
                }
            }));
        }

        Ok(rows)
    }

    pub async fn invite(
        state: &AppState,
        email: &str,
        tenant_id: Uuid,
        role_id: Uuid,
        invited_by: Uuid,
    ) -> ApiResult<serde_json::Value> {
        let email = normalize_email(email);
        let now = Utc::now().fixed_offset();

        if let Some(user) = UserEntity::find()
            .filter(UserColumn::Email.eq(email.clone()))
            .one(&state.db)
            .await?
        {
            if let Some(existing) = MemberEntity::find()
                .filter(MemberColumn::TenantId.eq(tenant_id))
                .filter(MemberColumn::UserId.eq(user.id))
                .one(&state.db)
                .await?
            {
                if existing.is_active {
                    return Err(ApiError::BadRequest(
                        "User is already a member of this workspace".into(),
                    ));
                }

                let mut active: MemberActiveModel = existing.into();
                active.is_active = Set(true);
                active.role_id = Set(role_id);
                active.invited_by = Set(invited_by);
                active.joined_at = Set(now);
                let member = active.update(&state.db).await?;
                revoke_pending_invitations(state, &email, tenant_id).await?;
                return Ok(serde_json::json!({
                    "message": "Member re-activated",
                    "member": member_json(&member),
                }));
            }

            let member = MemberActiveModel {
                id: Set(Uuid::new_v4()),
                tenant_id: Set(tenant_id),
                user_id: Set(user.id),
                role_id: Set(role_id),
                is_active: Set(true),
                invited_by: Set(invited_by),
                joined_at: Set(now),
            }
            .insert(&state.db)
            .await?;

            revoke_pending_invitations(state, &email, tenant_id).await?;
            return Ok(serde_json::json!({
                "message": "Member added successfully",
                "member": member_json(&member),
            }));
        }

        let expires_at = now + Duration::days(INVITE_TTL_DAYS);
        let invitation = if let Some(pending) = InvitationEntity::find()
            .filter(InvitationColumn::TenantId.eq(tenant_id))
            .filter(InvitationColumn::Email.eq(email.clone()))
            .filter(InvitationColumn::Status.eq("pending"))
            .one(&state.db)
            .await?
        {
            let mut active: InvitationActiveModel = pending.into();
            active.role_id = Set(role_id);
            active.invited_by = Set(invited_by);
            active.expires_at = Set(expires_at);
            active.update(&state.db).await?
        } else {
            InvitationActiveModel {
                id: Set(Uuid::new_v4()),
                tenant_id: Set(tenant_id),
                email: Set(email.clone()),
                role_id: Set(role_id),
                invited_by: Set(invited_by),
                status: Set("pending".to_string()),
                expires_at: Set(expires_at),
                accepted_at: Set(None),
                created_at: Set(now),
            }
            .insert(&state.db)
            .await?
        };

        let tenant_name = TenantEntity::find_by_id(tenant_id)
            .one(&state.db)
            .await?
            .map(|t| t.name)
            .unwrap_or_else(|| "Workspace".to_string());

        let signup_link = format!(
            "{}/auth?email={}",
            state.config.oauth.frontend_url,
            urlencoding::encode(&email)
        );
        crate::modules::mail::MailService::send_workspace_invite_email(
            state,
            &email,
            &tenant_name,
            &signup_link,
        )
        .await?;

        Ok(serde_json::json!({
            "message": "Invitation sent — they can register or sign in with this email to join.",
            "invitation": invitation_json(&invitation),
            "pending": true,
        }))
    }

    pub async fn revoke_invitation(state: &AppState, id: Uuid, tenant_id: Uuid) -> ApiResult<()> {
        let inv = InvitationEntity::find()
            .filter(InvitationColumn::Id.eq(id))
            .filter(InvitationColumn::TenantId.eq(tenant_id))
            .filter(InvitationColumn::Status.eq("pending"))
            .one(&state.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("Invitation not found".into()))?;

        let mut active: InvitationActiveModel = inv.into();
        active.status = Set("revoked".to_string());
        active.update(&state.db).await?;
        Ok(())
    }

    pub async fn accept_pending_invitations(
        state: &AppState,
        user_id: Uuid,
        email: &str,
    ) -> ApiResult<u32> {
        let email = normalize_email(email);
        let now = Utc::now().fixed_offset();
        let pending = InvitationEntity::find()
            .filter(InvitationColumn::Email.eq(email))
            .filter(InvitationColumn::Status.eq("pending"))
            .filter(InvitationColumn::ExpiresAt.gt(now))
            .all(&state.db)
            .await?;

        let mut accepted = 0u32;
        for inv in pending {
            if let Some(existing) = MemberEntity::find()
                .filter(MemberColumn::TenantId.eq(inv.tenant_id))
                .filter(MemberColumn::UserId.eq(user_id))
                .one(&state.db)
                .await?
            {
                if !existing.is_active {
                    let mut active: MemberActiveModel = existing.into();
                    active.is_active = Set(true);
                    active.role_id = Set(inv.role_id);
                    active.invited_by = Set(inv.invited_by);
                    active.joined_at = Set(now);
                    active.update(&state.db).await?;
                }
            } else {
                MemberActiveModel {
                    id: Set(Uuid::new_v4()),
                    tenant_id: Set(inv.tenant_id),
                    user_id: Set(user_id),
                    role_id: Set(inv.role_id),
                    is_active: Set(true),
                    invited_by: Set(inv.invited_by),
                    joined_at: Set(now),
                }
                .insert(&state.db)
                .await?;
            }

            let mut inv_active: InvitationActiveModel = inv.into();
            inv_active.status = Set("accepted".to_string());
            inv_active.accepted_at = Set(Some(now));
            inv_active.update(&state.db).await?;
            accepted += 1;
        }

        Ok(accepted)
    }

    pub async fn update(
        state: &AppState,
        id: Uuid,
        patch: UpdateMemberPatch,
    ) -> ApiResult<MemberModel> {
        let member = Self::find_one(state, id).await?;
        let mut active: MemberActiveModel = member.into();

        if let Some(tenant_id) = patch.tenant_id {
            active.tenant_id = Set(tenant_id);
        }
        if let Some(user_id) = patch.user_id {
            active.user_id = Set(user_id);
        }
        if let Some(role_id) = patch.role_id {
            active.role_id = Set(role_id);
        }
        if let Some(is_active) = patch.is_active {
            active.is_active = Set(is_active);
        }
        if let Some(invited_by) = patch.invited_by {
            active.invited_by = Set(invited_by);
        }
        if let Some(joined_at) = patch.joined_at {
            active.joined_at = Set(joined_at);
        }

        Ok(active.update(&state.db).await?)
    }

    pub async fn remove(state: &AppState, id: Uuid) -> ApiResult<()> {
        let result = MemberEntity::delete_by_id(id).exec(&state.db).await?;
        if result.rows_affected == 0 {
            return Err(ApiError::NotFound("TenantMembers not found".into()));
        }
        Ok(())
    }
}

pub struct UpdateMemberPatch {
    pub tenant_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub role_id: Option<Uuid>,
    pub is_active: Option<bool>,
    pub invited_by: Option<Uuid>,
    pub joined_at: Option<chrono::DateTime<chrono::FixedOffset>>,
}

fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

async fn revoke_pending_invitations(
    state: &AppState,
    email: &str,
    tenant_id: Uuid,
) -> ApiResult<()> {
    let pending = InvitationEntity::find()
        .filter(InvitationColumn::TenantId.eq(tenant_id))
        .filter(InvitationColumn::Email.eq(email))
        .filter(InvitationColumn::Status.eq("pending"))
        .all(&state.db)
        .await?;

    for inv in pending {
        let mut active: InvitationActiveModel = inv.into();
        active.status = Set("revoked".to_string());
        active.update(&state.db).await?;
    }
    Ok(())
}

async fn detailed_member_row(
    state: &AppState,
    member: &MemberModel,
    status: &str,
) -> ApiResult<serde_json::Value> {
    let profile = ProfileEntity::find()
        .filter(ProfileColumn::UserId.eq(member.user_id))
        .one(&state.db)
        .await?;

    let user = UserEntity::find_by_id(member.user_id)
        .one(&state.db)
        .await?;

    let profile_json = if let Some(p) = profile {
        serde_json::json!({
            "fullName": p.full_name,
            "displayName": p.display_name,
            "email": user.as_ref().and_then(|u| u.email.clone()),
            "avatarUrl": p.avatar_url,
        })
    } else {
        serde_json::json!({
            "fullName": null,
            "displayName": null,
            "email": user.as_ref().and_then(|u| u.email.clone()),
            "avatarUrl": null,
        })
    };

    Ok(serde_json::json!({
        "id": member.id,
        "tenantId": member.tenant_id,
        "userId": member.user_id,
        "roleId": member.role_id,
        "isActive": member.is_active,
        "joinedAt": member.joined_at,
        "status": status,
        "profile": profile_json,
    }))
}

pub fn member_json(member: &MemberModel) -> serde_json::Value {
    serde_json::json!({
        "id": member.id,
        "tenantId": member.tenant_id,
        "userId": member.user_id,
        "roleId": member.role_id,
        "isActive": member.is_active,
        "invitedBy": member.invited_by,
        "joinedAt": member.joined_at,
    })
}

fn invitation_json(inv: &InvitationModel) -> serde_json::Value {
    serde_json::json!({
        "id": inv.id,
        "tenantId": inv.tenant_id,
        "email": inv.email,
        "roleId": inv.role_id,
        "invitedBy": inv.invited_by,
        "status": inv.status,
        "expiresAt": inv.expires_at,
        "acceptedAt": inv.accepted_at,
        "created_at": inv.created_at,
    })
}
