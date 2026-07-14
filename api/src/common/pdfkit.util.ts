import type PDFKit from 'pdfkit';

type PdfDocumentCtor = new (
  options?: PDFKit.PDFDocumentOptions,
) => PDFKit.PDFDocument;

/** pdfkit is CJS-only; default import breaks at runtime without esModuleInterop. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfkitModule = require('pdfkit') as PdfDocumentCtor & {
  default?: PdfDocumentCtor;
};

const PDFDocument: PdfDocumentCtor = pdfkitModule.default ?? pdfkitModule;

export function createPdfDocument(
  options?: PDFKit.PDFDocumentOptions,
): PDFKit.PDFDocument {
  return new PDFDocument(options);
}
