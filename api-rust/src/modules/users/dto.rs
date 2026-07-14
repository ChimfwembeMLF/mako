use serde::Deserialize;

#[derive(Deserialize)]
pub struct PageOptionsDto {
    pub order: Option<String>,
    pub page: Option<u64>,
    pub take: Option<u64>,
}

impl PageOptionsDto {
    pub fn page(&self) -> u64 {
        self.page.unwrap_or(1).max(1)
    }

    pub fn take(&self) -> u64 {
        self.take.unwrap_or(10).clamp(1, 50)
    }

    pub fn order_desc(&self) -> bool {
        self.order
            .as_deref()
            .map(|o| o.eq_ignore_ascii_case("DESC"))
            .unwrap_or(false)
    }
}
