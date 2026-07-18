import type { ThemeConfig } from '@/hooks/useTheme';
import { MAKO_THEME } from '@/lib/mako-brand';
import { DESIGN_THEME } from '@/lib/design-tokens';

export type ThemePalette = {
  id: string;
  name: string;
  description: string;
  theme: Pick<ThemeConfig, 'primary' | 'secondary' | 'accent' | 'radius'>;
};

/** Curated HSL palettes (values without hsl() wrapper — matches CSS variables). */
export const THEME_PALETTES: ThemePalette[] = [
  {
    id: 'mako',
    name: 'Mako',
    description: 'Clean white canvas with Rausch accent — see DESIGN.md',
    theme: {
      primary: MAKO_THEME.primary,
      secondary: MAKO_THEME.secondary,
      accent: MAKO_THEME.accent,
      radius: MAKO_THEME.radius,
    },
  },
  {
    id: 'autopilot',
    name: 'Mako (legacy alias)',
    description: 'Same as default Mako theme',
    theme: {
      primary: MAKO_THEME.primary,
      secondary: MAKO_THEME.secondary,
      accent: MAKO_THEME.accent,
      radius: MAKO_THEME.radius,
    },
  },
  {
    id: 'rausch',
    name: 'Rausch',
    description: 'Airbnb-inspired marketplace palette',
    theme: DESIGN_THEME,
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    description: 'Calm, trustworthy SaaS blue',
    theme: {
      primary: '210 85% 48%',
      secondary: '0 0% 13%',
      accent: '0 0% 95%',
      radius: '8px',
    },
  },
  {
    id: 'forest',
    name: 'Forest Green',
    description: 'Natural, agri & sustainability',
    theme: {
      primary: '142 55% 38%',
      secondary: '0 0% 13%',
      accent: '0 0% 95%',
      radius: '8px',
    },
  },
  {
    id: 'royal',
    name: 'Royal Purple',
    description: 'Premium creative & marketing',
    theme: {
      primary: '262 72% 55%',
      secondary: '0 0% 13%',
      accent: '0 0% 95%',
      radius: '8px',
    },
  },
  {
    id: 'slate',
    name: 'Slate Pro',
    description: 'Neutral enterprise, minimal color',
    theme: {
      primary: '220 15% 35%',
      secondary: '0 0% 13%',
      accent: '0 0% 95%',
      radius: '8px',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Coral',
    description: 'Bold, energetic consumer brand',
    theme: {
      primary: '8 85% 58%',
      secondary: '0 0% 13%',
      accent: '0 0% 95%',
      radius: '8px',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Indigo',
    description: 'Deep tech accents',
    theme: {
      primary: '235 65% 55%',
      secondary: '0 0% 13%',
      accent: '0 0% 95%',
      radius: '8px',
    },
  },
  {
    id: 'gold',
    name: 'Harvest Gold',
    description: 'Warm gold — retail & agribusiness',
    theme: {
      primary: '38 92% 50%',
      secondary: '0 0% 13%',
      accent: '0 0% 95%',
      radius: '8px',
    },
  },
];

export function paletteSwatchHsl(hsl: string): string {
  return `hsl(${hsl})`;
}

export function matchPaletteId(theme: ThemeConfig): string | null {
  const p = theme.primary?.trim();
  const s = theme.secondary?.trim();
  const a = theme.accent?.trim();
  if (!p || !s || !a) return null;
  const hit = THEME_PALETTES.find(
    (pal) =>
      pal.theme.primary === p &&
      pal.theme.secondary === s &&
      pal.theme.accent === a,
  );
  return hit?.id ?? null;
}

export function paletteById(id: string): ThemePalette | undefined {
  return THEME_PALETTES.find((p) => p.id === id);
}
