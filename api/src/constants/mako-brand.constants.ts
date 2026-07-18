/** Brand palette — keep in sync with resources/client/src/lib/mako-brand.ts */
export const MAKO_BRAND = {
  rausch: { hex: '#ff385c', hsl: '349 100% 61%' },
  rauschActive: { hex: '#e00b41', hsl: '345 91% 46%' },
  ink: { hex: '#222222', hsl: '0 0% 13%' },
  deepPurple: { hex: '#220044', hsl: '270 100% 13%' },
  purple: { hex: '#5D0096', hsl: '278 100% 29%' },
  orange: { hex: '#E5A024', hsl: '40 79% 52%' },
  orangeDark: { hex: '#C47F17', hsl: '36 79% 43%' },
  teal: { hex: '#00A372', hsl: '162 100% 32%' },
  black: { hex: '#000000', hsl: '0 0% 0%' },
} as const;

export const MAKO_THEME = {
  primary: MAKO_BRAND.rausch.hsl,
  secondary: MAKO_BRAND.ink.hsl,
  accent: '0 0% 95%',
  radius: '8px',
} as const;
