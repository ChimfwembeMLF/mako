import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentPublications } from './entities/content_publications.entity';
import { scopeWhere } from '../../common/workspace-scope.util';

export type RecordPublicationParams = {
  tenantId: string;
  workspaceId?: string;
  contentId: string;
  userId: string;
  platform: string;
  publishedContent: string;
  publishedTitle?: string;
  publishedMedia?: Array<{ url: string; type?: string; name?: string }>;
  externalPostId?: string;
  socialAccountId?: string;
  status: 'published' | 'failed';
  errorMessage?: string;
};

@Injectable()
export class ContentPublicationsService {
  constructor(
    @InjectRepository(ContentPublications)
    private readonly repo: Repository<ContentPublications>,
  ) {}

  async record(params: RecordPublicationParams): Promise<ContentPublications> {
    return this.repo.save(
      this.repo.create({
        tenantId: params.tenantId,
        workspaceId: params.workspaceId,
        contentId: params.contentId,
        userId: params.userId,
        platform: params.platform,
        publishedContent: params.publishedContent,
        publishedTitle: params.publishedTitle,
        publishedMedia: params.publishedMedia,
        externalPostId: params.externalPostId,
        socialAccountId: params.socialAccountId,
        status: params.status,
        errorMessage: params.errorMessage,
        publishedAt: params.status === 'published' ? new Date() : undefined,
      }),
    );
  }

  async findPublishedForTenant(
    tenantId: string,
    workspaceId?: string,
  ): Promise<ContentPublications[]> {
    return this.repo.find({
      where: {
        ...scopeWhere<ContentPublications>(tenantId, workspaceId),
        status: 'published',
      },
      order: { publishedAt: 'DESC' },
    });
  }

  async findByContentId(contentId: string): Promise<ContentPublications[]> {
    return this.repo.find({
      where: { contentId },
      order: { created_at: 'DESC' },
    });
  }

  /** Latest successful publication per platform for a content item */
  async findLatestPublishedByContent(
    contentId: string,
  ): Promise<ContentPublications[]> {
    const rows = await this.repo.find({
      where: { contentId, status: 'published' },
      order: { publishedAt: 'DESC' },
    });
    const seen = new Set<string>();
    return rows.filter((r) => {
      if (!r.externalPostId || seen.has(r.platform)) return false;
      seen.add(r.platform);
      return true;
    });
  }
}
