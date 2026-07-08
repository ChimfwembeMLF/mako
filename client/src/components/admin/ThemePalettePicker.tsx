import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThemeConfig } from '@/hooks/useTheme';
import {
  THEME_PALETTES,
  matchPaletteId,
  paletteSwatchHsl,
  type ThemePalette,
} from '@/lib/themePalettes';

type ThemePalettePickerProps = {
  value: ThemeConfig;
  onChange: (theme: ThemeConfig) => void;
  onPreview?: (theme: ThemeConfig) => void;
  className?: string;
};

function PaletteCard({
  palette,
  selected,
  onSelect,
}: {
  palette: ThemePalette;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = [palette.theme.primary, palette.theme.secondary, palette.theme.accent];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-all hover:shadow-md',
        selected
          ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
          : 'border-border/60 bg-card hover:border-primary/40',
      )}
    >
      {selected && (
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
      <div className="flex gap-1.5">
        {colors.map((hsl, i) => (
          <div
            key={i}
            className="h-8 flex-1 rounded-md border border-black/10 shadow-sm"
            style={{ backgroundColor: paletteSwatchHsl(hsl) }}
          />
        ))}
      </div>
      <div>
        <p className="text-sm font-medium pr-6">{palette.name}</p>
        <p className="text-[11px] text-muted-foreground line-clamp-2">{palette.description}</p>
      </div>
    </button>
  );
}

export function ThemePalettePicker({ value, onChange, onPreview, className }: ThemePalettePickerProps) {
  const selectedId = matchPaletteId(value);

  const applyPalette = (palette: ThemePalette) => {
    const next: ThemeConfig = {
      ...value,
      ...palette.theme,
    };
    onChange(next);
    onPreview?.(next);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-xs text-muted-foreground">
        Pick a palette — primary, secondary, and accent update together. Save to apply platform-wide or per workspace.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEME_PALETTES.map((palette) => (
          <PaletteCard
            key={palette.id}
            palette={palette}
            selected={selectedId === palette.id}
            onSelect={() => applyPalette(palette)}
          />
        ))}
      </div>
    </div>
  );
}
