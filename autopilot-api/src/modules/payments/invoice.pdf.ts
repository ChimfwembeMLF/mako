import PDFDocument = require('pdfkit');
import { InvoiceData, buildInvoiceNumber } from './invoice.template';
import { drawMakoLogoPdf, INVOICE_LOGO_HEIGHT_PX } from './invoice-logo.util';

type PdfDoc = PDFKit.PDFDocument;

const PAGE_W = 595.28; // A4
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

function collectPdf(doc: PdfDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function drawHLine(doc: PdfDoc, y: number, x1 = MARGIN, x2 = PAGE_W - MARGIN) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor('#111').lineWidth(1).stroke();
}

function drawBox(doc: PdfDoc, x: number, y: number, w: number, h: number) {
  doc.rect(x, y, w, h).strokeColor('#111').lineWidth(1).stroke();
}

export function getInvoicePdfFilename(depositId: string): string {
  return `Mako -Tax-Invoice-${buildInvoiceNumber(depositId)}.pdf`;
}

export async function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
  const done = collectPdf(doc);

  const dateStr = new Date(data.paidAt ?? data.issuedAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const description = `${data.planLabel} Plan — Mako  subscription (monthly)`;
  const paymentNote = data.network
    ? `${data.paymentMethod} · ${data.network}${data.phone ? ` · ${data.phone}` : ''}`
  : data.paymentMethod;

  let y = MARGIN;
  const headerTop = y;

  const logo = drawMakoLogoPdf(doc, MARGIN, headerTop, INVOICE_LOGO_HEIGHT_PX);

  // Company block (right, aligned with logo row)
  doc.fontSize(10).fillColor('#111').font('Helvetica-Bold')
    .text(data.companyLegalName.toUpperCase(), MARGIN, headerTop, { width: CONTENT_W, align: 'right' });
  doc.font('Helvetica').fontSize(9)
    .text(data.companyAddress, MARGIN, headerTop + 14, { width: CONTENT_W, align: 'right' });
  if (data.companyTpin) {
    doc.fillColor('#2563eb').font('Helvetica-Bold')
      .text(`TPIN: ${data.companyTpin}`, MARGIN, headerTop + 28, { width: CONTENT_W, align: 'right' });
  }

  y = headerTop + (logo.drawn ? logo.height + 8 : 0);

  // TAX INVOICE title
  doc.fontSize(32).fillColor('#dc2626').font('Helvetica-Bold')
    .text('TAX INVOICE', MARGIN, y, { width: CONTENT_W, align: 'center' });

  y += 44;

  // Meta row
  const metaRightX = PAGE_W - MARGIN - 200;
  doc.fontSize(9).fillColor('#111').font('Helvetica-Bold').text('Client TPIN', MARGIN, y);
  doc.font('Helvetica').text('........................................', MARGIN + 62, y);

  doc.font('Helvetica-Bold').text('No.', metaRightX, y);
  doc.font('Helvetica').text(data.invoiceNumber, metaRightX + 52, y);

  y += 16;
  doc.font('Helvetica-Bold').text('M/s', MARGIN, y);
  doc.font('Helvetica').text(data.tenantName, MARGIN + 22, y, { width: 280 });

  doc.font('Helvetica-Bold').text('Order No.:', metaRightX, y);
  doc.font('Helvetica').text(data.depositId.slice(0, 20), metaRightX + 52, y);

  y += 14;
  if (data.customerEmail) {
    doc.font('Helvetica').text(data.customerEmail, MARGIN + 22, y, { width: 280 });
    y += 12;
  }

  doc.font('Helvetica-Bold').text('Date:', metaRightX, y);
  doc.font('Helvetica').text(dateStr, metaRightX + 52, y);

  y += 22;

  // Table header
  const colQty = 45;
  const colUnit = 75;
  const colAmt = 75;
  const colDesc = CONTENT_W - colQty - colUnit - colAmt;
  const tableX = MARGIN;
  const rowH = 22;
  const headerH = 24;

  drawBox(doc, tableX, y, CONTENT_W, headerH + rowH * 9);

  doc.rect(tableX, y, colQty, headerH).fillAndStroke('#f8fafc', '#111');
  doc.rect(tableX + colQty, y, colDesc, headerH).fillAndStroke('#f8fafc', '#111');
  doc.rect(tableX + colQty + colDesc, y, colUnit, headerH).fillAndStroke('#f8fafc', '#111');
  doc.rect(tableX + colQty + colDesc + colUnit, y, colAmt, headerH).fillAndStroke('#f8fafc', '#111');

  doc.fontSize(10).fillColor('#111').font('Helvetica-Bold');
  doc.text('Qty', tableX, y + 7, { width: colQty, align: 'center' });
  doc.text('Description', tableX + colQty + 6, y + 7);
  doc.text('Unit Price', tableX + colQty + colDesc, y + 7, { width: colUnit - 4, align: 'right' });
  doc.text('Amount', tableX + colQty + colDesc + colUnit, y + 7, { width: colAmt - 4, align: 'right' });

  const itemY = y + headerH;
  doc.moveTo(tableX, itemY).lineTo(tableX + CONTENT_W, itemY).strokeColor('#111').stroke();

  doc.font('Helvetica').fontSize(9);
  doc.text('1', tableX, itemY + 6, { width: colQty, align: 'center' });
  doc.text(description, tableX + colQty + 6, itemY + 4, { width: colDesc - 10 });
  doc.text(paymentNote, tableX + colQty + 6, itemY + 16, { width: colDesc - 10, lineBreak: false });
  doc.fontSize(7).fillColor('#555').text(`Ref: ${data.depositId}`, tableX + colQty + 6, itemY + 26, { width: colDesc - 10 });
  doc.fontSize(9).fillColor('#111');
  doc.text(data.grandTotal, tableX + colQty + colDesc, itemY + 8, { width: colUnit - 4, align: 'right' });
  doc.text(data.grandTotal, tableX + colQty + colDesc + colUnit, itemY + 8, { width: colAmt - 4, align: 'right' });

  // Empty rows
  for (let i = 1; i < 9; i++) {
    const ry = itemY + rowH * i;
    doc.moveTo(tableX, ry).lineTo(tableX + CONTENT_W, ry).strokeColor('#ddd').lineWidth(0.5).stroke();
  }

  y = itemY + rowH * 9 + 18;

  // Signatures + totals
  const totalsX = PAGE_W - MARGIN - 200;
  const boxW = 90;
  const boxH = 22;

  doc.fontSize(9).fillColor('#111').font('Helvetica-Bold');
  doc.text('Prepared by:', MARGIN, y);
  doc.font('Helvetica').text(`${data.companyName} Billing`, MARGIN + 68, y);

  doc.font('Helvetica-Bold').text('Sub-Total', totalsX, y);
  drawBox(doc, totalsX + 70, y - 2, boxW, boxH);
  doc.font('Helvetica').text(data.subTotal, totalsX + 74, y + 4, { width: boxW - 8, align: 'right' });

  y += 20;
  doc.font('Helvetica-Bold').text('Signature:', MARGIN, y);
  doc.text('................................', MARGIN + 52, y);

  doc.font('Helvetica-Bold').text('VAT 16%', totalsX, y);
  drawBox(doc, totalsX + 70, y - 2, boxW, boxH);
  doc.font('Helvetica').text(data.vatAmount, totalsX + 74, y + 4, { width: boxW - 8, align: 'right' });

  y += 20;
  doc.font('Helvetica-Bold').text('Received by:', MARGIN, y);
  doc.text('................................', MARGIN + 62, y);

  doc.font('Helvetica-Bold').text('Grand Total K', totalsX, y);
  drawBox(doc, totalsX + 70, y - 2, boxW, boxH);
  doc.font('Helvetica-Bold').text(data.grandTotal, totalsX + 74, y + 4, { width: boxW - 8, align: 'right' });

  y += 20;
  doc.font('Helvetica-Bold').text('Signature:', MARGIN, y);
  doc.text('................................', MARGIN + 52, y);

  // Status stamp
  const stampColor = data.status === 'Paid' ? '#16a34a' : data.status === 'Pending' ? '#d97706' : '#dc2626';
  doc.rect(MARGIN, y + 8, 56, 18).strokeColor(stampColor).lineWidth(1.5).stroke();
  doc.fontSize(8).fillColor(stampColor).font('Helvetica-Bold')
    .text(data.status.toUpperCase(), MARGIN, y + 12, { width: 56, align: 'center' });

  y += 50;

  // Footer
  drawHLine(doc, y, MARGIN, PAGE_W - MARGIN);
  y += 10;

  doc.fontSize(8).fillColor('#2563eb').font('Helvetica');
  doc.text(data.companyAddress, MARGIN, y, { width: 280 });
  if (data.companyPhones) doc.text(`Cell: ${data.companyPhones}`, MARGIN, y + 12);
  doc.text(`Email: ${data.supportEmail}`, MARGIN, y + 24);
  doc.text(`Website: ${data.website.replace(/^https?:\/\//, '')}`, MARGIN, y + 36);

  if (data.bankName || data.bankAccountNumber) {
    const bankX = PAGE_W - MARGIN - 240;
    doc.moveTo(bankX, y - 4).lineTo(PAGE_W - MARGIN, y - 4).strokeColor('#6366f1').lineWidth(2).stroke();
    doc.font('Helvetica-Bold');
    if (data.bankName) doc.text(`Bank Name: ${data.bankName}`, bankX, y, { width: 240 });
    if (data.bankBranch) doc.text(`Branch: ${data.bankBranch}`, bankX, y + 12, { width: 240 });
    doc.text(`Account Name: ${data.bankAccountName}`, bankX, y + 24, { width: 240 });
    if (data.bankAccountNumber) doc.text(`Account Number: ${data.bankAccountNumber}`, bankX, y + 36, { width: 240 });
    doc.moveTo(bankX, y + 52).lineTo(PAGE_W - MARGIN, y + 52).strokeColor('#2563eb').lineWidth(2).stroke();
  }

  doc.end();
  return done;
}
