import type { WorkspaceOption } from '@/components/team/WorkspaceAccessPicker';

/** "All workspaces", "Marketing", or "Marketing, Sales + 2 more" for a member row. */
export function describeWorkspaceAccess(ids: string[] | null | undefined, workspaces: WorkspaceOption[]): string {
  if (!ids?.length) return 'All workspaces, including new ones';
  const names = ids.map((id) => workspaces.find((w) => w.id === id)?.name).filter(Boolean) as string[];
  const hidden = ids.length - names.length;
  if (!names.length) return `${ids.length} workspace${ids.length === 1 ? '' : 's'}`;
  const shown = names.slice(0, 2).join(', ');
  const more = names.length - 2 + hidden;
  return more > 0 ? `${shown} + ${more} more` : shown;
}
