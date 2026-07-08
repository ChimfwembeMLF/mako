export class ApiError extends Error {
  readonly status?: number;
  readonly isNetworkError: boolean;
  readonly isAuthError: boolean;

  constructor(message: string, options?: { status?: number; isNetworkError?: boolean; isAuthError?: boolean }) {
    super(message);
    this.name = 'ApiError';
    this.status = options?.status;
    this.isNetworkError = options?.isNetworkError ?? false;
    this.isAuthError = options?.isAuthError ?? false;
  }
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof ApiError) return err.isNetworkError;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('econnrefused')
  );
}

export function isAuthError(err: unknown): boolean {
  if (err instanceof ApiError) return err.isAuthError;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.includes('Invalid or missing JWT');
}

type StatusListener = (available: boolean) => void;
const listeners = new Set<StatusListener>();

export function onApiStatusChange(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportApiSuccess(): void {
  listeners.forEach((l) => l(true));
}

export function reportApiFailure(err: unknown): void {
  if (isNetworkError(err)) {
    listeners.forEach((l) => l(false));
  }
}
