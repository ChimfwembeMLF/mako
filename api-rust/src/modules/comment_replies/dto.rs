use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateCommentReplyDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "contentId")]
    pub content_id: Uuid,
    pub platform: String,
    #[serde(rename = "externalCommentId")]
    pub external_comment_id: String,
    #[serde(rename = "externalPostId")]
    pub external_post_id: String,
    #[serde(rename = "commenterName")]
    pub commenter_name: String,
    #[serde(rename = "commenterAvatarUrl")]
    pub commenter_avatar_url: Option<String>,
    #[serde(rename = "commentText")]
    pub comment_text: String,
    #[serde(rename = "replyText")]
    pub reply_text: Option<String>,
    #[serde(rename = "replyType")]
    pub reply_type: Option<String>,
    pub status: Option<String>,
    #[serde(rename = "ruleId")]
    pub rule_id: Option<Uuid>,
    #[serde(rename = "sentAt")]
    pub sent_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "parentCommentId")]
    pub parent_comment_id: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateCommentReplyDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "contentId")]
    pub content_id: Option<Uuid>,
    pub platform: Option<String>,
    #[serde(rename = "externalCommentId")]
    pub external_comment_id: Option<String>,
    #[serde(rename = "externalPostId")]
    pub external_post_id: Option<String>,
    #[serde(rename = "commenterName")]
    pub commenter_name: Option<String>,
    #[serde(rename = "commenterAvatarUrl")]
    pub commenter_avatar_url: Option<String>,
    #[serde(rename = "commentText")]
    pub comment_text: Option<String>,
    #[serde(rename = "replyText")]
    pub reply_text: Option<String>,
    #[serde(rename = "replyType")]
    pub reply_type: Option<String>,
    pub status: Option<String>,
    #[serde(rename = "ruleId")]
    pub rule_id: Option<Uuid>,
    #[serde(rename = "sentAt")]
    pub sent_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "parentCommentId")]
    pub parent_comment_id: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
}

#[derive(Deserialize, Validate)]
pub struct FetchCommentsDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
}

#[derive(Deserialize, Validate)]
pub struct SendCommentReplyDto {
    pub message: String,
}
