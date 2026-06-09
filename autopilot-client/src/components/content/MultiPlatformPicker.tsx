import { PLATFORMS, platformOf, buildPlatformPayloads, PlatformPayload } from '@/lib/platforms';

interface MultiPlatformPickerProps {
  values: string[];
  onChange: (values: string[]) => void;
}

export function MultiPlatformPicker({ values, onChange }: MultiPlatformPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {PLATFORMS.map((p) => {
        const active = values.includes(p.value);
        const Icon = p.icon;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              if (active) onChange(values.filter((v) => v !== p.value));
              else onChange([...values, p.value]);
            }}
            className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg border-[1.5px] transition-all duration-150 outline-none
              ${active ? 'text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}
            style={{ borderColor: active ? p.color : undefined }}
          >
            <Icon size={16} style={{ color: active ? p.color : undefined }} />
            <span className={`text-[10px] font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
              {p.label.split(' ')[0]}
            </span>
            <span className="mt-1 flex items-center justify-center">
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${active ? 'border-primary' : 'border-muted-foreground/30'}`}
                style={{ background: active ? p.color + '22' : undefined, borderWidth: '2px' }}
              >
                {active && <span className="w-2 h-2 rounded-full bg-primary" />}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export type { PlatformPayload };
export { PLATFORMS, platformOf, buildPlatformPayloads };
