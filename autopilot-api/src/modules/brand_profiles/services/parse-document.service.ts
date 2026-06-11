import { Injectable, BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { MistralChatService } from '../../ai/services/mistral-chat.service';
import { AiUsageTrackerService } from '../../ai/services/ai-usage-tracker.service';
import {
  brandExtractionSystemPrompt,
  normalizeBrandExtraction,
} from '../../ai/prompts/brand-fields';

@Injectable()
export class ParseDocumentService {
  constructor(
    private readonly mistral: MistralChatService,
    private readonly usage: AiUsageTrackerService,
  ) {}

  async parse(params: {
    buffer: Buffer;
    mimeType: string;
    fileName: string;
    tenantId: string;
    userId: string;
  }): Promise<Partial<Record<string, string>>> {
    await this.usage.assertWithinLimit(params.tenantId, params.userId);

    const text = await this.extractTextFromBuffer(params.buffer, params.mimeType, params.fileName);
    if (!text.trim()) {
      throw new BadRequestException('No readable text found in document');
    }

    const { data, tokensUsed } = await this.mistral.completeJson<Record<string, unknown>>(
      [
        { role: 'system', content: brandExtractionSystemPrompt() },
        {
          role: 'user',
          content: `Document: ${params.fileName}\n\nExtract a complete brand profile. Fill every JSON key.\n\n${text.slice(0, 24000)}`,
        },
      ],
      { model: this.mistral.premiumModel },
    );

    await this.usage.record({
      tenantId: params.tenantId,
      userId: params.userId,
      functionName: 'parse-brand-document',
      tokensUsed,
    });

    return normalizeBrandExtraction(data);
  }

  /** Extract plain text from PDF, DOCX, or TXT — used by Brand Brain and knowledge ingestion. */
  async extractTextFromBuffer(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
    const lower = fileName.toLowerCase();
    if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
      return this.extractPdfText(buffer);
    }
    if (
      mimeType.includes('wordprocessingml') ||
      mimeType === 'application/msword' ||
      lower.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value ?? '';
    }
    if (mimeType.startsWith('text/') || lower.endsWith('.txt')) {
      return buffer.toString('utf8');
    }
    throw new BadRequestException('Unsupported file type. Use PDF, DOCX, or TXT.');
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text ?? '';
    } finally {
      await parser.destroy();
    }
  }
}
