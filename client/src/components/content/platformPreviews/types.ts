import { PlatformPayload } from '@/lib/platforms';

export type PlatformPreviewEngagement = {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
};

export interface SocialPreviewProps {
  payload: PlatformPayload;
  mode?: 'draft' | 'published';
  authorName?: string;
  publishedAt?: string | null;
  engagement?: PlatformPreviewEngagement;
  className?: string;
}
