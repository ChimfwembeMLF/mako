// Theme derived from DESIGN.md tokens

export const colors = {
  primary: '#9fe870',
  'on-primary': '#0e0f0c',
  'primary-active': '#cdffad',
  'primary-neutral': '#c5edab',
  'primary-pale': '#e2f6d5',
  ink: '#0e0f0c',
  'ink-deep': '#163300',
  body: '#454745',
  mute: '#868685',
  canvas: '#ffffff',
  'canvas-soft': '#e8ebe6',
  positive: '#2ead4b',
  'positive-deep': '#054d28',
  warning: '#ffd11a',
  'warning-deep': '#b86700',
  'warning-content': '#4a3b1c',
  negative: '#d03238',
  'negative-deep': '#a72027',
  'negative-darkest': '#a7000d',
  'negative-bg': '#320707',
  'accent-orange': '#ffc091',
  'accent-cyan': '#38c8ff',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
};

export const rounded = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
  full: 9999,
};

export const typography = {
  displayMega: { fontSize: 126, fontWeight: '900' as const, lineHeight: 107 },
  displayXxl: { fontSize: 96, fontWeight: '900' as const, lineHeight: 81.6 },
  displayXl: { fontSize: 64, fontWeight: '900' as const, lineHeight: 54.4 },
  displayLg: { fontSize: 47, fontWeight: '400' as const, lineHeight: 70.5, letterSpacing: -0.108 },
  displayMd: { fontSize: 40, fontWeight: '900' as const, lineHeight: 34 },
  displaySm: { fontSize: 32, fontWeight: '600' as const, lineHeight: 38.4, letterSpacing: -0.96 },
  displayXs: { fontSize: 24, fontWeight: '600' as const, lineHeight: 31.2, letterSpacing: -0.48 },
  bodyLg: { fontSize: 20, fontWeight: '400' as const, lineHeight: 30 },
  bodyMd: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMdStrong: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  bodySm: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmStrong: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  buttonMd: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
};
