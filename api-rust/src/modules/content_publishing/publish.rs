use std::collections::HashMap;

use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use uuid::Uuid;

use crate::app_state::AppState;
use crate::common::ApiResult;
use crate::modules::content_items::entity::{
    ActiveModel as ContentActiveModel, Entity as ContentEntity, Model as ContentModel,
};
use crate::modules::media::entity::{Column as MediaColumn, Entity as MediaEntity};

use super::facebook::FacebookPublishingService;
use super::instagram::InstagramPublishingService;
use super::linkedin::LinkedInPublishingService;
use super::tiktok::TiktokPublishingService;
use super::twitter::TwitterPublishingService;
use super::whatsapp::WhatsappPublishingService;
use super::youtube::YoutubePublishingService;
use super::publications::{PublicationsService, RecordPublicationParams};
use super::social_account::SocialPublishAccountService;
use super::types::{
    ContentToPublish, MediaAttachment, PlatformPayloadStored, PublishResult, MAX_PUBLISH_ATTEMPTS,
};

pub struct PublishContentService;

pub struct PublishParams {
    pub content_id: Uuid,
    pub user_id: Uuid,
    pub platforms: Option<Vec<String>>,
    pub platform_payloads: Option<HashMap<String, PlatformPayloadStored>>,
}

pub struct PublishOutput {
    pub published: bool,
    pub results: HashMap<String, PublishResult>,
}

impl PublishContentService {
    pub async fn publish(state: &AppState, params: PublishParams) -> ApiResult<PublishOutput> {
        let item = ContentEntity::find_by_id(params.content_id)
            .one(&state.db)
            .await?
            .ok_or_else(|| crate::common::ApiError::NotFound("Content item not found".into()))?;

        let explicit_platforms = params
            .platforms
            .as_ref()
            .map(|p| !p.is_empty())
            .unwrap_or(false);
        let platforms = if explicit_platforms {
            params.platforms.clone().unwrap()
        } else if let Some(ref p) = item.platforms {
            if p.is_empty() {
                vec!["facebook".to_string()]
            } else {
                p.clone()
            }
        } else {
            vec!["facebook".to_string()]
        };

        let latest_before = latest_status_by_platform(state, item.id).await?;
        let platforms_to_run: Vec<String> = if explicit_platforms {
            platforms.clone()
        } else {
            platforms
                .iter()
                .filter(|p| latest_before.get(*p).as_deref() != Some(&"published".to_string()))
                .cloned()
                .collect()
        };

        if platforms_to_run.is_empty() {
            let all_published = platforms
                .iter()
                .all(|p| latest_before.get(p).as_deref() == Some(&"published".to_string()));
            return Ok(PublishOutput {
                published: all_published,
                results: HashMap::new(),
            });
        }

        let platform_payloads = params
            .platform_payloads
            .or_else(|| parse_platform_payloads(item.platform_payloads.clone()));

        let default_media_rows = MediaEntity::find()
            .filter(MediaColumn::ContentId.eq(item.id))
            .filter(MediaColumn::TenantId.eq(item.tenant_id))
            .all(&state.db)
            .await?;

        let default_media: Vec<MediaAttachment> = default_media_rows
            .iter()
            .map(|m| MediaAttachment {
                id: m.id.to_string(),
                media_url: m.media_url.clone(),
                media_type: m.media_type.clone(),
                alt_text: m.alt_text.clone(),
            })
            .collect();

        let mut results = HashMap::new();

        for platform in &platforms_to_run {
            let pp = platform_payloads.as_ref().and_then(|m| m.get(platform));
            let published_content = pp
                .and_then(|p| p.content.as_deref())
                .unwrap_or(&item.content)
                .to_string();
            let published_title = pp
                .and_then(|p| p.title.as_deref())
                .map(str::to_string)
                .or_else(|| Some(item.title.clone()));

            let payload = ContentToPublish {
                id: item.id,
                content: published_content.clone(),
                title: published_title.clone(),
                user_id: params.user_id,
                tenant_id: item.tenant_id,
                workspace_id: Some(item.workspace_id),
            };

            let media = if let Some(pp) = pp {
                if let Some(ref items) = pp.media {
                    items
                        .iter()
                        .enumerate()
                        .map(|(i, m)| MediaAttachment {
                            id: format!("payload-{platform}-{i}"),
                            media_url: m.url.clone(),
                            media_type: m.media_type.clone().unwrap_or_else(|| "image".into()),
                            alt_text: m.name.clone(),
                        })
                        .collect()
                } else {
                    default_media.clone()
                }
            } else {
                default_media.clone()
            };

            if platform == "instagram" && media.is_empty() {
                let message = "Instagram requires at least one image or video attachment — skipped";
                results.insert(
                    platform.clone(),
                    PublishResult {
                        published: false,
                        message: message.into(),
                        external_post_id: None,
                    },
                );
                PublicationsService::record(
                    state,
                    RecordPublicationParams {
                        tenant_id: item.tenant_id,
                        workspace_id: Some(item.workspace_id),
                        content_id: item.id,
                        user_id: params.user_id,
                        platform: platform.clone(),
                        external_post_id: None,
                        published_content,
                        published_title,
                        published_media: None,
                        social_account_id: None,
                        status: "failed".into(),
                        error_message: Some(message.into()),
                    },
                )
                .await?;
                continue;
            }

            let account = SocialPublishAccountService::get_for_publish(
                state,
                item.tenant_id,
                params.user_id,
                platform,
                Some(item.workspace_id),
            )
            .await?;

            let result = dispatch_platform(
                state,
                platform,
                account.as_ref(),
                &payload,
                &media,
                pp,
            )
            .await;

            PublicationsService::record(
                state,
                RecordPublicationParams {
                    tenant_id: item.tenant_id,
                    workspace_id: Some(item.workspace_id),
                    content_id: item.id,
                    user_id: params.user_id,
                    platform: platform.clone(),
                    external_post_id: result.external_post_id.clone(),
                    published_content,
                    published_title,
                    published_media: Some(serde_json::json!(media)),
                    social_account_id: account.as_ref().map(|a| a.id),
                    status: if result.published {
                        "published".into()
                    } else {
                        "failed".into()
                    },
                    error_message: if result.published {
                        None
                    } else {
                        Some(result.message.clone())
                    },
                },
            )
            .await?;

            results.insert(platform.clone(), result);
        }

        finalize_content_status(state, &item, &platforms, &results).await?;

        let latest_after = latest_status_by_platform(state, item.id).await?;
        let all_published = platforms
            .iter()
            .all(|p| latest_after.get(p).as_deref() == Some(&"published".to_string()));

        Ok(PublishOutput {
            published: all_published,
            results,
        })
    }
}

async fn dispatch_platform(
    state: &AppState,
    platform: &str,
    account: Option<&crate::modules::social_accounts::entity::Model>,
    content: &ContentToPublish,
    media: &[MediaAttachment],
    platform_payload: Option<&PlatformPayloadStored>,
) -> PublishResult {
    match platform.to_lowercase().as_str() {
        "facebook" => {
            let Some(account) = account else {
                return PublishResult {
                    published: false,
                    message: "Facebook account not connected for this workspace".into(),
                    external_post_id: None,
                };
            };
            FacebookPublishingService::publish_post(account, content, media).await
        }
        "instagram" => {
            let Some(account) = account else {
                return PublishResult {
                    published: false,
                    message: "Instagram account not connected for this workspace".into(),
                    external_post_id: None,
                };
            };
            InstagramPublishingService::publish_post(account, content, media).await
        }
        "linkedin" => {
            let Some(account) = account else {
                return PublishResult {
                    published: false,
                    message: "LinkedIn account not connected for this workspace".into(),
                    external_post_id: None,
                };
            };
            LinkedInPublishingService::publish_post(account, content, media).await
        }
        "twitter" | "x" => {
            let Some(account) = account else {
                return PublishResult {
                    published: false,
                    message: "Twitter/X account not connected for this workspace".into(),
                    external_post_id: None,
                };
            };
            TwitterPublishingService::publish_post(account, content, media).await
        }
        "youtube" => {
            let Some(account) = account else {
                return PublishResult {
                    published: false,
                    message: "YouTube account not connected for this workspace".into(),
                    external_post_id: None,
                };
            };
            YoutubePublishingService::publish_post(account, content, media).await
        }
        "tiktok" => {
            let Some(account) = account else {
                return PublishResult {
                    published: false,
                    message: "TikTok account not connected for this workspace".into(),
                    external_post_id: None,
                };
            };
            TiktokPublishingService::publish_post(account, content, media).await
        }
        "whatsapp" => {
            let Some(account) = account else {
                return PublishResult {
                    published: false,
                    message:
                        "WhatsApp Business not connected — add credentials in Publisher Connect"
                            .into(),
                    external_post_id: None,
                };
            };
            WhatsappPublishingService::publish_post(state, account, content, platform_payload).await
        }
        other => PublishResult {
            published: false,
            message: format!("Unknown platform '{other}'"),
            external_post_id: None,
        },
    }
}

async fn latest_status_by_platform(
    state: &AppState,
    content_id: Uuid,
) -> ApiResult<HashMap<String, String>> {
    let rows = PublicationsService::find_by_content_id(state, content_id).await?;
    let mut map = HashMap::new();
    for row in rows {
        map.entry(row.platform).or_insert(row.status);
    }
    Ok(map)
}

async fn finalize_content_status(
    state: &AppState,
    item: &ContentModel,
    platforms: &[String],
    results: &HashMap<String, PublishResult>,
) -> ApiResult<()> {
    let latest = latest_status_by_platform(state, item.id).await?;
    let all_published = platforms
        .iter()
        .all(|p| latest.get(p).map(|s| s == "published").unwrap_or(false));
    let any_published = platforms
        .iter()
        .any(|p| latest.get(p).map(|s| s == "published").unwrap_or(false));

    let primary_external = results
        .values()
        .find(|r| r.published && r.external_post_id.is_some())
        .and_then(|r| r.external_post_id.clone());

    let failed_reasons: Vec<String> = results
        .iter()
        .filter(|(_, r)| !r.published)
        .map(|(p, r)| format!("{p}: {}", r.message))
        .collect();

    let mut active: ContentActiveModel = item.clone().into();

    if all_published {
        active.status = Set(Some("published".into()));
        active.published_at = Set(Some(Utc::now().fixed_offset()));
        active.publish_failed_reason = Set(None);
        active.publish_attempts = Set(0);
        if let Some(ext) = primary_external {
            active.external_post_id = Set(Some(ext));
        }
    } else if any_published {
        let next_attempts = item.publish_attempts + if failed_reasons.is_empty() { 0 } else { 1 };
        let exhausted = next_attempts >= MAX_PUBLISH_ATTEMPTS;
        active.status = Set(Some(if exhausted {
            "publish_failed".into()
        } else {
            "approved".into()
        }));
        active.publish_failed_reason = Set(if failed_reasons.is_empty() {
            None
        } else {
            Some(failed_reasons.join("; "))
        });
        active.publish_attempts = Set(next_attempts);
        if primary_external.is_some() {
            active.published_at = Set(Some(
                item.published_at
                    .unwrap_or_else(|| Utc::now().fixed_offset()),
            ));
        }
        if let Some(ext) = primary_external {
            active.external_post_id = Set(Some(ext));
        }
    } else if !failed_reasons.is_empty() {
        let next_attempts = item.publish_attempts + 1;
        let exhausted = next_attempts >= MAX_PUBLISH_ATTEMPTS;
        active.publish_failed_reason = Set(Some(failed_reasons.join("; ")));
        active.publish_attempts = Set(next_attempts);
        if exhausted {
            active.status = Set(Some("publish_failed".into()));
        }
    }

    active.updated_at = Set(Utc::now().fixed_offset());
    active.update(&state.db).await?;
    Ok(())
}

fn parse_platform_payloads(
    raw: Option<sea_orm::JsonValue>,
) -> Option<HashMap<String, PlatformPayloadStored>> {
    let val = raw?;
    serde_json::from_value(val).ok()
}
