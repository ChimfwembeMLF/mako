import { API_BASE_URL } from '@/lib/api';

export interface MediaAsset {
  id: string;
  mediaUrl: string;
  mediaType: string;
  name: string | null;
  fileSizeBytes: number | null;
  createdAt: string | null;
  contentId?: string | null;
}

export function resolveMediaUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL.replace(/\/$/, '')}${url}`;
  return url;
}

export function normalizeMediaAsset(row: Record<string, unknown>): MediaAsset {
  return {
    id: String(row.id),
    mediaUrl: String(row.mediaUrl ?? row.media_url ?? ''),
    mediaType: String(row.mediaType ?? row.media_type ?? 'image'),
    name: row.name != null ? String(row.name) : null,
    fileSizeBytes:
      row.fileSizeBytes != null
        ? Number(row.fileSizeBytes)
        : row.file_size_bytes != null
          ? Number(row.file_size_bytes)
          : null,
    createdAt: row.created_at != null ? String(row.created_at) : null,
    contentId:
      row.contentId != null
        ? String(row.contentId)
        : row.content_id != null
          ? String(row.content_id)
          : null,
  };
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
