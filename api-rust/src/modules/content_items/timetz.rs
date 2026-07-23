use chrono::{FixedOffset, NaiveTime, Timelike};
use sea_orm::sea_query::{ArrayType, ColumnType, Nullable, ValueType, ValueTypeErr};
use sea_orm::sqlx::postgres::types::PgTimeTz;
use sea_orm::sqlx::Row;
use sea_orm::{ColIdx, DbErr, QueryResult, RuntimeErr, TryGetError, TryGetable, Value};
use serde::{Deserialize, Serialize};

/// PostgreSQL `TIMETZ` — decoded as wall-clock time (timezone offset stripped for scheduling).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Timetz(pub NaiveTime);

impl Timetz {
    pub fn as_naive(&self) -> NaiveTime {
        self.0
    }

    /// Parse wall-clock time from API or DB-like strings (`HH:mm`, `HH:mm:ss`, `14:30:00+02`).
    pub fn parse_wall_clock(raw: &str) -> Option<Self> {
        let raw = raw.trim();
        if raw.is_empty() {
            return None;
        }
        // DB timetz may look like "14:30:00+02" — keep wall-clock portion only.
        let core = raw.split(['+', '-', 'Z']).next()?.trim();
        NaiveTime::parse_from_str(core, "%H:%M")
            .or_else(|_| NaiveTime::parse_from_str(core, "%H:%M:%S"))
            .ok()
            .map(Self)
    }

    /// Text form Postgres accepts for `TIMETZ` binds (UTC offset; wall-clock preserved).
    fn to_pg_timetz_text(&self) -> String {
        format!("{}+00", self.0.format("%H:%M:%S"))
    }
}

impl From<NaiveTime> for Timetz {
    fn from(value: NaiveTime) -> Self {
        Self(value)
    }
}

impl std::ops::Deref for Timetz {
    type Target = NaiveTime;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl From<Timetz> for Value {
    fn from(source: Timetz) -> Self {
        // Bind as text so sea-query/sqlx does not treat the value as SQL TIME.
        Value::String(Some(Box::new(source.to_pg_timetz_text())))
    }
}

impl TryGetable for Timetz {
    fn try_get_by<I: ColIdx>(res: &QueryResult, idx: I) -> Result<Self, TryGetError> {
        let Some(row) = res.try_as_pg_row() else {
            return Err(DbErr::Type(
                "Timetz decode requires the PostgreSQL backend".to_string(),
            )
            .into());
        };

        let opt: Option<PgTimeTz<NaiveTime, FixedOffset>> = row
            .try_get(idx.as_sqlx_postgres_index())
            .map_err(|e| DbErr::Query(RuntimeErr::SqlxError(e)))?;

        match opt {
            Some(tz) => Ok(Timetz(tz.time)),
            None => Err(TryGetError::Null(format!("{idx:?}"))),
        }
    }
}

impl ValueType for Timetz {
    fn try_from(v: Value) -> Result<Self, ValueTypeErr> {
        match v {
            Value::String(Some(s)) => Self::parse_wall_clock(&s).ok_or(ValueTypeErr),
            Value::ChronoTime(Some(t)) => Ok(Timetz(*t)),
            _ => Err(ValueTypeErr),
        }
    }

    fn type_name() -> String {
        "Timetz".to_owned()
    }

    fn array_type() -> ArrayType {
        ArrayType::String
    }

    fn column_type() -> ColumnType {
        ColumnType::custom("TIMETZ")
    }
}

impl Nullable for Timetz {
    fn null() -> Value {
        Value::String(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_wall_clock_strips_offset() {
        let t = Timetz::parse_wall_clock("14:30:00+02").expect("parse");
        assert_eq!(t.hour(), 14);
        assert_eq!(t.minute(), 30);
    }

    #[test]
    fn parse_wall_clock_hh_mm() {
        let t = Timetz::parse_wall_clock("09:05").expect("parse");
        assert_eq!(t.hour(), 9);
        assert_eq!(t.minute(), 5);
    }

    #[test]
    fn parse_wall_clock_empty_is_none() {
        assert!(Timetz::parse_wall_clock("").is_none());
        assert!(Timetz::parse_wall_clock("   ").is_none());
    }

    #[test]
    fn value_type_column_is_timetz_not_time() {
        let col = <Timetz as ValueType>::column_type();
        assert!(
            !matches!(col, ColumnType::Time),
            "Timetz must not map to SQL TIME"
        );
        match col {
            ColumnType::Custom(iden) => {
                assert_eq!(iden.to_string().to_uppercase(), "TIMETZ");
            }
            other => panic!("expected ColumnType::Custom(TIMETZ), got {other:?}"),
        }
    }

    #[test]
    fn into_value_is_timetz_text_not_chrono_time() {
        let t = Timetz::from(NaiveTime::from_hms_opt(14, 30, 0).unwrap());
        match Value::from(t) {
            Value::String(Some(s)) => {
                assert!(s.starts_with("14:30:00"), "{s}");
                assert!(s.contains('+') || s.contains('-'), "{s}");
            }
            other => panic!("expected Value::String TIMETZ text, got {other:?}"),
        }
    }
}
