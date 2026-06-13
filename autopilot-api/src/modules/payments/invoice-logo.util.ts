import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Matches Logo.tsx (`h-24` → 96px). */
export const INVOICE_LOGO_HEIGHT_PX = 96;

/** Compact logo for exported analytics PDF reports. */
export const REPORT_PDF_LOGO_HEIGHT_PX = 48;

/** Intrinsic size of public/mako-logo.png */
const LOGO_WIDTH = 677;
const LOGO_HEIGHT = 369;

const LOGO_FILENAME = 'mako-logo.png';

export function invoiceLogoWidth(height = INVOICE_LOGO_HEIGHT_PX): number {
  return height * (LOGO_WIDTH / LOGO_HEIGHT);
}

function logoCandidates(): string[] {
  return [
    join(process.cwd(), 'public', LOGO_FILENAME),
    join(__dirname, '..', '..', '..', 'public', LOGO_FILENAME),
  ];
}

export function resolveInvoiceLogoPath(): string | null {
  for (const candidate of logoCandidates()) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function getInvoiceLogoDataUri(): string | null {
  const logoPath = resolveInvoiceLogoPath();
  if (!logoPath) return null;
  const buffer = readFileSync(logoPath);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

export function renderInvoiceLogoHtml(): string {
  const dataUri = getInvoiceLogoDataUri();
  if (!dataUri) return '';
  return `<img src="${dataUri}" alt="Mako" class="brand-logo" />`;
}

export type PdfLogoPlacement = {
  drawn: boolean;
  width: number;
  height: number;
};

/** Draw mako-logo.png at (x, y). Returns dimensions when drawn. */
export function drawMakoLogoPdf(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  height = INVOICE_LOGO_HEIGHT_PX,
): PdfLogoPlacement {
  const logoPath = resolveInvoiceLogoPath();
  if (!logoPath) return { drawn: false, width: 0, height: 0 };
  const w = invoiceLogoWidth(height);
  doc.image(logoPath, x, y, { height });
  return { drawn: true, width: w, height };
}
