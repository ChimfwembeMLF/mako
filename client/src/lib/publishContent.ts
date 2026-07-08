import { contentAiApi, contentItemsApi, waitForQueueJob } from '@/lib/api';
import { platformOf } from '@/lib/platforms';

export type PublishToast = (params: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

export type PublishJobResult = {
  published?: boolean;
  results?: Record<string, { published: boolean; message: string }>;
};

function truncateText(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function summarizePublishOutcome(
  results: Record<string, { published: boolean; message: string }>,
): { title: string; description: string; variant?: 'default' | 'destructive' } {
  const succeeded = Object.entries(results).filter(([, r]) => r.published);
  const failed = Object.entries(results).filter(([, r]) => !r.published);

  if (succeeded.length > 0 && failed.length > 0) {
    const okLabels = succeeded.map(([p]) => platformOf(p).label).join(', ');
    const failLabels = failed.map(([p]) => platformOf(p).label).join(', ');
    return {
      title: 'Partially published',
      description: `Sent to ${okLabels}. Failed on ${failLabels}: ${truncateText(failed[0][1].message, 80)}`,
      variant: 'destructive',
    };
  }

  if (failed.length === 0) {
    return { title: 'Published successfully', description: '' };
  }

  const failure = summarizePublishFailure(results);
  return { ...failure, variant: 'destructive' as const };
}

/** Send relative /uploads paths so the API can resolve public URLs server-side. */
export function toPublishMediaUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('/uploads/')) return url;
  if (/supabase\.co\/storage\//i.test(url)) return url;
  const match = url.match(/\/uploads\/[^?#]+/);
  if (match) return match[0];
  return url;
}

/** Resolve platforms and payloads for retry — only failed/not-yet-published when some already succeeded. */
export async function resolveRetryPublishArgs(contentId: string): Promise<{
  platforms: string[] | undefined;
  platformPayloads: Record<string, unknown> | undefined;
  alreadyComplete: boolean;
}> {
  const details = await contentItemsApi.getDetails(contentId);
  const item = details.item ?? {};
  const publications = (details.publications ?? []) as Array<{
    platform: string;
    status: string;
  }>;
  const itemPlatforms: string[] = item.platforms ?? [];
  const platformPayloads = item.platformPayloads as
    | Record<string, unknown>
    | undefined;

  const latestByPlatform = new Map<string, string>();
  for (const pub of publications) {
    if (!latestByPlatform.has(pub.platform)) {
      latestByPlatform.set(pub.platform, pub.status);
    }
  }

  const hasAnyPublished = [...latestByPlatform.values()].some((s) => s === 'published');
  if (!hasAnyPublished) {
    return { platforms: undefined, platformPayloads, alreadyComplete: false };
  }

  const pending = itemPlatforms.filter(
    (p) => latestByPlatform.get(p) !== 'published',
  );
  if (pending.length === 0) {
    return { platforms: [], platformPayloads, alreadyComplete: true };
  }

  return { platforms: pending, platformPayloads, alreadyComplete: false };
}

function toastPublishOutcome(
  toast: PublishToast,
  results: Record<string, { published: boolean; message: string }>,
  platforms: string[] | undefined,
  publishedFlag: boolean | undefined,
) {
  const outcome = summarizePublishOutcome(results);
  if (publishedFlag && Object.keys(results).length === 0) {
    toast({
      title: 'Published successfully',
      description:
        platforms?.map((p) => platformOf(p).label).join(', ') ?? 'All platforms',
    });
    return;
  }
  if (outcome.title === 'Published successfully') {
    const labels =
      platforms?.map((p) => platformOf(p).label).join(', ') ?? 'your platforms';
    toast({
      title: 'Published successfully',
      description: `Content was sent to ${labels}.`,
    });
    return;
  }
  toast({
    title: outcome.title,
    description: outcome.description || undefined,
    variant: outcome.variant,
  });
}

function summarizePublishFailure(
  results: Record<string, { published: boolean; message: string }>,
): { title: string; description: string } {
  const failed = Object.entries(results).filter(([, r]) => !r.published);
  if (failed.length === 0) {
    return {
      title: 'Publish failed',
      description: 'Check platform connections and try again.',
    };
  }

  if (failed.length === 1) {
    const [platform, result] = failed[0];
    return {
      title: `${platformOf(platform).label} publish failed`,
      description: truncateText(result.message, 100),
    };
  }

  const labels = failed.map(([p]) => platformOf(p).label).join(', ');
  const firstError = truncateText(failed[0][1].message, 80);
  return {
    title: `${failed.length} platforms failed`,
    description: `${labels}. ${firstError}`,
  };
}

export async function submitPublish(
  contentId: string,
  platforms: string[] | undefined,
  platformPayloads: Record<string, unknown> | undefined,
  toast: PublishToast,
  opts?: { waitInForeground?: boolean; contentType?: string },
): Promise<PublishJobResult> {
  const response = await contentAiApi.publish(contentId, platforms, platformPayloads, {
    contentType: opts?.contentType,
  });

  if (response.queued && response.jobId != null && response.queue) {
    toast({
      title: 'Added to publish queue',
      description: response.message ?? 'Your content will publish shortly.',
    });

    const finish = async (): Promise<PublishJobResult> => {
      const result = (await waitForQueueJob(response.queue!, response.jobId!)) as PublishJobResult;
      toastPublishOutcome(
        toast,
        result?.results ?? {},
        platforms,
        result?.published,
      );
      return result;
    };

    if (opts?.waitInForeground) {
      return finish();
    }
    void finish();
    return { published: false };
  }

  toastPublishOutcome(
    toast,
    response.results ?? {},
    platforms,
    response.published,
  );

  return response;
}
