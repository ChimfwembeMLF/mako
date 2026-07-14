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

fn scheduled_time_parts(scheduled_time: Option<&Timetz>) -> (u32, u32) {
    scheduled_time
        .map(|t| (t.hour(), t.minute()))
        .unwrap_or((0, 0))
}

pub fn format_scheduled_time(value: Option<&Timetz>) -> Option<String> {
    value.map(|t| t.format("%H:%M").to_string())
}

pub fn parse_scheduled_time_str(raw: Option<String>) -> Option<Timetz> {
    raw.as_deref()
        .and_then(parse_scheduled_time_ref)
        .map(Timetz::from)
}

pub fn parse_scheduled_time_ref(raw: &str) -> Option<NaiveTime> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    // DB timetz may look like "14:30:00+02" — keep wall-clock portion only.
    let core = raw.split(['+', '-', 'Z']).next()?.trim();
    NaiveTime::parse_from_str(core, "%H:%M")
        .or_else(|_| NaiveTime::parse_from_str(core, "%H:%M:%S"))
        .ok()
}

pub fn now_local_naive() -> NaiveDateTime {
    Utc::now().naive_local()
}
