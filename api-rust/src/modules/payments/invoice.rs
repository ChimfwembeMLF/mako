use chrono::{DateTime, FixedOffset};
use printpdf::{BuiltinFont, Mm, PdfDocument};
use std::env;
use std::io::{BufWriter, Cursor};

use crate::modules::deposits::entity::Model as DepositModel;
use crate::modules::plans::constants::normalize_plan_key;
use crate::modules::tenants::entity::Model as TenantModel;

#[derive(Clone, Debug)]
pub struct InvoiceData {
    pub invoice_number: String,
    pub deposit_id: String,
    pub tenant_name: String,
    pub customer_email: Option<String>,
    pub plan_label: String,
    pub status: String,
    pub payment_method: String,
    pub network: Option<String>,
    pub phone: Option<String>,
    pub issued_at: DateTime<FixedOffset>,
    pub paid_at: Option<DateTime<FixedOffset>>,
    pub company_name: String,
    pub company_legal_name: String,
    pub company_address: String,
    pub company_tpin: String,
    pub company_phones: String,
    pub support_email: String,
    pub website: String,
    pub bank_name: String,
    pub bank_branch: String,
    pub bank_account_name: String,
    pub bank_account_number: String,
    pub sub_total: String,
    pub vat_amount: String,
    pub grand_total: String,
}

pub fn build_invoice_number(deposit_id: &str) -> String {
    deposit_id
        .replace('-', "")
        .chars()
        .take(12)
        .collect::<String>()
        .to_uppercase()
}

pub fn invoice_filename(deposit_id: &str) -> String {
    format!("Mako -Tax-Invoice-{}.pdf", build_invoice_number(deposit_id))
}

fn format_status(status: Option<&str>) -> String {
    match status.unwrap_or("").to_uppercase().as_str() {
        "COMPLETED" => "Paid".into(),
        "ACCEPTED" => "Pending".into(),
        "FAILED" => "Failed".into(),
        other if other.is_empty() => "Unknown".into(),
        other => other.to_string(),
    }
}

fn format_network(correspondent: Option<&str>) -> String {
    match correspondent.unwrap_or("") {
        "MTN_MOMO_ZMB" => "MTN MoMo (Zambia)".into(),
        "AIRTEL_OAPI_ZMB" => "Airtel Money (Zambia)".into(),
        "ZAMTEL_ZMB" => "Zamtel Kwacha (Zambia)".into(),
        "" => "Mobile Money".into(),
        other => other.to_string(),
    }
}

fn split_vat_inclusive(grand_total: f64) -> (String, String, String) {
    let sub = grand_total / 1.16;
    let vat = grand_total - sub;
    (
        format!("{sub:.2}"),
        format!("{vat:.2}"),
        format!("{grand_total:.2}"),
    )
}

pub fn invoice_data_from_deposit(
    deposit: &DepositModel,
    tenant: &TenantModel,
    owner_email: Option<String>,
    plan_label: Option<&str>,
    plan_price_zmw: Option<i64>,
) -> InvoiceData {
    let grand_total_num = deposit
        .amount
        .and_then(|d| d.to_string().parse::<f64>().ok())
        .unwrap_or(plan_price_zmw.unwrap_or(0) as f64);
    let (sub_total, vat_amount, grand_total) = split_vat_inclusive(grand_total_num);
    let is_paid = deposit.status.as_deref() == Some("COMPLETED");
    let plan_key = normalize_plan_key(deposit.plan.as_deref());

    InvoiceData {
        invoice_number: build_invoice_number(&deposit.deposit_id),
        deposit_id: deposit.deposit_id.clone(),
        tenant_name: tenant.name.clone(),
        customer_email: owner_email,
        plan_label: plan_label
            .map(str::to_string)
            .or_else(|| deposit.plan.clone())
            .unwrap_or_else(|| plan_key.to_string()),
        status: format_status(deposit.status.as_deref()),
        payment_method: "Mobile Money".into(),
        network: Some(format_network(deposit.correspondent.as_deref())),
        phone: deposit.phone.clone().or_else(|| deposit.msisdn.clone()),
        issued_at: deposit.created_at,
        paid_at: if is_paid {
            Some(deposit.updated_at)
        } else {
            None
        },
        company_name: "Mako ".into(),
        company_legal_name: env::var("COMPANY_LEGAL_NAME")
            .unwrap_or_else(|_| "AgriWide Mako ".into()),
        company_address: env::var("COMPANY_ADDRESS").unwrap_or_else(|_| "Lusaka, Zambia".into()),
        company_tpin: env::var("COMPANY_TPIN").unwrap_or_default(),
        company_phones: env::var("COMPANY_PHONES").unwrap_or_default(),
        support_email: env::var("SUPPORT_EMAIL").unwrap_or_else(|_| "support@agriwide.co".into()),
        website: env::var("COMPANY_WEBSITE").unwrap_or_else(|_| "https://agriwide.co".into()),
        bank_name: env::var("COMPANY_BANK_NAME").unwrap_or_default(),
        bank_branch: env::var("COMPANY_BANK_BRANCH").unwrap_or_default(),
        bank_account_name: env::var("COMPANY_BANK_ACCOUNT_NAME")
            .unwrap_or_else(|_| "AgriWide Mako ".into()),
        bank_account_number: env::var("COMPANY_BANK_ACCOUNT_NUMBER").unwrap_or_default(),
        sub_total,
        vat_amount,
        grand_total,
    }
}

pub fn render_invoice_pdf(data: &InvoiceData) -> Result<Vec<u8>, String> {
    let (doc, page1, layer1) =
        PdfDocument::new("Mako Tax Invoice", Mm(210.0), Mm(297.0), "Layer 1");
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| e.to_string())?;
    let layer = doc.get_page(page1).get_layer(layer1);

    let mut y = 280.0;

    macro_rules! line {
        ($text:expr, $size:expr, $bold:expr) => {{
            let y_mm = Mm(y);
            y -= $size * 0.55 + 4.0;
            if $bold {
                layer.use_text($text, $size, Mm(20.0), y_mm, &font_bold);
            } else {
                layer.use_text($text, $size, Mm(20.0), y_mm, &font);
            }
        }};
    }

    line!(&data.company_legal_name.to_uppercase(), 11.0, true);
    line!(&data.company_address, 10.0, false);
    if !data.company_phones.is_empty() {
        line!(&data.company_phones, 9.0, false);
    }
    if !data.company_tpin.is_empty() {
        line!(&format!("TPIN: {}", data.company_tpin), 10.0, true);
    }
    y -= 6.0;
    line!("TAX INVOICE", 22.0, true);
    line!(&format!("Invoice No: {}", data.invoice_number), 10.0, false);
    line!(&format!("Order No: {}", data.deposit_id), 10.0, false);
    line!(
        &format!(
            "Date: {}",
            data.paid_at
                .unwrap_or(data.issued_at)
                .format("%d/%m/%Y")
        ),
        10.0,
        false
    );
    line!(&format!("Bill To: {}", data.tenant_name), 10.0, true);
    if let Some(email) = &data.customer_email {
        line!(email, 10.0, false);
    }
    y -= 4.0;
    line!(
        &format!("{} Plan — Mako subscription (monthly)", data.plan_label),
        10.0,
        false
    );
    let payment_note = match (&data.network, &data.phone) {
        (Some(network), Some(phone)) => format!("{} · {} · {}", data.payment_method, network, phone),
        (Some(network), None) => format!("{} · {}", data.payment_method, network),
        _ => data.payment_method.clone(),
    };
    line!(&payment_note, 9.0, false);
    line!(&format!("Ref: {}", data.deposit_id), 9.0, false);
    line!(&format!("Amount: {} ZMW", data.grand_total), 10.0, true);
    y -= 4.0;
    line!(&format!("Sub-Total: {}", data.sub_total), 10.0, false);
    line!(&format!("VAT 16%: {}", data.vat_amount), 10.0, false);
    line!(&format!("Grand Total K: {}", data.grand_total), 11.0, true);
    line!(&format!("Status: {}", data.status.to_uppercase()), 10.0, true);
    line!(
        &format!("Prepared by: {} Billing", data.company_name.trim()),
        9.0,
        false
    );
    line!(&format!("Support: {}", data.support_email), 9.0, false);
    if !data.website.is_empty() {
        line!(&data.website, 9.0, false);
    }
    if !data.bank_name.is_empty() {
        line!(&format!("Bank: {}", data.bank_name), 9.0, false);
    }
    if !data.bank_branch.is_empty() {
        line!(&format!("Branch: {}", data.bank_branch), 9.0, false);
    }
    if !data.bank_account_name.is_empty() {
        line!(&format!("Account Name: {}", data.bank_account_name), 9.0, false);
    }
    if !data.bank_account_number.is_empty() {
        line!(&format!("Account No: {}", data.bank_account_number), 9.0, false);
    }

    let mut buf = BufWriter::new(Cursor::new(Vec::new()));
    doc.save(&mut buf).map_err(|e| e.to_string())?;
    let cursor = buf.into_inner().map_err(|e| e.to_string())?;
    Ok(cursor.into_inner())
}
