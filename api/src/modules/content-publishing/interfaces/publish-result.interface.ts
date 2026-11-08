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
  /** The connected account chosen for this platform; otherwise the workspace default is used. */
  accountId?: string;
}

export interface MediaAttachment {
  id: string;
  media_url: string;
  media_type: 'image' | 'video' | 'document';
  alt_text?: string;
}
