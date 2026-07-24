/**
 * Brand palette — Wise-inspired primary from DESIGN.md.
 * Legacy purple/orange retained for logo/illustration accents only.
 */
export const MAKO_BRAND = {
  primary: { hex: '#9fe870', hsl: '96 72% 67%' },
  primaryActive: { hex: '#cdffad', hsl: '97 100% 84%' },
  ink: { hex: '#0e0f0c', hsl: '80 11% 5%' },
  canvasSoft: { hex: '#e8ebe6', hsl: '96 11% 91%' },
  positive: { hex: '#2ead4b', hsl: '134 58% 43%' },
  deepPurple: { hex: '#220044', hsl: '270 100% 13%' },
  purple: { hex: '#5D0096', hsl: '278 100% 29%' },
  orange: { hex: '#E5A024', hsl: '40 79% 52%' },
  orangeDark: { hex: '#C47F17', hsl: '36 79% 43%' },
  teal: { hex: '#00A372', hsl: '162 100% 32%' },
  black: { hex: '#000000', hsl: '0 0% 0%' },
} as const;

/** Default app theme tokens (HSL without hsl() wrapper). */
export const MAKO_THEME = {
  primary: MAKO_BRAND.primary.hsl,
  secondary: MAKO_BRAND.ink.hsl,
  accent: '96 65% 90%',
  radius: '24px',
} as const;

export const MAKO_WIDGET_GRADIENT = {
  from: MAKO_BRAND.primary.hex,
  to: MAKO_BRAND.primaryActive.hex,
  angle: 135,
} as const;
