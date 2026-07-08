export const DEFAULT_GRADIENT_FROM = '#6366f1';
export const DEFAULT_GRADIENT_TO = '#a855f7';
export const DEFAULT_GRADIENT_ANGLE = 135;

export function resolveWidgetTheme(theme: Record<string, unknown> = {}) {
  const from =
    (typeof theme.gradientFrom === 'string' && theme.gradientFrom.trim()) ||
    (typeof theme.primaryColor === 'string' && theme.primaryColor.trim()) ||
    DEFAULT_GRADIENT_FROM;
  const to =
    (typeof theme.gradientTo === 'string' && theme.gradientTo.trim()) ||
    DEFAULT_GRADIENT_TO;
  const angle =
    typeof theme.gradientAngle === 'number' && Number.isFinite(theme.gradientAngle)
      ? theme.gradientAngle
      : DEFAULT_GRADIENT_ANGLE;
  const gradient = `linear-gradient(${angle}deg, ${from}, ${to})`;

  return { primary: from, gradient, from, to, angle };
}
