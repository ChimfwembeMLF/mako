import { createPdfDocument } from './pdfkit.util';

describe('createPdfDocument', () => {
  it('creates a PDF document without default import constructor errors', async () => {
    const doc = createPdfDocument({ size: 'A4', margin: 40 });
    const done = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fontSize(12).text('Invoice test');
    doc.end();

    const pdf = await done;
    expect(pdf.length).toBeGreaterThan(500);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
