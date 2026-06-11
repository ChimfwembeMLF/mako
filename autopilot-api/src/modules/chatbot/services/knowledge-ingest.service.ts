import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { ParseDocumentService } from '../../brand_profiles/services/parse-document.service';
import { SupabaseStorageService } from '../../media/supabase-storage.service';
import { MistralChatService } from '../../ai/services/mistral-chat.service';
import { AiUsageTrackerService } from '../../ai/services/ai-usage-tracker.service';
import { VectorStoreService } from './vector-store.service';
import { ChatbotConfigService } from './chatbot-config.service';
import { MistralChatbotLibraryService } from './mistral-chatbot-library.service';
import { chunkText, estimateTokens } from '../utils/text-chunk.util';

const EMBED_BATCH_SIZE = 16;

@Injectable()
export class KnowledgeIngestService {
  private readonly logger = new Logger(KnowledgeIngestService.name);

  constructor(
    @InjectRepository(KnowledgeDocument)
    private readonly docRepo: Repository<KnowledgeDocument>,
    private readonly parseDocument: ParseDocumentService,
    private readonly storage: SupabaseStorageService,
    private readonly mistral: MistralChatService,
    private readonly usage: AiUsageTrackerService,
    private readonly vectorStore: VectorStoreService,
    private readonly chatbotConfig: ChatbotConfigService,
    private readonly mistralLibrary: MistralChatbotLibraryService,
  ) {}

  async ingest(params: {
    tenantId: string;
    documentId: string;
    userId: string;
  }): Promise<{ chunkCount: number }> {
    const doc = await this.docRepo.findOne({
      where: { id: params.documentId, tenantId: params.tenantId },
    });
    if (!doc) {
      this.logger.warn(`Document ${params.documentId} not found`);
      return { chunkCount: 0 };
    }

    doc.status = 'processing';
    doc.errorMessage = undefined;
    await this.docRepo.save(doc);

    try {
      if (!doc.storageUrl) {
        throw new Error('No storage path on document');
      }

      const buffer = await this.storage.downloadBuffer(doc.storageUrl);

      const config = await this.chatbotConfig.getOrCreate(params.tenantId);
      if (config.useMistralLibrary && !this.mistralLibrary.getMistralDocumentId(doc)) {
        try {
          await this.mistralLibrary.uploadDocument({
            config,
            doc,
            buffer,
            fileName: doc.title,
            mimeType: doc.mimeType,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Mistral library upload failed for ${doc.id}: ${message}`);
          await this.mistralLibrary.recordSyncError(doc, message);
        }
      }

      const text = await this.parseDocument.extractTextFromBuffer(
        buffer,
        doc.mimeType ?? 'application/octet-stream',
        doc.title,
      );

      if (!text.trim()) {
        throw new Error('No readable text found in document');
      }

      await this.vectorStore.deleteByDocument(doc.id, params.tenantId);
      const chunks = chunkText(text);
      let totalTokens = 0;

      for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
        const embeddings = await this.mistral.embedBatch(batch);

        for (let j = 0; j < batch.length; j++) {
          const content = batch[j];
          const tokenCount = estimateTokens(content);
          totalTokens += tokenCount;
          await this.vectorStore.insertChunk({
            tenantId: params.tenantId,
            documentId: doc.id,
            chunkIndex: i + j,
            content,
            tokenCount,
            embedding: embeddings[j],
          });
        }
      }

      await this.usage.record({
        tenantId: params.tenantId,
        userId: params.userId,
        functionName: 'ingest-document',
        tokensUsed: totalTokens,
      });

      doc.status = 'ready';
      doc.chunkCount = chunks.length;
      doc.errorMessage = undefined;
      await this.docRepo.save(doc);

      return { chunkCount: chunks.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ingestion failed';
      this.logger.error(`Ingest failed for ${params.documentId}: ${message}`);
      doc.status = 'failed';
      doc.errorMessage = message;
      await this.docRepo.save(doc);
      throw err;
    }
  }
}
