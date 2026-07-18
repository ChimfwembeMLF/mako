/**
 * Design tokens from DESIGN.md (Airbnb-inspired system).
 * HSL values omit the hsl() wrapper — matches CSS custom properties.
 */
export const DESIGN_COLORS = {
  primary: '349 100% 61%',
  primaryActive: '345 91% 46%',
  primaryDisabled: '350 100% 91%',
  primaryErrorText: '12 80% 42%',
  luxe: '277 91% 25%',
  plus: '330 72% 33%',
  ink: '0 0% 13%',
  body: '0 0% 25%',
  muted: '0 0% 41%',
  mutedSoft: '0 0% 57%',
  hairline: '0 0% 87%',
  hairlineSoft: '0 0% 92%',
  borderStrong: '0 0% 76%',
  canvas: '0 0% 100%',
  surfaceSoft: '0 0% 97%',
  surfaceStrong: '0 0% 95%',
  onPrimary: '0 0% 100%',
  legalLink: '217 100% 63%',
} as const;

export const DESIGN_RADIUS = {
  none: '0px',
  xs: '4px',
  sm: '8px',
  md: '14px',
  lg: '20px',
  xl: '32px',
  full: '9999px',
} as const;

export const DESIGN_SHADOW = {
  elevated:
    'rgba(0, 0, 0, 0.02) 0 0 0 1px, rgba(0, 0, 0, 0.04) 0 2px 6px 0, rgba(0, 0, 0, 0.1) 0 4px 8px 0',
} as const;

export const DESIGN_FONT =
  "Inter, Circular, -apple-system, system-ui, Roboto, 'Helvetica Neue', sans-serif";

/** Default theme tokens for applyTheme / theme palettes. */
export const DESIGN_THEME = {
  primary: DESIGN_COLORS.primary,
  secondary: DESIGN_COLORS.ink,
  accent: DESIGN_COLORS.surfaceStrong,
  radius: DESIGN_RADIUS.sm,
} as const;
