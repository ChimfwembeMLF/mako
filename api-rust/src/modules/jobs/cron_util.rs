use chrono::{Datelike, Timelike, Utc};

pub fn should_run_daily_at(hour: u32, minute: u32, last: &mut Option<String>) -> bool {
    let now = Utc::now();
    if now.hour() != hour || now.minute() != minute {
        return false;
    }
    let key = format!("{}-{hour:02}-{minute:02}", now.format("%Y-%m-%d"));
    if last.as_deref() == Some(&key) {
        return false;
    }
    *last = Some(key);
    true
}

pub fn should_run_weekly_at(weekday: chrono::Weekday, hour: u32, minute: u32, last: &mut Option<String>) -> bool {
    let now = Utc::now();
    if now.weekday() != weekday || now.hour() != hour || now.minute() != minute {
        return false;
    }
    let key = format!("{}-{}-{hour:02}-{minute:02}", now.format("%Y-%m-%d"), weekday.number_from_monday());
    if last.as_deref() == Some(&key) {
        return false;
    }
    *last = Some(key);
    true
}

pub fn should_run_hourly_at(hours: &[u32], last: &mut Option<String>) -> bool {
    let now = Utc::now();
    if now.minute() != 0 || !hours.contains(&now.hour()) {
        return false;
    }
    let key = format!("{}-{}", now.format("%Y-%m-%d"), now.hour());
    if last.as_deref() == Some(&key) {
        return false;
    }
    *last = Some(key);
    true
}
