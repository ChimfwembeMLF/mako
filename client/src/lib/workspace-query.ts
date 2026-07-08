/** Append workspaceId to URLSearchParams when set. */
export function withWorkspace(
  params: URLSearchParams | Record<string, string>,
  workspaceId?: string | null,
): URLSearchParams {
  const qs = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  if (workspaceId) qs.set('workspaceId', workspaceId);
  return qs;
}
