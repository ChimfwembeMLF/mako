use chrono::NaiveTime;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// PostgreSQL `TIMETZ` — decoded as wall-clock time (timezone offset stripped for scheduling).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, DeriveValueType)]
#[sea_orm(column_type = "custom(\"TIMETZ\")")]
pub struct Timetz(pub NaiveTime);

impl Timetz {
    pub fn as_naive(&self) -> NaiveTime {
        self.0
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
