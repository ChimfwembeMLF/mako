use chrono::{Datelike, NaiveDate, NaiveDateTime, NaiveTime, Timelike, Utc};
use sea_orm::entity::prelude::Date;

use super::entity::Model;
use super::timetz::Timetz;

pub fn is_content_due(item: &Model, now: NaiveDateTime) -> bool {
    let schedulable = matches!(item.status.as_deref(), Some("approved") | Some("scheduled"));
    if !schedulable {
        return false;
    }

    let Some(due_at) = resolve_scheduled_due_at(item) else {
        return false;
    };

    due_at <= now
}

fn resolve_scheduled_due_at(item: &Model) -> Option<NaiveDateTime> {
    let date_str = resolve_schedule_date_str(item.scheduled_date)?;
    let (hours, minutes) = scheduled_time_parts(item.scheduled_time.as_ref());

    let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d").ok()?;
    date.and_hms_opt(hours, minutes, 0)
}

fn resolve_schedule_date_str(scheduled_date: Option<Date>) -> Option<String> {
    let date = scheduled_date?;
    Some(format!(
        "{:04}-{:02}-{:02}",
        date.year(),
        date.month(),
        date.day()
    ))
}

/// Wall-clock hours/minutes only — TIMETZ offset is ignored (Nest parity).
fn scheduled_time_parts(scheduled_time: Option<&Timetz>) -> (u32, u32) {
    scheduled_time
        .map(|t| (t.hour(), t.minute()))
        .unwrap_or((0, 0))
}

pub fn format_scheduled_time(value: Option<&Timetz>) -> Option<String> {
    value.map(|t| t.format("%H:%M").to_string())
}

pub fn parse_scheduled_time_str(raw: Option<String>) -> Option<Timetz> {
    raw.as_deref().and_then(Timetz::parse_wall_clock)
}

/// Convenience for callers that want `NaiveTime` instead of `Timetz`.
#[allow(dead_code)]
pub fn parse_scheduled_time_ref(raw: &str) -> Option<NaiveTime> {
    Timetz::parse_wall_clock(raw).map(|t| t.0)
}

pub fn now_local_naive() -> NaiveDateTime {
    Utc::now().naive_local()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    #[test]
    fn parse_and_format_hh_mm() {
        let t = parse_scheduled_time_str(Some("14:30".into())).expect("parse");
        assert_eq!(format_scheduled_time(Some(&t)).as_deref(), Some("14:30"));
    }

    #[test]
    fn parse_hh_mm_ss_and_offsetted() {
        let t = parse_scheduled_time_str(Some("09:05:00".into())).expect("parse");
        assert_eq!((t.hour(), t.minute()), (9, 5));
        let offsetted = parse_scheduled_time_str(Some("14:30:00+02".into())).expect("parse");
        assert_eq!((offsetted.hour(), offsetted.minute()), (14, 30));
    }

    #[test]
    fn parse_empty_is_none() {
        assert!(parse_scheduled_time_str(None).is_none());
        assert!(parse_scheduled_time_str(Some("".into())).is_none());
    }

    #[test]
    fn due_check_uses_wall_clock_not_offset_shift() {
        let date = NaiveDate::from_ymd_opt(2026, 7, 23).unwrap();
        let item = Model {
            id: uuid::Uuid::nil(),
            tenant_id: uuid::Uuid::nil(),
            workspace_id: uuid::Uuid::nil(),
            user_id: uuid::Uuid::nil(),
            brand_profile_id: None,
            content_type: "post".into(),
            title: "t".into(),
            content: "c".into(),
            campaign_theme: None,
            campaign_id: None,
            status: Some("approved".into()),
            platforms: None,
            platform_payloads: None,
            scheduled_date: Some(date),
            scheduled_time: Timetz::parse_wall_clock("14:30:00+02"),
            published_at: None,
            external_post_id: None,
            publish_failed_reason: None,
            publish_attempts: 0,
            deleted_at: None,
            created_at: chrono::Utc::now().into(),
            updated_at: chrono::Utc::now().into(),
        };
        let before = date.and_hms_opt(14, 29, 0).unwrap();
        let after = date.and_hms_opt(14, 30, 0).unwrap();
        assert!(!is_content_due(&item, before));
        assert!(is_content_due(&item, after));
    }
}
