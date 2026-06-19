import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { google } from 'googleapis';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';
import { YoutubePublishingService } from './youtube-publishing.service';
import { SocialPublishAccountService } from './social-publish-account.service';
import { summarizeAxiosError } from './publish-error.util';

const GRAPH_API = 'https://graph.facebook.com/v20.0';

@Injectable()
export class SendCommentReplyService {
  private readonly logger = new Logger(SendCommentReplyService.name);

  constructor(
    @InjectRepository(CommentReplies)
    private readonly commentsRepo: Repository<CommentReplies>,
    @InjectRepository(SocialAccounts)
    private readonly socialRepo: Repository<SocialAccounts>,
    @InjectRepository(ContentPublications)
    private readonly publicationsRepo: Repository<ContentPublications>,
    private readonly youtubePublish: YoutubePublishingService,
    private readonly publishAccounts: SocialPublishAccountService,
  ) {}

  async sendReply(params: {
    commentReplyId: string;
    userId: string;
    message: string;
    replyType?: 'manual' | 'auto_reply';
    ruleId?: string;
  }) {
    const reply = await this.commentsRepo.findOne({
      where: { id: params.commentReplyId },
    });
    if (!reply) throw new NotFoundException('Comment reply not found');

    let account =
      (await this.socialRepo.findOne({
        where: {
          tenantId: reply.tenantId,
          platform: reply.platform,
          connected: true,
        },
      })) ??
      (await this.socialRepo.findOne({
        where: {
          userId: params.userId,
          platform: reply.platform,
          connected: true,
        },
      }));
    if (!account) {
      throw new NotFoundException(
        `No connected ${reply.platform} account for this workspace — reconnect in Publisher Connect`,
      );
    }
    account = await this.publishAccounts.prepareAccount(account);

    const pub = await this.publicationsRepo.findOne({
      where: {
        contentId: reply.contentId,
        platform: reply.platform,
        externalPostId: reply.externalPostId,
        status: 'published',
      },
    });

    try {
      switch (reply.platform.toLowerCase()) {
        case 'facebook':
          await this.replyFacebook(
            reply.externalCommentId,
            params.message,
            account,
          );
          break;
        case 'instagram':
          await this.replyInstagram(
            reply.externalCommentId,
            params.message,
            account,
          );
          break;
        case 'linkedin':
          await this.replyLinkedIn(
            reply,
            params.message,
            account,
            pub?.externalPostId,
          );
          break;
        case 'youtube':
          await this.replyYoutube(
            reply.externalCommentId,
            params.message,
            account,
          );
          break;
        default:
          throw new NotFoundException(
            `Replies not supported for ${reply.platform}`,
          );
      }

      await this.commentsRepo.update(reply.id, {
        replyText: params.message,
        replyType: params.replyType ?? 'manual',
        ruleId: params.ruleId,
        status: 'sent',
        sentAt: new Date(),
      } as Partial<CommentReplies>);

      return { sent: true };
    } catch (err) {
      const summary = summarizeAxiosError(err);
      this.logger.error(
        `Failed to send reply on ${reply.platform}: ${summary}`,
      );
      await this.commentsRepo.update(reply.id, {
        status: 'failed',
      } as Partial<CommentReplies>);
      throw err;
    }
  }

  private async replyFacebook(
    commentId: string,
    message: string,
    account: SocialAccounts,
  ) {
    const token = this.publishAccounts.getFacebookPageToken(account);
    if (!token?.trim()) {
      throw new NotFoundException(
        'Facebook page token missing — reconnect Facebook in Publisher Connect',
      );
    }
    await axios.post(`${GRAPH_API}/${commentId}/comments`, null, {
      params: { message, access_token: token },
    });
  }

  private async replyInstagram(
    commentId: string,
    message: string,
    account: SocialAccounts,
  ) {
    const token = this.publishAccounts.getInstagramToken(account);
    if (!token?.trim()) {
      throw new NotFoundException(
        'Instagram page token missing — reconnect Instagram in Publisher Connect',
      );
    }
    await axios.post(`${GRAPH_API}/${commentId}/replies`, null, {
      params: { message, access_token: token },
    });
  }

  private async replyLinkedIn(
    reply: CommentReplies,
    message: string,
    account: SocialAccounts,
    postUrn?: string,
  ) {
    const token = account.accessToken;
    const actor = account.metadata?.person_urn ?? account.externalId;
    if (!postUrn || !actor) {
      throw new NotFoundException(
        'LinkedIn reply requires post URN and person URN',
      );
    }

    await axios.post(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(
        postUrn,
      )}/comments`,
      {
        actor,
        message: { text: message },
        object: postUrn,
        parentComment: reply.parentCommentId
          ? `urn:li:comment:(${postUrn},${reply.parentCommentId})`
          : undefined,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    );
  }

  private async replyYoutube(
    commentId: string,
    message: string,
    account: SocialAccounts,
  ) {
    const auth = this.youtubePublish.oauthClient(account);
    const youtube = google.youtube({ version: 'v3', auth });
    await youtube.comments.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          parentId: commentId,
          textOriginal: message,
        },
      },
    });
  }
}
