import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { REPORT_CATALOG } from './report-catalog';
import {
  REPORT_PDF_LOGO_HEIGHT_PX,
  drawMakoLogoPdf,
} from '../payments/invoice-logo.util';

export type ReportExportFormat = 'pdf' | 'csv' | 'xlsx';

export type ReportSection = {
  title: string;
  headers: string[];
  rows: string[][];
};

function formatCell(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function reportTitle(reportId: string): string {
  return REPORT_CATALOG.find((r) => r.id === reportId)?.name ?? reportId;
}

/** Normalize report JSON into tabular sections for export. */
export function reportDataToSections(
  data: Record<string, unknown>,
  title: string,
): ReportSection[] {
  const sections: ReportSection[] = [];

  if (data.error) {
    return [
      { title: 'Error', headers: ['Message'], rows: [[String(data.error)]] },
    ];
  }

  const summaryRows: string[][] = [
    ['Report', title],
    ['Generated', formatCell(data.generatedAt ?? new Date().toISOString())],
  ];

  for (const key of [
    'plan',
    'totalCalls',
    'total',
    'pending',
    'sent',
    'newThisWeek',
  ] as const) {
    if (data[key] !== undefined && typeof data[key] !== 'object') {
      summaryRows.push([key, formatCell(data[key])]);
    }
  }

  sections.push({
    title: 'Summary',
    headers: ['Field', 'Value'],
    rows: summaryRows,
  });

  if (Array.isArray(data.rows) && data.rows.length > 0) {
    const rows = data.rows as Record<string, unknown>[];
    const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    sections.push({
      title: 'Data',
      headers,
      rows: rows.map((r) => headers.map((h) => formatCell(r[h]))),
    });
  }

  if (Array.isArray(data.recentPayments) && data.recentPayments.length > 0) {
    const rows = data.recentPayments as Record<string, unknown>[];
    const headers = Object.keys(rows[0]);
    sections.push({
      title: 'Recent payments',
      headers,
      rows: rows.map((r) => headers.map((h) => formatCell(r[h]))),
    });
  }

  const kvBlocks: Array<{ key: string; title: string }> = [
    { key: 'byStatus', title: 'By status' },
    { key: 'byPlatform', title: 'By platform' },
    { key: 'byFunction', title: 'By function' },
    { key: 'counts', title: 'Lead counts' },
    { key: 'thisWeek', title: 'This week' },
    { key: 'lastWeek', title: 'Last week' },
  ];

  for (const block of kvBlocks) {
    const val = data[block.key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      sections.push({
        title: block.title,
        headers: ['Key', 'Value'],
        rows: Object.entries(val as Record<string, unknown>).map(([k, v]) => [
          k,
          formatCell(v),
        ]),
      });
    }
  }

  if (data.subscription && typeof data.subscription === 'object') {
    sections.push({
      title: 'Subscription',
      headers: ['Field', 'Value'],
      rows: Object.entries(data.subscription as Record<string, unknown>).map(
        ([k, v]) => [k, formatCell(v)],
      ),
    });
  }

  if (data.billingPeriod && typeof data.billingPeriod === 'object') {
    sections.push({
      title: 'Billing period',
      headers: ['Field', 'Value'],
      rows: Object.entries(data.billingPeriod as Record<string, unknown>).map(
        ([k, v]) => [k, formatCell(v)],
      ),
    });
  }

  return sections;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function renderReportCsv(
  sections: ReportSection[],
  title: string,
): Buffer {
  const lines: string[] = [`# ${title}`];
  for (const section of sections) {
    lines.push('');
    lines.push(`## ${section.title}`);
    lines.push(section.headers.map(escapeCsvCell).join(','));
    for (const row of section.rows) {
      lines.push(row.map(escapeCsvCell).join(','));
    }
  }
  return Buffer.from(lines.join('\n'), 'utf-8');
}

function collectPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export async function renderReportPdf(
  sections: ReportSection[],
  title: string,
): Promise<Buffer> {
  const MARGIN = 40;
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
  const done = collectPdf(doc);
  const pageWidth = 595.28 - MARGIN * 2;

  const drawReportHeader = () => {
    const headerTop = doc.y;
    const logo = drawMakoLogoPdf(
      doc,
      MARGIN,
      headerTop,
      REPORT_PDF_LOGO_HEIGHT_PX,
    );
    const textY = headerTop + (logo.drawn ? logo.height + 10 : 0);
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#111')
      .text(title, MARGIN, textY, { width: pageWidth });
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#666')
      .text(`Generated ${new Date().toLocaleString()}`, MARGIN, doc.y + 2, {
        width: pageWidth,
      });
    doc.y = doc.y + 18;
  };

  drawReportHeader();

  doc.on('pageAdded', () => {
    doc.y = MARGIN;
  });

  for (const section of sections) {
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#111')
      .text(section.title);
    doc.moveDown(0.3);

    const colCount = section.headers.length;
    const colWidth = pageWidth / colCount;

    doc.fontSize(8).font('Helvetica-Bold');
    let x = MARGIN;
    const headerY = doc.y;
    for (const h of section.headers) {
      doc.text(h, x, headerY, { width: colWidth - 4, ellipsis: true });
      x += colWidth;
    }
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(8);
    for (const row of section.rows) {
      if (doc.y > 750) doc.addPage();
      const rowY = doc.y;
      x = MARGIN;
      for (let i = 0; i < colCount; i++) {
        doc.text(row[i] ?? '', x, rowY, {
          width: colWidth - 4,
          ellipsis: true,
        });
        x += colWidth;
      }
      doc.moveDown(0.4);
    }
    doc.moveDown(0.8);
  }

  doc.end();
  return done;
}

function safeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/*?:[\]]/g, '').slice(0, 28) || 'Sheet';
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base.slice(0, 25)} ${n}`;
    n++;
  }
  used.add(candidate);
  return candidate;
}

export async function renderReportXlsx(
  sections: ReportSection[],
  title: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Mako ';
  workbook.created = new Date();

  const used = new Set<string>();
  for (const section of sections) {
    const sheet = workbook.addWorksheet(safeSheetName(section.title, used));
    sheet.addRow([title]);
    sheet.addRow([`Generated ${new Date().toISOString()}`]);
    sheet.addRow([]);
    sheet.addRow(section.headers);
    const headerRow = sheet.lastRow;
    if (headerRow) {
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8EEF7' },
      };
    }
    for (const row of section.rows) {
      sheet.addRow(row);
    }
    sheet.columns.forEach((col) => {
      col.width = 18;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function reportExportFilename(
  reportId: string,
  format: ReportExportFormat,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const ext = format === 'xlsx' ? 'xlsx' : format;
  return `mako-${reportId}-${date}.${ext}`;
}

export function reportExportMime(format: ReportExportFormat): string {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'csv':
      return 'text/csv; charset=utf-8';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
}
