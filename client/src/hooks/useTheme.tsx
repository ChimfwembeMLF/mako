import { useEffect } from 'react';
import { systemSettingsApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';

export interface ThemeConfig {
  primary?: string;
  secondary?: string;
  accent?: string;
  radius?: string;
  mode?: 'light' | 'dark' | 'system';
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const global = await systemSettingsApi.getTheme();
        if (cancelled) return;
        const tenantTheme = (tenant as { themeConfig?: ThemeConfig } | null)?.themeConfig;
        applyTheme({ ...global, ...tenantTheme });
      } catch {
        /* keep CSS defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  return <>{children}</>;
}
