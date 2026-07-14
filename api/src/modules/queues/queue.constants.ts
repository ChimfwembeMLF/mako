export const QUEUE_CONTENT_PUBLISH = 'content-publish';
export const QUEUE_COMMENTS = 'comments';
export const QUEUE_WEBHOOKS = 'webhooks';
export const QUEUE_AI = 'ai';
export const QUEUE_EMAIL = 'email';

/** Max BullMQ attempts (initial run + retries). Jobs are not retried beyond this. */
export const QUEUE_JOB_MAX_ATTEMPTS = 5;

export const JOB_PUBLISH_CONTENT = 'publish-content';
export const JOB_AUTO_PUBLISH_SCAN = 'auto-publish-scan';
export const JOB_AUTO_PUBLISH_TENANT = 'auto-publish-tenant';
export const JOB_SYNC_TENANT_COMMENTS = 'sync-tenant-comments';
export const JOB_SYNC_ALL_COMMENTS = 'sync-all-comments';
export const JOB_WHATSAPP_INBOUND = 'whatsapp-inbound';
export const JOB_LEAD_WEBHOOK = 'lead-webhook';
export const JOB_SEND_EMAIL = 'send-email';
export const JOB_AI_TASK = 'ai-task';
export const JOB_INGEST_DOCUMENT = 'ingest-document';

export type IngestDocumentJobData = {
  tenantId: string;
  documentId: string;
  userId: string;
};

export const ALL_QUEUES = [
  QUEUE_CONTENT_PUBLISH,
  QUEUE_COMMENTS,
  QUEUE_WEBHOOKS,
  QUEUE_AI,
  QUEUE_EMAIL,
] as const;

export type AiTaskType =
  | 'generate-content'
  | 'repurpose-content'
  | 'adapt-platforms'
  | 'generate-image'
  | 'generate-slideshow'
  | 'daily-workflow'
  | 'suggest-comment-reply';

export type AutoPublishTenantJobData = {
  tenantId: string;
};

export type PublishContentJobData = {
  tenantId: string;
  contentId: string;
  userId: string;
  platforms?: string[];
  platformPayloads?: Record<
    string,
    {
      content?: string;
      title?: string;
      media?: Array<{ url: string; type?: string; name?: string }>;
      whatsappTemplate?: string;
      whatsappTemplateLanguage?: string;
      whatsappUseTemplate?: boolean;
    }
  >;
};

export type SyncTenantCommentsJobData = {
  tenantId: string;
  userId: string;
  workspaceId?: string;
  runAutoReply?: boolean;
};

export type WhatsappInboundJobData = {
  body: unknown;
};

export type LeadWebhookJobData = {
  sourceId: string;
  payload: Record<string, unknown>;
};

export type SendEmailJobData = {
  to: string;
  subject: string;
  body: string;
  html?: string;
  userId?: string;
};

export type AiTaskJobData = {
  type: AiTaskType;
  userId: string;
  tenantId?: string;
  payload: Record<string, unknown>;
};

export type SendNotificationEmailJobData = {
  userId: string;
  tenantId: string;
  subject: string;
  body: string;
  notificationId?: string;
};
