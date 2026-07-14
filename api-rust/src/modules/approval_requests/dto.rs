use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateApprovalRequestDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "actionKey")]
    pub action_key: String,
    #[serde(rename = "resourceType")]
    pub resource_type: String,
    #[serde(rename = "resourceId")]
    pub resource_id: Uuid,
    pub payload: Option<String>,
    #[serde(rename = "requestedBy")]
    pub requested_by: Uuid,
    #[serde(rename = "reviewedBy")]
    pub reviewed_by: Option<Uuid>,
    pub status: String,
    #[serde(rename = "requesterNotes")]
    pub requester_notes: Option<String>,
    #[serde(rename = "reviewerNotes")]
    pub reviewer_notes: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "reviewedAt")]
    pub reviewed_at: Option<DateTime<FixedOffset>>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateApprovalRequestDto {
    #[serde(rename = "actionKey")]
    pub action_key: Option<String>,
    #[serde(rename = "resourceType")]
    pub resource_type: Option<String>,
    #[serde(rename = "resourceId")]
    pub resource_id: Option<Uuid>,
    pub payload: Option<String>,
    #[serde(rename = "reviewedBy")]
    pub reviewed_by: Option<Uuid>,
    pub status: Option<String>,
    #[serde(rename = "requesterNotes")]
    pub requester_notes: Option<String>,
    #[serde(rename = "reviewerNotes")]
    pub reviewer_notes: Option<String>,
    #[serde(rename = "reviewedAt")]
    pub reviewed_at: Option<DateTime<FixedOffset>>,
}
