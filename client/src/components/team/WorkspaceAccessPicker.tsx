import { Check, Globe2, Layers } from 'lucide-react';
import { WorkspaceLogo } from '@/components/WorkspaceLogo';
import { cn } from '@/lib/utils';

export type WorkspaceOption = { id: string; name: string; logoUrl?: string | null };

type Props = {
  workspaces: WorkspaceOption[];
  /** null means every workspace, including ones created later. */
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  /** When the person choosing is limited too, "All workspaces" isn't theirs to give. */
  allowAll?: boolean;
  /** What "Only these" starts with when switched on, usually the workspace you're in. */
  defaultSelection?: string[];
  disabled?: boolean;
};

/**
 * An explicit choice between every workspace (now and later) and a hand-picked set.
 * Picking every workspace by hand stays a fixed list: new workspaces are not added to it.
 */
export function WorkspaceAccessPicker({ workspaces, value, onChange, allowAll = true, defaultSelection, disabled }: Props) {
  const all = value === null;
  const selected = value ?? [];
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((w) => w !== id) : [...selected, id]);

  const option = (active: boolean) =>
    cn(
      'flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors disabled:opacity-50',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
    );
  const radio = (active: boolean) => (
    <span
      className={cn(
        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
        active ? 'border-primary bg-primary' : 'border-muted-foreground/50',
      )}
      aria-hidden
    >
      {active && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
    </span>
  );

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Workspace access">
      {allowAll && (
        <button type="button" role="radio" aria-checked={all} className={option(all)} disabled={disabled} onClick={() => onChange(null)}>
          {radio(all)}
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Globe2 className="h-3.5 w-3.5 text-muted-foreground" /> All workspaces
            </span>
            <span className="block text-xs text-muted-foreground">Including any workspace added later.</span>
          </span>
        </button>
      )}

      <div className={option(!all)}>
        <button
          type="button"
          role="radio"
          aria-checked={!all}
          aria-label="Only these workspaces"
          disabled={disabled}
          onClick={() => {
            if (!all) return;
            const start = (defaultSelection ?? []).filter((id) => workspaces.some((w) => w.id === id));
            onChange(start.length ? start : workspaces.slice(0, 1).map((w) => w.id));
          }}
          className="flex shrink-0 items-start focus-visible:outline-none"
        >
          {radio(!all)}
        </button>
        <span className="min-w-0 flex-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!all) return;
              const start = (defaultSelection ?? []).filter((id) => workspaces.some((w) => w.id === id));
              onChange(start.length ? start : workspaces.slice(0, 1).map((w) => w.id));
            }}
            className="flex items-center gap-1.5 text-left text-sm font-medium focus-visible:outline-none"
            tabIndex={-1}
          >
            <Layers className="h-3.5 w-3.5 text-muted-foreground" /> Only these workspaces
          </button>
          <span className="block text-xs text-muted-foreground">
            {all ? 'Pick which ones they can see and work in.' : selected.length ? `${selected.length} of ${workspaces.length} selected.` : 'Pick at least one.'}
          </span>
          {!all && (
            <span className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Workspaces">
              {workspaces.map((w) => {
                const on = selected.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    aria-pressed={on}
                    disabled={disabled}
                    onClick={() => toggle(w.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      on ? 'border-foreground bg-foreground text-background' : 'bg-background hover:bg-muted',
                    )}
                  >
                    {on ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <WorkspaceLogo
                        name={w.name}
                        logoUrl={w.logoUrl}
                        className="h-4 w-4 rounded text-[7px]"
                        fallbackClassName="bg-muted text-muted-foreground"
                      />
                    )}
                    {w.name}
                  </button>
                );
              })}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
