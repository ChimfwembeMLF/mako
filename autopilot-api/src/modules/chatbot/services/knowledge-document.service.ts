import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { SupabaseStorageService } from '../../media/supabase-storage.service';
import { VectorStoreService } from './vector-store.service';
import { QueueDispatchService } from '../../queues/queue-dispatch.service';
import { KnowledgeIngestService } from './knowledge-ingest.service';
import { ChatbotConfigService } from './chatbot-config.service';
import { MistralChatbotLibraryService } from './mistral-chatbot-library.service';
import { scopeWhere } from '../../../common/workspace-scope.util';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
];

@Injectable()
export class KnowledgeDocumentService {
  constructor(
    @InjectRepository(KnowledgeDocument)
    private readonly docRepo: Repository<KnowledgeDocument>,
    private readonly storage: SupabaseStorageService,
    private readonly vectorStore: VectorStoreService,
    private readonly queueDispatch: QueueDispatchService,
    private readonly ingest: KnowledgeIngestService,
    private readonly chatbotConfig: ChatbotConfigService,
    private readonly mistralLibrary: MistralChatbotLibraryService,
  ) {}

  async list(
    tenantId: string,
    workspaceId?: string,
  ): Promise<KnowledgeDocument[]> {
    return this.docRepo.find({
      where: scopeWhere<KnowledgeDocument>(tenantId, workspaceId),
      order: { created_at: 'DESC' },
    });
  }

  async get(
    tenantId: string,
    id: string,
    workspaceId?: string,
  ): Promise<KnowledgeDocument> {
    const doc = await this.docRepo.findOne({
      where: { id, ...scopeWhere<KnowledgeDocument>(tenantId, workspaceId) },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async upload(params: {
    tenantId: string;
    userId: string;
    file: Express.Multer.File;
    workspaceId?: string;
  }): Promise<KnowledgeDocument> {
    if (!params.file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (params.file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('File exceeds 20 MB limit');
    }

    const mime = params.file.mimetype;
    const lower = params.file.originalname.toLowerCase();
    const allowed =
      ALLOWED_MIMES.includes(mime) ||
      lower.endsWith('.pdf') ||
      lower.endsWith('.docx') ||
      lower.endsWith('.txt') ||
      lower.endsWith('.md');

    if (!allowed) {
      throw new BadRequestException(
        'Unsupported file type. Use PDF, DOCX, TXT, or MD.',
      );
    }

    this.storage.assertConfigured();
    const uploaded = await this.storage.uploadBuffer({
      tenantId: params.tenantId,
      buffer: params.file.buffer,
      contentType: mime || 'application/octet-stream',
      originalName: params.file.originalname,
      prefix: 'knowledge',
    });

    const doc = this.docRepo.create({
      tenantId: params.tenantId,
      workspaceId: params.workspaceId,
      uploadedBy: params.userId,
      title: params.file.originalname,
      sourceType: 'upload',
      mimeType: mime,
      storageUrl: uploaded.storagePath,
      fileSizeBytes: String(params.file.size),
      status: 'pending',
    });
    const saved = await this.docRepo.save(doc);

    const config = await this.chatbotConfig.getOrCreateForContext(
      params.tenantId,
      params.workspaceId,
    );
    if (config.useMistralLibrary) {
      void this.mistralLibrary
        .uploadDocument({
          config,
          doc: saved,
          buffer: params.file.buffer,
          fileName: saved.title,
          mimeType: saved.mimeType,
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          void this.mistralLibrary.recordSyncError(saved, message);
        });
    }

    const queued = await this.queueDispatch.enqueueIngestDocument({
      tenantId: params.tenantId,
      documentId: saved.id,
      userId: params.userId,
    });
    if ((queued as { inline?: boolean }).inline) {
      void this.ingest.ingest({
        tenantId: params.tenantId,
        documentId: saved.id,
        userId: params.userId,
      });
    }

    return saved;
  }

  async delete(
    tenantId: string,
    id: string,
    workspaceId?: string,
  ): Promise<void> {
    const doc = await this.get(tenantId, id, workspaceId);
    const config = await this.chatbotConfig.getOrCreateForContext(
      tenantId,
      workspaceId,
    );
    await this.mistralLibrary.deleteDocument(config, doc);
    if (doc.storageUrl) {
      try {
        await this.storage.deleteByPath(doc.storageUrl);
      } catch {
        /* best effort */
      }
    }
    await this.vectorStore.deleteByDocument(id, tenantId);
    await this.docRepo.delete({ id, tenantId });
  }

  async rename(
    tenantId: string,
    id: string,
    title: string,
    workspaceId?: string,
  ): Promise<KnowledgeDocument> {
    const doc = await this.get(tenantId, id, workspaceId);
    const trimmed = title.trim();
    if (!trimmed) {
      throw new BadRequestException('title is required');
    }
    doc.title = trimmed;
    return this.docRepo.save(doc);
  }

  async syncMistral(tenantId: string): Promise<{ success: true }> {
    const config = await this.chatbotConfig.getOrCreate(tenantId);
    if (!config.useMistralLibrary) {
      throw new BadRequestException(
        'Enable Mistral Document Library in chatbot settings first',
      );
    }
    await this.mistralLibrary.syncUnsyncedDocuments(tenantId, config);
    return { success: true };
  }

  async reindex(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<KnowledgeDocument> {
    const doc = await this.get(tenantId, id);
    doc.status = 'pending';
    doc.errorMessage = undefined;
    doc.chunkCount = 0;
    await this.docRepo.save(doc);
    await this.vectorStore.deleteByDocument(id, tenantId);
    const queued = await this.queueDispatch.enqueueIngestDocument({
      tenantId,
      documentId: id,
      userId,
    });
    if ((queued as { inline?: boolean }).inline) {
      void this.ingest.ingest({ tenantId, documentId: id, userId });
    }
    return doc;
  }
}
