import { fetchWithAuth } from './api';

export type QueuedJobResponse = {
  queued?: boolean;
  jobId?: string | number;
  queue?: string;
};

type QueueJobStatus = {
  state?: string;
  returnvalue?: unknown;
  failedReason?: string;
  name?: string;
};

export async function waitForQueueJob(
  queue: string,
  jobId: string | number,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<unknown> {
  const intervalMs = opts?.intervalMs ?? 1500;
  const timeoutMs = opts?.timeoutMs ?? 180000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = (await fetchWithAuth(
      `/api/v1/queues/${encodeURIComponent(queue)}/jobs/${encodeURIComponent(String(jobId))}`,
    )) as QueueJobStatus | null;
    if (!status) throw new Error('Background job not found');
    if (status.state === 'completed') {
      if (status.returnvalue == null && status.name === 'ai-task') {
        throw new Error(
          'Background job completed without a result. Restart the API server and try again.',
        );
      }
      return status.returnvalue;
    }
    if (status.state === 'failed') {
      throw new Error(status.failedReason || 'Background job failed');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Background job timed out');
}

export async function resolveQueued<T>(response: T & QueuedJobResponse): Promise<unknown> {
  if (response?.queued && response.jobId != null && response.queue) {
    return waitForQueueJob(response.queue, response.jobId);
  }
  return response;
}
