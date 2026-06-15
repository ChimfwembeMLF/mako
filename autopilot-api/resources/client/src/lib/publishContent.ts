import { contentAiApi, waitForQueueJob } from '@/lib/api';
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
      if (result?.published) {
        const labels =
          platforms?.map((p) => platformOf(p).label).join(', ') ?? 'your platforms';
        toast({
          title: 'Published successfully',
          description: `Content was sent to ${labels}.`,
        });
      } else {
        const failure = summarizePublishFailure(result?.results ?? {});
        toast({
          title: failure.title,
          description: failure.description,
          variant: 'destructive',
        });
      }
      return result;
    };

    if (opts?.waitInForeground) {
      return finish();
    }
    void finish();
    return { published: false };
  }

  if (response.published) {
    const labels =
      platforms?.map((p) => platformOf(p).label).join(', ') ?? 'your platforms';
    toast({
      title: 'Published successfully',
      description: `Sent to ${labels}.`,
    });
  } else {
    const failure = summarizePublishFailure(response.results ?? {});
    toast({
      title: failure.title,
      description: failure.description,
      variant: 'destructive',
    });
  }

  return response;
}
