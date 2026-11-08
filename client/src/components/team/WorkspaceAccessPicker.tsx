import { Check } from 'lucide-react';
import { WorkspaceLogo } from '@/components/WorkspaceLogo';
import { cn } from '@/lib/utils';

export type WorkspaceOption = { id: string; name: string; logoUrl?: string | null };

type Props = {
  workspaces: WorkspaceOption[];
  /** null means every workspace. */
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  /** When the person choosing is limited too, "All workspaces" isn't theirs to give. */
  allowAll?: boolean;
  disabled?: boolean;
};

/** "All workspaces", or a hand-picked set. Picking every one is the same as "All". */
export function WorkspaceAccessPicker({ workspaces, value, onChange, allowAll = true, disabled }: Props) {
  const all = value === null;
  const toggle = (id: string) => {
    const current = value ?? [];
    const next = current.includes(id) ? current.filter((w) => w !== id) : [...current, id];
    if (allowAll && next.length === workspaces.length) onChange(null);
    else onChange(next);
  };

  const pill = (active: boolean) =>
    cn(
      'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
      active ? 'border-foreground bg-foreground text-background' : 'bg-background hover:bg-muted',
    );

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Workspace access">
      {allowAll && (
        <button type="button" className={pill(all)} aria-pressed={all} disabled={disabled} onClick={() => onChange(null)}>
          {all && <Check className="h-3 w-3" />}
          All workspaces
        </button>
      )}
      {workspaces.map((w) => {
        const on = !all && (value ?? []).includes(w.id);
        return (
          <button
            key={w.id}
            type="button"
            className={pill(on)}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => (all ? onChange([w.id]) : toggle(w.id))}
          >
            <WorkspaceLogo
              name={w.name}
              logoUrl={w.logoUrl}
              className="h-4 w-4 rounded text-[7px]"
              fallbackClassName={on ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground'}
            />
            {w.name}
          </button>
        );
      })}
    </div>
  );
}
