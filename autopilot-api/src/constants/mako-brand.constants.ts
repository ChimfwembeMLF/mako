/** Brand palette from mako-logo.png — keep in sync with resources/client/src/lib/mako-brand.ts */
export const MAKO_BRAND = {
  deepPurple: { hex: '#220044', hsl: '270 100% 13%' },
  purple: { hex: '#5D0096', hsl: '278 100% 29%' },
  orange: { hex: '#E5A024', hsl: '40 79% 52%' },
  orangeDark: { hex: '#C47F17', hsl: '36 79% 43%' },
  teal: { hex: '#00A372', hsl: '162 100% 32%' },
  black: { hex: '#000000', hsl: '0 0% 0%' },
} as const;

export const MAKO_THEME = {
  primary: MAKO_BRAND.orange.hsl,
  secondary: MAKO_BRAND.purple.hsl,
  accent: MAKO_BRAND.teal.hsl,
  radius: '0.75rem',
} as const;
