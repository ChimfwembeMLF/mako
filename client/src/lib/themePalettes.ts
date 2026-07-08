import type { ThemeConfig } from '@/hooks/useTheme';
import { MAKO_THEME } from '@/lib/mako-brand';

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
    name: 'Mako Market ',
    description: 'Logo palette — golden orange, vibrant purple, teal accent',
    theme: {
      primary: MAKO_THEME.primary,
      secondary: MAKO_THEME.secondary,
      accent: MAKO_THEME.accent,
      radius: MAKO_THEME.radius,
    },
  },
  {
    id: 'autopilot',
    name: 'Mako  Orange',
    description: 'Legacy alias — same as Mako Market ',
    theme: {
      primary: MAKO_THEME.primary,
      secondary: MAKO_THEME.secondary,
      accent: MAKO_THEME.accent,
      radius: MAKO_THEME.radius,
    },
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    description: 'Calm, trustworthy SaaS blue',
    theme: {
      primary: '210 85% 48%',
      secondary: '195 70% 42%',
      accent: '170 55% 45%',
      radius: '0.75rem',
    },
  },
  {
    id: 'forest',
    name: 'Forest Green',
    description: 'Natural, agri & sustainability',
    theme: {
      primary: '142 55% 38%',
      secondary: '158 45% 32%',
      accent: '85 45% 42%',
      radius: '0.75rem',
    },
  },
  {
    id: 'royal',
    name: 'Royal Purple',
    description: 'Premium creative & marketing',
    theme: {
      primary: '262 72% 55%',
      secondary: '290 55% 48%',
      accent: '320 65% 52%',
      radius: '0.75rem',
    },
  },
  {
    id: 'slate',
    name: 'Slate Pro',
    description: 'Neutral enterprise, minimal color',
    theme: {
      primary: '220 15% 35%',
      secondary: '215 20% 45%',
      accent: '200 25% 50%',
      radius: '0.5rem',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Coral',
    description: 'Bold, energetic consumer brand',
    theme: {
      primary: '8 85% 58%',
      secondary: '25 90% 55%',
      accent: '340 75% 55%',
      radius: '0.875rem',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Indigo',
    description: 'Deep tech, dark-mode friendly accents',
    theme: {
      primary: '235 65% 55%',
      secondary: '250 45% 45%',
      accent: '190 70% 48%',
      radius: '0.75rem',
    },
  },
  {
    id: 'gold',
    name: 'Harvest Gold',
    description: 'Warm gold — retail & agribusiness',
    theme: {
      primary: '38 92% 50%',
      secondary: '28 75% 45%',
      accent: '142 40% 40%',
      radius: '0.75rem',
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
