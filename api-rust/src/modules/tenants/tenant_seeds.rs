use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, Set};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::approval_workflows::entity::ActiveModel as WorkflowActiveModel;
use crate::modules::auto_reply_rules::entity::{
    ActiveModel as AutoReplyActiveModel, Column as AutoReplyColumn, Entity as AutoReplyEntity,
};
use crate::modules::brand_profiles::seed::BrandProfileSeedService;
use crate::modules::roles::entity::Model as RoleModel;
use crate::modules::templates::entity::{
    ActiveModel as TemplateActiveModel, Column as TemplateColumn, Entity as TemplateEntity,
};
use crate::modules::tenants::entity::Entity as TenantEntity;
use crate::modules::users::entity::Model as UserModel;

struct TemplateSeed {
    name: &'static str,
    description: &'static str,
    content_type: &'static str,
    platforms: &'static [&'static str],
    body: &'static str,
}

struct AutoReplySeed {
    platform: &'static str,
    name: &'static str,
    trigger_keywords: &'static [&'static str],
    trigger_sentiment: &'static str,
    ai_generate: bool,
    is_active: bool,
}

struct ApprovalWorkflowSeed {
    action_key: &'static str,
    label: &'static str,
    description: &'static str,
    approver_role_name: &'static str,
}

const TEMPLATE_SEEDS: &[TemplateSeed] = &[
    TemplateSeed {
        name: "Facebook — Community Post",
        description: "Conversational feed post with hook, story, and comment-driving CTA.",
        content_type: "social",
        platforms: &["facebook"],
        body: "Write for Facebook feed.\nStructure: hook (1 line) → short story or insight (2-3 short paragraphs) → question or CTA to drive comments.\nTone: conversational, warm, community-focused. 1-2 emojis max if on-brand.\nLength: 150-400 words. Line breaks between paragraphs.\nEnd with a question when appropriate. No markdown. Max 5 hashtags if used.",
    },
    TemplateSeed {
        name: "LinkedIn — Thought Leadership",
        description: "Professional post with white-space formatting and insight-led hook.",
        content_type: "social",
        platforms: &["linkedin"],
        body: "Write for LinkedIn.\nStructure: bold hook line → personal insight or lesson → 3-5 short single-line points → clear CTA.\nTone: professional, credible, human — not corporate jargon.\nUse line breaks generously (one idea per line). 0-3 relevant hashtags at the end.\nLength: 800-1,500 characters. No HTML or markdown.",
    },
    TemplateSeed {
        name: "Instagram — Caption",
        description: "Visual-first caption with hook line and hashtag block.",
        content_type: "social",
        platforms: &["instagram"],
        body: "Write an Instagram caption.\nFirst line must hook before \"see more\". Describe the visual or moment vividly.\nBody: 2-4 short lines with personality. CTA in the last line (save, share, link in bio).\nEnd with 5-10 relevant hashtags on a separate final line.\nLength: under 2,200 characters. Emojis sparingly if on-brand.",
    },
    TemplateSeed {
        name: "X / Twitter — Single Post",
        description: "Punchy single-tweet copy under 280 characters.",
        content_type: "social",
        platforms: &["twitter"],
        body: "Write a single X/Twitter post.\nSTRICT 280 character limit including spaces and hashtags.\nOne clear idea. Punchy hook. 0-2 hashtags max.\nNo thread. No markdown. Plain text only.",
    },
    TemplateSeed {
        name: "WhatsApp — Broadcast",
        description: "Human, conversational broadcast message.",
        content_type: "messaging",
        platforms: &["whatsapp"],
        body: "Write a WhatsApp broadcast message.\nTone: personal and conversational — like texting a contact, not a mass blast.\nNo markdown, no bullet symbols. Short paragraphs.\nMax ~300 words. One clear next step. Avoid spammy urgency.",
    },
    TemplateSeed {
        name: "Email — Marketing",
        description: "Scannable marketing email with subject-line energy.",
        content_type: "email",
        platforms: &["email"],
        body: "Write marketing email body copy.\nOpening: strong subject-line energy in the first sentence.\nBody: scannable short paragraphs, one primary CTA.\nSign-off: warm and on-brand. Avoid spam trigger words (FREE!!!, act now).\nSuggest a subject line ≤ 60 chars and preheader ≤ 90 chars in the title field.",
    },
    TemplateSeed {
        name: "Ad Copy — Paid Social",
        description: "Benefit-led short ad with urgency and single CTA.",
        content_type: "ad_copy",
        platforms: &["ad_copy"],
        body: "Write paid social ad copy.\nLead with pain point or benefit. Add social proof or urgency if on-brand.\nHeadline energy ≤ 40 chars in title. Primary text ≤ 125 chars in content.\nOne strong CTA verb (Start, Get, Book, Try). 2-4 sentences max.",
    },
    TemplateSeed {
        name: "General — Blog / Article",
        description: "Versatile long-form HTML content for websites and newsletters.",
        content_type: "content",
        platforms: &["content"],
        body: "Write versatile marketing content as HTML.\nUse <p>, <ul>, <li>, <strong> only — no scripts or external links.\nStructure: compelling title → intro paragraph → 2-4 sections with subheads as <strong> → conclusion with CTA.\nTone: on-brand, helpful, authoritative. 400-800 words.",
    },
    TemplateSeed {
        name: "YouTube — Video Description",
        description: "SEO-friendly description with timestamps hook and subscribe CTA.",
        content_type: "social",
        platforms: &["youtube"],
        body: "Write a YouTube video description.\nFirst 2 lines: hook + primary keyword (visible before \"Show more\").\nBody: 2-3 short paragraphs summarizing value, who it's for, and key takeaways.\nInclude placeholder timestamps section if relevant (0:00 Intro).\nEnd with subscribe/CTA and 3-5 relevant hashtags.\nLength: 200-500 words. Plain text, no markdown.",
    },
];

const AUTO_REPLY_SEEDS: &[AutoReplySeed] = &[
    AutoReplySeed {
        platform: "whatsapp",
        name: "WhatsApp — Greeting",
        trigger_keywords: &["hi", "hello", "hey", "good morning", "good afternoon"],
        trigger_sentiment: "any",
        ai_generate: true,
        is_active: false,
    },
    AutoReplySeed {
        platform: "whatsapp",
        name: "WhatsApp — Default AI reply",
        trigger_keywords: &[],
        trigger_sentiment: "any",
        ai_generate: true,
        is_active: false,
    },
    AutoReplySeed {
        platform: "facebook",
        name: "Facebook — Thank you",
        trigger_keywords: &["thanks", "thank you", "appreciate"],
        trigger_sentiment: "positive",
        ai_generate: true,
        is_active: false,
    },
    AutoReplySeed {
        platform: "facebook",
        name: "Facebook — Default comment reply",
        trigger_keywords: &[],
        trigger_sentiment: "any",
        ai_generate: true,
        is_active: false,
    },
    AutoReplySeed {
        platform: "instagram",
        name: "Instagram — Pricing & availability",
        trigger_keywords: &["price", "cost", "how much", "available", "book"],
        trigger_sentiment: "any",
        ai_generate: true,
        is_active: false,
    },
    AutoReplySeed {
        platform: "instagram",
        name: "Instagram — Default comment reply",
        trigger_keywords: &[],
        trigger_sentiment: "any",
        ai_generate: true,
        is_active: false,
    },
    AutoReplySeed {
        platform: "youtube",
        name: "YouTube — Question on video",
        trigger_keywords: &["?", "how", "what", "why", "when", "where"],
        trigger_sentiment: "any",
        ai_generate: true,
        is_active: false,
    },
    AutoReplySeed {
        platform: "youtube",
        name: "YouTube — Default comment reply",
        trigger_keywords: &[],
        trigger_sentiment: "any",
        ai_generate: true,
        is_active: false,
    },
    AutoReplySeed {
        platform: "linkedin",
        name: "LinkedIn — Engagement",
        trigger_keywords: &["great", "insight", "agree", "thanks for sharing"],
        trigger_sentiment: "positive",
        ai_generate: true,
        is_active: false,
    },
    AutoReplySeed {
        platform: "linkedin",
        name: "LinkedIn — Default comment reply",
        trigger_keywords: &[],
        trigger_sentiment: "any",
        ai_generate: true,
        is_active: false,
    },
];

const APPROVAL_WORKFLOW_SEEDS: &[ApprovalWorkflowSeed] = &[
    ApprovalWorkflowSeed {
        action_key: "content.publish",
        label: "Publish content",
        description: "Requires approval before content goes live",
        approver_role_name: "Publisher",
    },
    ApprovalWorkflowSeed {
        action_key: "content.approve",
        label: "Approve content",
        description: "Requires second approval for content approval",
        approver_role_name: "Publisher",
    },
    ApprovalWorkflowSeed {
        action_key: "leads.email_bulk",
        label: "Bulk email leads",
        description: "Requires approval before bulk lead emails",
        approver_role_name: "Admin",
    },
    ApprovalWorkflowSeed {
        action_key: "leads.delete",
        label: "Delete leads",
        description: "Requires approval before deleting leads",
        approver_role_name: "Admin",
    },
    ApprovalWorkflowSeed {
        action_key: "media.delete",
        label: "Delete media",
        description: "Requires approval before deleting media assets",
        approver_role_name: "Admin",
    },
    ApprovalWorkflowSeed {
        action_key: "templates.delete",
        label: "Delete templates",
        description: "Requires approval before deleting templates",
        approver_role_name: "Admin",
    },
    ApprovalWorkflowSeed {
        action_key: "team.invite",
        label: "Invite team member",
        description: "Requires approval before sending invites",
        approver_role_name: "Admin",
    },
    ApprovalWorkflowSeed {
        action_key: "team.remove",
        label: "Remove team member",
        description: "Requires approval before removing members",
        approver_role_name: "Admin",
    },
    ApprovalWorkflowSeed {
        action_key: "team.assign_roles",
        label: "Assign roles",
        description: "Requires approval before changing roles",
        approver_role_name: "Admin",
    },
];

pub struct TenantSeedService;

impl TenantSeedService {
    pub async fn seed_tenant_defaults(
        state: &AppState,
        tenant_id: Uuid,
        user: &UserModel,
    ) -> ApiResult<()> {
        Self::ensure_templates(state, tenant_id, user.id).await?;
        Self::ensure_auto_reply_rules(state, tenant_id).await?;
        BrandProfileSeedService::ensure_starter_for_user(state, tenant_id, user).await?;
        Ok(())
    }

    pub async fn seed_approval_workflows(
        txn: &sea_orm::DatabaseTransaction,
        tenant_id: Uuid,
        roles: &[RoleModel],
        updated_by: Uuid,
    ) -> ApiResult<()> {
        let now = Utc::now().fixed_offset();
        for seed in APPROVAL_WORKFLOW_SEEDS {
            let Some(approver) = roles
                .iter()
                .find(|role| role.name == seed.approver_role_name)
            else {
                continue;
            };

            WorkflowActiveModel {
                id: Set(Uuid::new_v4()),
                tenant_id: Set(tenant_id),
                action_key: Set(seed.action_key.to_string()),
                label: Set(seed.label.to_string()),
                description: Set(Some(seed.description.to_string())),
                is_enabled: Set(false),
                approver_role_id: Set(approver.id),
                updated_by: Set(updated_by),
                updated_at: Set(now),
            }
            .insert(txn)
            .await?;
        }
        Ok(())
    }

    pub async fn backfill_auto_reply_rules(state: &AppState) -> ApiResult<u32> {
        let tenants = TenantEntity::find().all(&state.db).await?;
        let mut created = 0u32;
        for tenant in tenants {
            let count = AutoReplyEntity::find()
                .filter(AutoReplyColumn::TenantId.eq(tenant.id))
                .count(&state.db)
                .await?;
            if count == 0 {
                created += Self::ensure_auto_reply_rules(state, tenant.id).await?;
            }
        }
        Ok(created)
    }

    async fn ensure_templates(state: &AppState, tenant_id: Uuid, user_id: Uuid) -> ApiResult<()> {
        let now = Utc::now().fixed_offset();
        for seed in TEMPLATE_SEEDS {
            let exists = TemplateEntity::find()
                .filter(TemplateColumn::TenantId.eq(tenant_id))
                .filter(TemplateColumn::Name.eq(seed.name))
                .one(&state.db)
                .await?
                .is_some();
            if exists {
                continue;
            }

            TemplateActiveModel {
                id: Set(Uuid::new_v4()),
                tenant_id: Set(tenant_id),
                workspace_id: Set(None),
                user_id: Set(user_id),
                name: Set(seed.name.to_string()),
                description: Set(Some(seed.description.to_string())),
                content_type: Set(Some(seed.content_type.to_string())),
                body: Set(Some(seed.body.to_string())),
                platforms: Set(Some(
                    seed.platforms.iter().map(|p| (*p).to_string()).collect(),
                )),
                is_active: Set(true),
                created_at: Set(now),
                updated_at: Set(now),
                ..Default::default()
            }
            .insert(&state.db)
            .await?;
        }
        Ok(())
    }

    async fn ensure_auto_reply_rules(state: &AppState, tenant_id: Uuid) -> ApiResult<u32> {
        let now = Utc::now().fixed_offset();
        let mut created = 0u32;
        for seed in AUTO_REPLY_SEEDS {
            let exists = AutoReplyEntity::find()
                .filter(AutoReplyColumn::TenantId.eq(tenant_id))
                .filter(AutoReplyColumn::Platform.eq(seed.platform))
                .filter(AutoReplyColumn::Name.eq(seed.name))
                .one(&state.db)
                .await?
                .is_some();
            if exists {
                continue;
            }

            AutoReplyActiveModel {
                id: Set(Uuid::new_v4()),
                tenant_id: Set(tenant_id),
                workspace_id: Set(None),
                platform: Set(seed.platform.to_string()),
                name: Set(seed.name.to_string()),
                trigger_keywords: Set(if seed.trigger_keywords.is_empty() {
                    None
                } else {
                    Some(
                        seed.trigger_keywords
                            .iter()
                            .map(|k| (*k).to_string())
                            .collect(),
                    )
                }),
                trigger_sentiment: Set(Some(seed.trigger_sentiment.to_string())),
                response_template: Set(None),
                ai_generate: Set(seed.ai_generate),
                is_active: Set(seed.is_active),
                created_at: Set(now),
                updated_at: Set(now),
                ..Default::default()
            }
            .insert(&state.db)
            .await?;
            created += 1;
        }
        Ok(created)
    }
}
