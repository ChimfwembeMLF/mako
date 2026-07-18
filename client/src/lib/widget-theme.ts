import { MAKO_BRAND, MAKO_WIDGET_GRADIENT } from "./mako-brand";

export const DEFAULT_WIDGET_GRADIENT_FROM = MAKO_WIDGET_GRADIENT.from;
export const DEFAULT_WIDGET_GRADIENT_TO = MAKO_WIDGET_GRADIENT.to;
export const DEFAULT_WIDGET_GRADIENT_ANGLE = MAKO_WIDGET_GRADIENT.angle;

export type WidgetThemeColors = {
  primaryColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
};

export function resolveWidgetColors(theme: WidgetThemeColors = {}) {
  const from =
    theme.gradientFrom?.trim() ||
    theme.primaryColor?.trim() ||
    DEFAULT_WIDGET_GRADIENT_FROM;
  const to = theme.gradientTo?.trim() || DEFAULT_WIDGET_GRADIENT_TO;
  const angle = theme.gradientAngle ?? DEFAULT_WIDGET_GRADIENT_ANGLE;
  const gradient = `linear-gradient(${angle}deg, ${from}, ${to})`;

  return { primary: from, gradient, angle, from, to };
}

export const GRADIENT_PRESETS: { label: string; from: string; to: string; angle?: number }[] = [
  { label: "Mako", from: MAKO_BRAND.rausch.hex, to: MAKO_BRAND.rauschActive.hex },
  { label: "Indigo", from: "#6366f1", to: "#a855f7" },
  { label: "Sunset", from: "#f97316", to: "#ec4899" },
  { label: "Ocean", from: "#0ea5e9", to: "#6366f1" },
  { label: "Forest", from: "#10b981", to: "#0d9488" },
  { label: "Midnight", from: "#1e293b", to: "#6366f1" },
  { label: "Rose", from: "#f43f5e", to: "#fb923c" },
];
