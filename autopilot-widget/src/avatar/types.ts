export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type AvatarMode = 'image' | '3d' | 'ar';

export type WidgetAvatarTheme = {
  avatarMode?: AvatarMode;
  avatarModelUrl?: string;
  arEnabled?: boolean;
  arMarkerUrl?: string;
  avatarUrl?: string;
  primaryColor?: string;
  position?: string;
};

export type AvatarConfig = {
  mode: AvatarMode;
  modelUrl?: string;
  avatarUrl?: string;
  arEnabled: boolean;
  arMarkerUrl?: string;
  primaryColor: string;
  widgetBase: string;
};

export function parseAvatarTheme(
  theme: Record<string, unknown>,
  widgetBase: string,
): AvatarConfig {
  const mode = (theme.avatarMode as AvatarMode) || 'image';
  return {
    mode: mode === 'ar' ? 'ar' : mode === '3d' ? '3d' : 'image',
    modelUrl: typeof theme.avatarModelUrl === 'string' ? theme.avatarModelUrl.trim() : undefined,
    avatarUrl: typeof theme.avatarUrl === 'string' ? theme.avatarUrl.trim() : undefined,
    arEnabled: theme.arEnabled === true || mode === 'ar',
    arMarkerUrl: typeof theme.arMarkerUrl === 'string' ? theme.arMarkerUrl.trim() : undefined,
    primaryColor: typeof theme.primaryColor === 'string' ? theme.primaryColor : '#6366f1',
    widgetBase,
  };
}
