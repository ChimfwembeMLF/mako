import { PlatformPayload } from '@/lib/platforms';

export interface ContentItem {
  id: string;
  title?: string;
  content?: string;
  content_type?: string;
  workspaceId?: string;
  workspace_id?: string;
  platforms?: string[];
  platformPayloads?: Record<string, PlatformPayload>;
  campaign_theme?: string;
  status?: string;
  created_at?: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  publish_failed_reason?: string | null;
  /** First attached image or video, for list thumbnails. */
  preview_url?: string | null;
  preview_type?: string | null;
  media_count?: number;
}
