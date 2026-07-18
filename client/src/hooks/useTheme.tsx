import { useEffect } from 'react';
import { systemSettingsApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { MAKO_THEME } from '@/lib/mako-brand';

export interface ThemeConfig {
  primary?: string;
  secondary?: string;
  accent?: string;
  radius?: string;
  mode?: 'light' | 'dark' | 'system';
}

const GLOBAL_THEME_CACHE_KEY = 'mako_global_theme';

export function readCachedGlobalTheme(): ThemeConfig | null {
  try {
    const raw = localStorage.getItem(GLOBAL_THEME_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ThemeConfig) : null;
  } catch {
    return null;
  }
}

export function cacheGlobalTheme(theme: ThemeConfig) {
  try {
    localStorage.setItem(GLOBAL_THEME_CACHE_KEY, JSON.stringify(theme));
  } catch {
    /* ignore */
  }
}

export function mergeTheme(
  global: ThemeConfig = {},
  tenantTheme?: ThemeConfig | null,
): ThemeConfig {
  return {
    ...MAKO_THEME,
    mode: 'light',
    ...global,
    ...(tenantTheme ?? {}),
  };
}

export function applyTheme(theme: ThemeConfig) {
  const root = document.documentElement;
  if (theme.primary) {
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--ring', theme.primary);
    root.style.setProperty('--sidebar-primary', theme.primary);
    root.style.setProperty('--sidebar-ring', theme.primary);
  }
  if (theme.secondary) root.style.setProperty('--secondary', theme.secondary);
  if (theme.accent) root.style.setProperty('--accent', theme.accent);
  if (theme.radius) root.style.setProperty('--radius', theme.radius);

  const dark =
    theme.mode === 'dark' ||
    (theme.mode === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.classList.toggle('dark', dark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenant();
  const { user } = useAuth();

  useEffect(() => {
    const cached = readCachedGlobalTheme();
    if (cached) {
      applyTheme(mergeTheme(cached, user ? tenant?.themeConfig : null));
    }

    let cancelled = false;
    (async () => {
      try {
        const global = (await systemSettingsApi.getTheme()) as ThemeConfig;
        if (cancelled) return;
        cacheGlobalTheme(global);
        const tenantTheme = user
          ? ((tenant as { themeConfig?: ThemeConfig } | null)?.themeConfig ?? null)
          : null;
        applyTheme(mergeTheme(global, tenantTheme));
      } catch {
        if (!cancelled) {
          applyTheme(mergeTheme(readCachedGlobalTheme() ?? undefined));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant, user]);

  return <>{children}</>;
}
