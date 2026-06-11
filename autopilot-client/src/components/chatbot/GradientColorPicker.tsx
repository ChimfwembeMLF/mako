import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WIDGET_GRADIENT_ANGLE,
  DEFAULT_WIDGET_GRADIENT_FROM,
  DEFAULT_WIDGET_GRADIENT_TO,
  GRADIENT_PRESETS,
  resolveWidgetColors,
  type WidgetThemeColors,
} from "@/lib/widget-theme";

const ANGLE_OPTIONS = [0, 45, 90, 135, 180, 225, 270] as const;

type GradientColorPickerProps = {
  value: WidgetThemeColors;
  onChange: (patch: WidgetThemeColors) => void;
};

function ColorStop({
  label,
  color,
  onChange,
}: {
  label: string;
  color: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 rounded-lg border bg-background p-2 shadow-sm">
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
          aria-label={`${label} color`}
        />
        <input
          type="text"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase outline-none"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export function GradientColorPicker({ value, onChange }: GradientColorPickerProps) {
  const from = value.gradientFrom || value.primaryColor || DEFAULT_WIDGET_GRADIENT_FROM;
  const to = value.gradientTo || DEFAULT_WIDGET_GRADIENT_TO;
  const angle = value.gradientAngle ?? DEFAULT_WIDGET_GRADIENT_ANGLE;
  const { gradient } = resolveWidgetColors({ ...value, gradientFrom: from, gradientTo: to, gradientAngle: angle });

  const apply = (patch: WidgetThemeColors) => {
    const nextFrom = patch.gradientFrom ?? from;
    onChange({
      ...patch,
      gradientFrom: nextFrom,
      primaryColor: nextFrom,
    });
  };

  return (
    <div className="space-y-4">
      <div
        className="h-16 w-full rounded-xl shadow-inner ring-1 ring-border/60"
        style={{ background: gradient }}
        aria-hidden
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ColorStop label="Gradient start" color={from} onChange={(c) => apply({ gradientFrom: c })} />
        <ColorStop label="Gradient end" color={to} onChange={(c) => apply({ gradientTo: c })} />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Direction</Label>
        <div className="flex flex-wrap gap-1.5">
          {ANGLE_OPTIONS.map((deg) => (
            <button
              key={deg}
              type="button"
              onClick={() => apply({ gradientAngle: deg })}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                angle === deg
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40",
              )}
            >
              {deg}°
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Presets</Label>
        <div className="flex flex-wrap gap-2">
          {GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              title={preset.label}
              onClick={() =>
                apply({
                  gradientFrom: preset.from,
                  gradientTo: preset.to,
                  gradientAngle: preset.angle ?? DEFAULT_WIDGET_GRADIENT_ANGLE,
                })
              }
              className="h-8 w-14 rounded-lg ring-1 ring-border/60 transition hover:ring-primary/50 hover:scale-105"
              style={{
                background: `linear-gradient(${preset.angle ?? DEFAULT_WIDGET_GRADIENT_ANGLE}deg, ${preset.from}, ${preset.to})`,
              }}
              aria-label={`${preset.label} preset`}
            />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="px-3 py-2 text-xs font-medium text-white" style={{ background: gradient }}>
          Widget preview
        </div>
        <div className="flex items-center justify-between gap-3 p-3">
          <div className="max-w-[70%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-xs text-foreground">
            Hi! How can I help?
          </div>
          <div
            className="rounded-2xl rounded-br-md px-3 py-2 text-xs text-white"
            style={{ background: gradient }}
          >
            Hello
          </div>
        </div>
        <div className="flex justify-end px-3 pb-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-white shadow-lg"
            style={{ background: gradient }}
          >
            💬
          </div>
        </div>
      </div>
    </div>
  );
}
