import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { systemSettingsApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { MAKO_THEME } from '@/lib/mako-brand';

export type ColorMode = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  primary?: string;
  secondary?: string;
  accent?: string;
  radius?: string;
  mode?: ColorMode;
}

const GLOBAL_THEME_CACHE_KEY = 'mako_global_theme';
const USER_COLOR_MODE_KEY = 'mako_color_mode';

type ThemeContextValue = {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  resolvedDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

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

export function readUserColorMode(): ColorMode | null {
  try {
    const v = localStorage.getItem(USER_COLOR_MODE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeUserColorMode(mode: ColorMode) {
  try {
    localStorage.setItem(USER_COLOR_MODE_KEY, mode);
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

export function resolveIsDark(mode: ColorMode | undefined): boolean {
  const m = mode ?? 'light';
  if (m === 'dark') return true;
  if (m === 'light') return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
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

  const dark = resolveIsDark(theme.mode);
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

function initialColorMode(): ColorMode {
  return readUserColorMode() ?? 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [colorMode, setColorModeState] = useState<ColorMode>(initialColorMode);
  const [brandTheme, setBrandTheme] = useState<ThemeConfig>(() =>
    mergeTheme(readCachedGlobalTheme() ?? undefined),
  );

  const setColorMode = useCallback((mode: ColorMode) => {
    writeUserColorMode(mode);
    setColorModeState(mode);
  }, []);

  const resolvedDark = useMemo(
    () => resolveIsDark(colorMode),
    // re-eval when mode changes; system updates via media listener below
    [colorMode],
  );

  const applyMerged = useCallback(
    (brand: ThemeConfig, mode: ColorMode) => {
      applyTheme({ ...brand, mode });
    },
    [],
  );

  useEffect(() => {
    applyMerged(brandTheme, colorMode);
  }, [brandTheme, colorMode, applyMerged]);

  useEffect(() => {
    if (colorMode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyMerged(brandTheme, 'system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [colorMode, brandTheme, applyMerged]);

  useEffect(() => {
    const cached = readCachedGlobalTheme();
    if (cached) {
      setBrandTheme(mergeTheme(cached, user ? tenant?.themeConfig : null));
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
        setBrandTheme(mergeTheme(global, tenantTheme));
        // If user never chose a mode, adopt server default once
        if (readUserColorMode() == null && global.mode) {
          setColorModeState(global.mode);
        }
      } catch {
        if (!cancelled) {
          setBrandTheme(mergeTheme(readCachedGlobalTheme() ?? undefined));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant, user]);

  const value = useMemo(
    () => ({ colorMode, setColorMode, resolvedDark }),
    [colorMode, setColorMode, resolvedDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

/** Safe for optional use outside provider (e.g. tests). */
export function useThemeOptional() {
  return useContext(ThemeContext);
}
