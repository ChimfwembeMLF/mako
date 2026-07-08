import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentPublications } from './entities/content_publications.entity';
import { scopeWhere } from '../../common/workspace-scope.util';

export type TopPerformingPost = {
  id: string;
  contentId: string;
  platform: string;
  publishedTitle: string | null;
  publishedContent: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  engagementScore: number;
  publishedAt: string | null;
};

@Injectable()
export class EngagementInsightsService {
  constructor(
    @InjectRepository(ContentPublications)
    private readonly repo: Repository<ContentPublications>,
  ) {}

  async getTopPerforming(
    tenantId: string,
    limit = 5,
    workspaceId?: string,
  ): Promise<TopPerformingPost[]> {
    const rows = await this.repo.find({
      where: {
        ...scopeWhere<ContentPublications>(tenantId, workspaceId),
        status: 'published',
      },
      order: { engagementScore: 'DESC', publishedAt: 'DESC' },
      take: Math.min(limit, 20),
    });

    return rows
      .filter(
        (r) => r.engagementScore > 0 || r.likeCount > 0 || r.commentCount > 0,
      )
      .map((r) => ({
        id: r.id,
        contentId: r.contentId,
        platform: r.platform,
        publishedTitle: r.publishedTitle ?? null,
        publishedContent: stripHtml(r.publishedContent).slice(0, 400),
        likeCount: r.likeCount,
        commentCount: r.commentCount,
        shareCount: r.shareCount,
        viewCount: r.viewCount,
        engagementScore: r.engagementScore,
        publishedAt: r.publishedAt?.toISOString() ?? null,
      }));
  }

  formatForAiPrompt(posts: TopPerformingPost[]): string {
    if (!posts.length) return '';

    const lines = posts.map((p, i) => {
      const metrics = [
        p.likeCount > 0 ? `${p.likeCount} likes` : null,
        p.commentCount > 0 ? `${p.commentCount} comments` : null,
        p.shareCount > 0 ? `${p.shareCount} shares` : null,
        p.viewCount > 0 ? `${p.viewCount} views` : null,
        `score ${p.engagementScore}`,
      ]
        .filter(Boolean)
        .join(', ');
      const title = p.publishedTitle?.trim() || 'Untitled';
      const excerpt = p.publishedContent.slice(0, 200);
      return `${i + 1}. [${p.platform}] "${title}" (${metrics})\n   ${excerpt}`;
    });

    return `Top performing published content (replicate hooks, tone, and structure that drove engagement):\n${lines.join(
      '\n',
    )}`;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
