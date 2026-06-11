import { PLAN_CONFIG, PlanKey, normalizePlanKey } from '../subscriptions/plan.constants';

export interface InvoiceData {
  invoiceNumber: string;
  depositId: string;
  tenantName: string;
  customerEmail?: string;
  plan: string;
  planLabel: string;
  amount: string;
  currency: string;
  status: string;
  paymentMethod: string;
  network?: string;
  phone?: string;
  issuedAt: string;
  paidAt?: string;
  companyName: string;
  companyLegalName: string;
  companyTagline: string;
  companyAddress: string;
  companyTpin: string;
  companyPhones: string;
  supportEmail: string;
  website: string;
  bankName: string;
  bankBranch: string;
  bankAccountName: string;
  bankAccountNumber: string;
  subTotal: string;
  vatAmount: string;
  grandTotal: string;
}

function formatStatus(status?: string): string {
  const s = (status ?? '').toUpperCase();
  if (s === 'COMPLETED') return 'Paid';
  if (s === 'ACCEPTED') return 'Pending';
  if (s === 'FAILED') return 'Failed';
  return status ?? 'Unknown';
}

function formatNetwork(correspondent?: string): string {
  if (!correspondent) return 'Mobile Money';
  const map: Record<string, string> = {
    MTN_MOMO_ZMB: 'MTN MoMo (Zambia)',
    AIRTEL_OAPI_ZMB: 'Airtel Money (Zambia)',
    ZAMTEL_ZMB: 'Zamtel Kwacha (Zambia)',
  };
  return map[correspondent] ?? correspondent;
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

/** Grand total is VAT-inclusive; back-calculate subtotal & 16% VAT (Zambia). */
function splitVatInclusive(grandTotal: number): { subTotal: string; vatAmount: string; grandTotal: string } {
  const sub = grandTotal / 1.16;
  const vat = grandTotal - sub;
  return {
    subTotal: formatMoney(sub),
    vatAmount: formatMoney(vat),
    grandTotal: formatMoney(grandTotal),
  };
}

export function buildInvoiceNumber(depositId: string): string {
  return depositId.replace(/-/g, '').slice(0, 12).toUpperCase();
}

export function invoiceDataFromDeposit(
  deposit: {
    depositId: string;
    plan?: string;
    status?: string;
    amount?: string;
    currency?: string;
    correspondent?: string;
    phone?: string;
    msisdn?: string;
    created_at: Date;
    updated_at: Date;
  },
  tenant: { name: string },
  ownerEmail?: string,
): InvoiceData {
  const planKey = normalizePlanKey(deposit.plan) as PlanKey;
  const planLabel = PLAN_CONFIG[planKey]?.label ?? deposit.plan ?? 'Subscription';
  const isPaid = (deposit.status ?? '').toUpperCase() === 'COMPLETED';
  const grandTotalNum = parseFloat(deposit.amount ?? String(PLAN_CONFIG[planKey]?.priceZmw ?? 0)) || 0;
  const { subTotal, vatAmount, grandTotal } = splitVatInclusive(grandTotalNum);

  return {
    invoiceNumber: buildInvoiceNumber(deposit.depositId),
    depositId: deposit.depositId,
    tenantName: tenant.name,
    customerEmail: ownerEmail,
    plan: planKey,
    planLabel,
    amount: deposit.amount ?? String(PLAN_CONFIG[planKey]?.priceZmw ?? 0),
    currency: deposit.currency ?? 'ZMW',
    status: formatStatus(deposit.status),
    paymentMethod: 'Mobile Money',
    network: formatNetwork(deposit.correspondent),
    phone: deposit.phone ?? deposit.msisdn,
    issuedAt: deposit.created_at.toISOString(),
    paidAt: isPaid ? deposit.updated_at.toISOString() : undefined,
    companyName: 'Mako Co-pilot',
    companyLegalName: process.env.COMPANY_LEGAL_NAME ?? 'AgriWide Mako Co-pilot',
    companyTagline: process.env.COMPANY_TAGLINE ?? 'INNOVATION · CREATIVITY · VALUE',
    companyAddress: process.env.COMPANY_ADDRESS ?? 'Lusaka, Zambia',
    companyTpin: process.env.COMPANY_TPIN ?? '',
    companyPhones: process.env.COMPANY_PHONES ?? '',
    supportEmail: process.env.SUPPORT_EMAIL ?? 'support@agriwide.co',
    website: process.env.COMPANY_WEBSITE ?? 'https://agriwide.co',
    bankName: process.env.COMPANY_BANK_NAME ?? '',
    bankBranch: process.env.COMPANY_BANK_BRANCH ?? '',
    bankAccountName: process.env.COMPANY_BANK_ACCOUNT_NAME ?? 'AgriWide Mako Co-pilot',
    bankAccountNumber: process.env.COMPANY_BANK_ACCOUNT_NUMBER ?? '',
    subTotal,
    vatAmount,
    grandTotal,
  };
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="72" height="72">
  <defs>
    <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="50%" style="stop-color:#a855f7"/>
      <stop offset="100%" style="stop-color:#ec4899"/>
    </linearGradient>
  </defs>
  <circle cx="40" cy="40" r="38" fill="none" stroke="url(#lg)" stroke-width="3"/>
  <path d="M28 52 L40 22 L52 52 M32 44 H48" fill="none" stroke="url(#lg)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const WATERMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="280" height="280" opacity="0.06">
  <defs>
    <linearGradient id="wm" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#ec4899"/>
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="90" fill="none" stroke="url(#wm)" stroke-width="6"/>
  <path d="M60 140 L100 50 L140 140 M72 115 H128" fill="none" stroke="url(#wm)" stroke-width="10" stroke-linecap="round"/>
</svg>`;

export function renderInvoiceHtml(data: InvoiceData): string {
  const dateStr = new Date(data.paidAt ?? data.issuedAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const description = `${data.planLabel} Plan — Mako Co-pilot subscription (AI marketing autopilot, monthly)`;
  const paymentNote = data.network
    ? `${data.paymentMethod} · ${data.network}${data.phone ? ` · ${data.phone}` : ''}`
    : data.paymentMethod;

  const emptyRows = Array.from({ length: 8 }, () => `
    <tr class="empty-row">
      <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TAX INVOICE ${data.invoiceNumber} — ${data.companyName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      color: #111;
      background: #fff;
      padding: 24px;
    }
    .page {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
    }
    .top-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-bottom: 8px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-name { font-size: 26px; font-weight: 800; letter-spacing: 0.04em; line-height: 1; }
    .brand-tagline { font-size: 9px; letter-spacing: 0.12em; color: #333; margin-top: 4px; font-weight: 600; }
    .company-block { text-align: right; font-size: 12px; line-height: 1.55; max-width: 320px; }
    .company-block .legal { font-weight: 700; font-size: 13px; margin-bottom: 2px; }
    .tpin { color: #2563eb; font-weight: 700; }
    .title {
      text-align: center;
      font-size: 42px;
      font-weight: 900;
      color: #dc2626;
      letter-spacing: 0.02em;
      margin: 16px 0 20px;
      line-height: 1;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 32px;
      margin-bottom: 14px;
      font-size: 12px;
    }
    .meta-left { flex: 1; }
    .meta-right { width: 260px; }
    .field { margin-bottom: 10px; line-height: 1.6; }
    .field-label { font-weight: 600; }
    .dots { border-bottom: 1px dotted #999; display: inline-block; min-width: 200px; padding-bottom: 1px; }
    .meta-right .field { display: flex; justify-content: space-between; gap: 8px; }
    .meta-right .dots { min-width: 140px; flex: 1; text-align: right; }
    .table-wrap {
      position: relative;
      border: 1.5px solid #111;
      border-radius: 0 0 8px 8px;
      overflow: hidden;
      margin-bottom: 0;
    }
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 0;
    }
    table.items {
      width: 100%;
      border-collapse: collapse;
      position: relative;
      z-index: 1;
    }
    table.items th {
      border: 1.5px solid #111;
      padding: 8px 10px;
      font-weight: 700;
      font-size: 13px;
      text-align: center;
      background: #fff;
    }
    table.items td {
      border-left: 1.5px solid #111;
      border-right: 1.5px solid #111;
      border-bottom: 1px solid #ddd;
      padding: 7px 10px;
      font-size: 12px;
      vertical-align: top;
      height: 28px;
    }
    table.items td:first-child { width: 60px; text-align: center; }
    table.items td:nth-child(3) { width: 110px; text-align: right; }
    table.items td:nth-child(4) { width: 110px; text-align: right; }
    table.items tr.item-row td { border-bottom: 1.5px solid #111; font-weight: 600; }
    table.items tr.empty-row td { color: transparent; }
    .bottom-row {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-top: 18px;
      align-items: flex-start;
    }
    .signatures { flex: 1; font-size: 12px; }
    .sig-field { margin-bottom: 14px; }
    .sig-line {
      border-bottom: 1px dotted #999;
      display: block;
      margin-top: 4px;
      min-height: 18px;
      padding-bottom: 2px;
    }
    .totals { width: 280px; }
    .total-row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 700;
    }
    .total-box {
      border: 1.5px solid #111;
      min-width: 120px;
      min-height: 32px;
      padding: 6px 10px;
      text-align: right;
      font-weight: 700;
      background: #fff;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      gap: 32px;
      margin-top: 28px;
      padding-top: 16px;
      font-size: 11px;
      color: #2563eb;
      line-height: 1.65;
    }
    .footer-left { flex: 1; }
    .footer-right {
      width: 300px;
      border-top: 3px solid;
      border-bottom: 3px solid;
      border-image: linear-gradient(90deg, #6366f1, #2563eb) 1;
      padding: 10px 0;
      font-weight: 600;
    }
    .footer-right p { margin-bottom: 3px; }
    .status-stamp {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 10px;
      border: 2px solid ${data.status === 'Paid' ? '#16a34a' : data.status === 'Pending' ? '#d97706' : '#dc2626'};
      color: ${data.status === 'Paid' ? '#16a34a' : data.status === 'Pending' ? '#d97706' : '#dc2626'};
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 0.08em;
      transform: rotate(-4deg);
    }
    @media print {
      body { padding: 0; }
      .page { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="top-row">
      <div class="brand">
        ${LOGO_SVG}
        <div>
          <div class="brand-name">${escapeHtml(data.companyName.toUpperCase())}</div>
          <div class="brand-tagline">${escapeHtml(data.companyTagline)}</div>
        </div>
      </div>
      <div class="company-block">
        <div class="legal">${escapeHtml(data.companyLegalName.toUpperCase())}</div>
        <div>${escapeHtml(data.companyAddress)}</div>
        ${data.companyTpin ? `<div class="tpin">TPIN: ${escapeHtml(data.companyTpin)}</div>` : ''}
      </div>
    </div>

    <div class="title">TAX INVOICE</div>

    <div class="meta-row">
      <div class="meta-left">
        <div class="field">
          <span class="field-label">Client TPIN</span>
          <span class="dots">&nbsp;</span>
        </div>
        <div class="field">
          <span class="field-label">M/s</span>
          <span class="dots">${escapeHtml(data.tenantName)}</span>
        </div>
        ${data.customerEmail ? `<div class="field" style="padding-left:28px"><span class="dots">${escapeHtml(data.customerEmail)}</span></div>` : ''}
      </div>
      <div class="meta-right">
        <div class="field">
          <span class="field-label">No.</span>
          <span class="dots">${escapeHtml(data.invoiceNumber)}</span>
        </div>
        <div class="field">
          <span class="field-label">Order No.:</span>
          <span class="dots">${escapeHtml(data.depositId.slice(0, 18))}</span>
        </div>
        <div class="field">
          <span class="field-label">Date:</span>
          <span class="dots">${dateStr}</span>
        </div>
      </div>
    </div>

    <div class="table-wrap">
      <div class="watermark">${WATERMARK_SVG}</div>
      <table class="items">
        <thead>
          <tr>
            <th>Qty</th>
            <th>Description</th>
            <th>Unit Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr class="item-row">
            <td>1</td>
            <td>${escapeHtml(description)}<br /><span style="font-weight:400;color:#555;font-size:11px">${escapeHtml(paymentNote)} · Ref: ${escapeHtml(data.depositId)}</span></td>
            <td>${data.grandTotal}</td>
            <td>${data.grandTotal}</td>
          </tr>
          ${emptyRows}
        </tbody>
      </table>
    </div>

    <div class="bottom-row">
      <div class="signatures">
        <div class="sig-field">
          <span class="field-label">Prepared by:</span>
          <span class="sig-line">${escapeHtml(data.companyName)} Billing System</span>
        </div>
        <div class="sig-field">
          <span class="field-label">Signature:</span>
          <span class="sig-line"></span>
        </div>
        <div class="sig-field">
          <span class="field-label">Received by:</span>
          <span class="sig-line"></span>
        </div>
        <div class="sig-field">
          <span class="field-label">Signature:</span>
          <span class="sig-line"></span>
        </div>
        <div class="status-stamp">${escapeHtml(data.status.toUpperCase())}</div>
      </div>
      <div class="totals">
        <div class="total-row">
          <span>Sub-Total</span>
          <div class="total-box">${data.subTotal}</div>
        </div>
        <div class="total-row">
          <span>VAT 16%</span>
          <div class="total-box">${data.vatAmount}</div>
        </div>
        <div class="total-row">
          <span>Grand Total K</span>
          <div class="total-box">${data.grandTotal}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-left">
        <div>${escapeHtml(data.companyAddress)}</div>
        ${data.companyPhones ? `<div>Cell: ${escapeHtml(data.companyPhones)}</div>` : ''}
        <div>Email: ${escapeHtml(data.supportEmail)}</div>
        <div>Website: ${escapeHtml(data.website.replace(/^https?:\/\//, ''))}</div>
      </div>
      ${data.bankName || data.bankAccountNumber ? `
      <div class="footer-right">
        ${data.bankName ? `<p>Bank Name: ${escapeHtml(data.bankName)}</p>` : ''}
        ${data.bankBranch ? `<p>Branch: ${escapeHtml(data.bankBranch)}</p>` : ''}
        <p>Account Name: ${escapeHtml(data.bankAccountName)}</p>
        ${data.bankAccountNumber ? `<p>Account Number: ${escapeHtml(data.bankAccountNumber)}</p>` : ''}
      </div>` : ''}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
