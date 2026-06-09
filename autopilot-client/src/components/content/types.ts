import { PlatformPayload } from '@/lib/platforms';

export interface ContentItem {
  id: string;
  title?: string;
  content?: string;
  content_type?: string;
  platforms?: string[];
  platformPayloads?: Record<string, PlatformPayload>;
  campaign_theme?: string;
  status?: string;
  created_at?: string;
}
