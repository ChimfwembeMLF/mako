export interface PublishResult {
  published: boolean;
  message: string;
  externalPostId?: string;
  error?: string;
}

export interface ContentToPublish {
  id: string;
  content: string;
  title?: string;
  userId: string;
  tenantId: string;
  workspaceId?: string;
}

export interface MediaAttachment {
  id: string;
  media_url: string;
  media_type: 'image' | 'video' | 'document';
  alt_text?: string;
}
