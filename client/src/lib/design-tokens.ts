/**
 * Design tokens from DESIGN.md (Wise-inspired system).
 * HSL values omit the hsl() wrapper — matches CSS custom properties.
 */
export const DESIGN_COLORS = {
  primary: '96 72% 67%',
  primaryActive: '97 100% 84%',
  primaryDisabled: '96 65% 90%',
  primaryPale: '96 65% 90%',
  primaryNeutral: '96 65% 80%',
  primaryErrorText: '358 63% 51%',
  positive: '134 58% 43%',
  positiveDeep: '149 88% 16%',
  warning: '48 100% 55%',
  warningDeep: '34 100% 36%',
  luxe: '94 100% 10%',
  plus: '26 100% 78%',
  ink: '80 11% 5%',
  body: '120 1% 27%',
  muted: '60 0% 52%',
  mutedSoft: '60 0% 52%',
  hairline: '96 8% 82%',
  hairlineSoft: '96 8% 88%',
  borderStrong: '80 11% 5%',
  canvas: '0 0% 100%',
  canvasSoft: '96 11% 91%',
  surfaceSoft: '96 11% 91%',
  surfaceStrong: '96 65% 90%',
  onPrimary: '80 11% 5%',
  legalLink: '197 100% 40%',
} as const;

export const DESIGN_RADIUS = {
  none: '0px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  full: '9999px',
} as const;

export const DESIGN_SHADOW = {
  elevated: 'none',
} as const;

export const DESIGN_FONT =
  "Inter, system-ui, -apple-system, sans-serif";

export const DESIGN_DISPLAY_FONT =
  "Manrope, Inter, system-ui, sans-serif";

/** Default theme tokens for applyTheme / theme palettes. */
export const DESIGN_THEME = {
  primary: DESIGN_COLORS.primary,
  secondary: DESIGN_COLORS.ink,
  accent: DESIGN_COLORS.surfaceStrong,
  radius: DESIGN_RADIUS.xl,
} as const;
