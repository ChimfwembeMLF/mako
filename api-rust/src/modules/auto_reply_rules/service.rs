use sea_orm::{ColumnTrait, Condition, EntityTrait, QueryFilter, QueryOrder};

use crate::modules::auto_reply_rules::entity::{
    Column as AutoReplyRuleColumn, Entity as AutoReplyRuleEntity, Model as AutoReplyRuleModel,
};

pub async fn find_active_for_platform(
    db: &sea_orm::DatabaseConnection,
    tenant_id: uuid::Uuid,
    platform: &str,
    workspace_id: Option<uuid::Uuid>,
) -> Result<Vec<AutoReplyRuleModel>, sea_orm::DbErr> {
    let mut condition = Condition::all()
        .add(AutoReplyRuleColumn::TenantId.eq(tenant_id))
        .add(AutoReplyRuleColumn::Platform.eq(platform))
        .add(AutoReplyRuleColumn::IsActive.eq(true))
        .add(AutoReplyRuleColumn::DeletedAt.is_null());

    if let Some(ws) = workspace_id {
        condition = condition.add(
            Condition::any()
                .add(AutoReplyRuleColumn::WorkspaceId.eq(ws))
                .add(AutoReplyRuleColumn::WorkspaceId.is_null()),
        );
    }

    AutoReplyRuleEntity::find()
        .filter(condition)
        .order_by_asc(AutoReplyRuleColumn::CreatedAt)
        .all(db)
        .await
}

pub fn match_keyword_rule<'a>(
    rules: &'a [AutoReplyRuleModel],
    message: &str,
) -> Option<&'a AutoReplyRuleModel> {
    let lower = message.to_lowercase();
    for rule in rules {
        let keywords = rule.trigger_keywords.as_deref().unwrap_or(&[]);
        if keywords.is_empty() {
            continue;
        }
        if keywords.iter().any(|kw| {
            let kw = kw.trim();
            !kw.is_empty() && lower.contains(&kw.to_lowercase())
        }) {
            return Some(rule);
        }
    }
    rules
        .iter()
        .find(|r| r.trigger_keywords.as_ref().map(|k| k.is_empty()).unwrap_or(true))
}
