import { BadRequestException } from '@nestjs/common';
import { ParseDocumentService } from './parse-document.service';

jest.mock('../../ai/services/ai-provider-router.service', () => ({
  AiProviderRouter: class {},
}));
jest.mock('../../ai/services/ai-usage-tracker.service', () => ({
  AiUsageTrackerService: class {},
}));

const getText = jest.fn();
// pdfjs can't start under Jest (it needs --experimental-vm-modules).
jest.mock('pdf-parse', () => ({
  PDFParse: class {
    getText = (...args: unknown[]) => getText(...args);
    destroy = jest.fn().mockResolvedValue(undefined);
  },
}));

const failingWith = (name: string) =>
  Object.assign(new Error(name), { name });

describe('ParseDocumentService', () => {
  const completeJson = jest.fn().mockResolvedValue({ data: {}, tokensUsed: 1 });
  const service = new ParseDocumentService(
    { completeJson, premiumModel: 'test' } as any,
    { assertWithinLimit: jest.fn(), record: jest.fn() } as any,
  );
  const parse = (buffer: Buffer, fileName: string, mimeType = 'application/pdf') =>
    service.parse({ buffer, fileName, mimeType, tenantId: 't', userId: 'u' });

  beforeEach(() => {
    completeJson.mockClear();
    getText.mockReset();
  });

  it('sends the text of a normal PDF to the AI', async () => {
    getText.mockResolvedValue({ text: 'Mako brand guide' });
    await parse(Buffer.from('pdf'), 'brand.pdf');
    expect(completeJson.mock.calls[0][0][1].content).toContain('Mako brand guide');
  });

  it('turns off the page markers that make a scan look like text', async () => {
    getText.mockResolvedValue({ text: 'text' });
    await parse(Buffer.from('pdf'), 'brand.pdf');
    expect(getText).toHaveBeenCalledWith({ pageJoiner: '' });
  });

  it('rejects a PDF with no text instead of asking the AI to guess', async () => {
    getText.mockResolvedValue({ text: '\n\n' });
    await expect(parse(Buffer.from('pdf'), 'scan.pdf')).rejects.toThrow(
      'No readable text found',
    );
    expect(completeJson).not.toHaveBeenCalled();
  });

  it('explains a damaged PDF', async () => {
    getText.mockRejectedValue(failingWith('InvalidPDFException'));
    const result = parse(Buffer.from('not a pdf'), 'bad.pdf');
    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toThrow("couldn't be read");
  });

  it('explains a password protected PDF', async () => {
    getText.mockRejectedValue(failingWith('PasswordException'));
    await expect(parse(Buffer.from('pdf'), 'locked.pdf')).rejects.toThrow(
      'password protected',
    );
  });

  it("doesn't blame the file for an unexpected server fault", async () => {
    getText.mockRejectedValue(new Error('worker crashed'));
    await expect(parse(Buffer.from('pdf'), 'brand.pdf')).rejects.toThrow(
      'worker crashed',
    );
  });

  it('explains an unreadable Word file', async () => {
    await expect(
      parse(Buffer.from('old doc format'), 'old.doc', 'application/msword'),
    ).rejects.toThrow('Save it as .docx');
  });

  it('rejects unsupported file types', async () => {
    await expect(parse(Buffer.from('x'), 'a.png', 'image/png')).rejects.toThrow(
      'Unsupported file type',
    );
  });
});
