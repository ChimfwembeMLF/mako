use chrono::{DateTime, FixedOffset};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct CreateBrandProfileDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    #[serde(rename = "brandType")]
    pub brand_type: Option<String>,
    #[serde(rename = "companyName")]
    pub company_name: Option<String>,
    pub industry: Option<String>,
    pub description: Option<String>,
    pub services: Option<String>,
    #[serde(rename = "targetAudience")]
    pub target_audience: Option<String>,
    #[serde(rename = "audiencePainPoints")]
    pub audience_pain_points: Option<String>,
    #[serde(rename = "toneOfVoice")]
    pub tone_of_voice: Option<String>,
    #[serde(rename = "brandPersonality")]
    pub brand_personality: Option<String>,
    #[serde(rename = "currentOffers")]
    pub current_offers: Option<String>,
    #[serde(rename = "uniqueSellingPoints")]
    pub unique_selling_points: Option<String>,
    pub faqs: Option<String>,
    #[serde(rename = "caseStudies")]
    pub case_studies: Option<String>,
    #[serde(rename = "bannedWords")]
    pub banned_words: Option<String>,
    #[serde(rename = "bannedTopics")]
    pub banned_topics: Option<String>,
    pub competitors: Option<String>,
    pub keywords: Option<String>,
    #[serde(rename = "websiteUrl")]
    pub website_url: Option<String>,
}

#[derive(Deserialize, Validate)]
pub struct UpdateBrandProfileDto {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "userId")]
    pub user_id: Option<Uuid>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<Uuid>,
    #[serde(rename = "brandType")]
    pub brand_type: Option<String>,
    #[serde(rename = "companyName")]
    pub company_name: Option<String>,
    pub industry: Option<String>,
    pub description: Option<String>,
    pub services: Option<String>,
    #[serde(rename = "targetAudience")]
    pub target_audience: Option<String>,
    #[serde(rename = "audiencePainPoints")]
    pub audience_pain_points: Option<String>,
    #[serde(rename = "toneOfVoice")]
    pub tone_of_voice: Option<String>,
    #[serde(rename = "brandPersonality")]
    pub brand_personality: Option<String>,
    #[serde(rename = "currentOffers")]
    pub current_offers: Option<String>,
    #[serde(rename = "uniqueSellingPoints")]
    pub unique_selling_points: Option<String>,
    pub faqs: Option<String>,
    #[serde(rename = "caseStudies")]
    pub case_studies: Option<String>,
    #[serde(rename = "bannedWords")]
    pub banned_words: Option<String>,
    #[serde(rename = "bannedTopics")]
    pub banned_topics: Option<String>,
    pub competitors: Option<String>,
    pub keywords: Option<String>,
    #[serde(rename = "websiteUrl")]
    pub website_url: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<FixedOffset>>,
    #[serde(rename = "deletedAt")]
    pub deleted_at: Option<DateTime<FixedOffset>>,
}
