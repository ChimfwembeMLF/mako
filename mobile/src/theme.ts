// Theme derived from DESIGN.md tokens (web client parity)

export type ThemeColors = typeof lightColors;

export const lightColors = {
  primary: '#9fe870',
  'on-primary': '#0e0f0c',
  'primary-active': '#cdffad',
  'primary-neutral': '#c5edab',
  'primary-pale': '#e2f6d5',
  'primary-disabled': '#e2f6d5',
  ink: '#0e0f0c',
  'ink-deep': '#163300',
  body: '#454745',
  mute: '#868685',
  canvas: '#ffffff',
  'canvas-soft': '#e8ebe6',
  border: 'rgba(14, 15, 12, 0.12)',
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

/** Dark palette — mirrors web `.dark` CSS vars; primary lime unchanged */
export const darkColors: ThemeColors = {
  primary: '#9fe870',
  'on-primary': '#0e0f0c',
  'primary-active': '#cdffad',
  'primary-neutral': '#3a4234',
  'primary-pale': '#2a3324',
  'primary-disabled': '#2a3324',
  ink: '#e8ebe6',
  'ink-deep': '#c5edab',
  body: '#b8bab8',
  mute: '#9e9e9d',
  canvas: '#161714',
  'canvas-soft': '#0e0f0c',
  border: 'rgba(232, 235, 230, 0.12)',
  positive: '#3bc962',
  'positive-deep': '#5ee88a',
  warning: '#ffd11a',
  'warning-deep': '#ffc091',
  'warning-content': '#4a3b1c',
  negative: '#e04a50',
  'negative-deep': '#ff6b70',
  'negative-darkest': '#ff8a8f',
  'negative-bg': '#320707',
  'accent-orange': '#ffc091',
  'accent-cyan': '#38c8ff',
};

/** @deprecated Use useTheme().colors for dark-mode aware styling */
export const colors = lightColors;

export const fonts = {
  body: 'Inter_400Regular',
  bodySemi: 'Inter_600SemiBold',
  display: 'Manrope_800ExtraBold',
  displaySemi: 'Manrope_600SemiBold',
};

export const layout = {
  headerHeight: 56,
  tabBarHeight: 60,
  maxContentWidth: 1280,
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
