import axios from 'axios';

type LinkedInApiError = {
  code?: string;
  message?: string;
  serviceErrorCode?: number;
  status?: number;
};

type GraphApiErrorBody = {
  error?: { message?: string; code?: number; error_subcode?: number };
};

export function isTokenAuthError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  if (status === 401 || status === 403) return true;
  const data = err.response?.data as LinkedInApiError & GraphApiErrorBody;
  if (data?.error?.code === 190) return true;
  const code = data?.code;
  return (
    code === 'REVOKED_ACCESS_TOKEN' ||
    code === 'INVALID_ACCESS_TOKEN' ||
    code === 'EXPIRED_ACCESS_TOKEN'
  );
}

/** One-line summary for logs — never pass raw AxiosError to the logger. */
export function summarizeAxiosError(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : String(err);
  }
  const status = err.response?.status;
  const data = err.response?.data as LinkedInApiError & GraphApiErrorBody;
  if (data?.error?.message) {
    return `${status ?? '?'} ${data.error.message} (code ${
      data.error.code ?? '?'
    })`;
  }
  if (data?.message) {
    return `${status ?? '?'} ${data.message}${
      data.code ? ` (${data.code})` : ''
    }`;
  }
  return `${status ?? '?'} ${err.message}`;
}

export function formatPublishError(err: unknown, platform: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as LinkedInApiError & GraphApiErrorBody;
    if (data?.error) return formatGraphApiError(data, platform);
    if (data?.code === 'REVOKED_ACCESS_TOKEN') {
      return 'LinkedIn access was revoked — reconnect LinkedIn in Publisher Connect.';
    }
    if (
      data?.code === 'INVALID_ACCESS_TOKEN' ||
      data?.code === 'EXPIRED_ACCESS_TOKEN'
    ) {
      return `LinkedIn session expired — reconnect LinkedIn in Publisher Connect. (${
        data.message ?? data.code
      })`;
    }
    if (data?.message) {
      return `${platform}: ${data.message}`;
    }
    const msg = typeof data === 'object' ? JSON.stringify(data) : String(data);
    return `${platform} API error: ${msg || err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

export function formatGraphApiError(
  data: { error?: { message?: string; code?: number; error_subcode?: number } },
  platform: string,
): string {
  const msg = data?.error?.message ?? JSON.stringify(data);
  const code = data?.error?.code;
  const subcode = data?.error?.error_subcode;

  if (code === 190) {
    return `${platform} token expired — reconnect in Publisher Connect. (${msg})`;
  }

  if (
    code === 368 ||
    subcode === 1404078 ||
    /confirm your identity|page publishing authorization|restricted from acting as your page/i.test(
      msg,
    )
  ) {
    return (
      `${platform}: Meta requires identity confirmation before you can publish as this Page. ` +
      'On your phone: open the Facebook app → finish any security prompts, then go to ' +
      'Settings → Accounts Center → Personal details → Identity confirmation. ' +
      'If you were just invited as a Page admin, accept the invite first, complete verification, ' +
      'then disconnect and reconnect Facebook in Publisher Connect and select this Page again.'
    );
  }

  return `${platform}: ${msg}`;
}
