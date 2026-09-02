import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { darkColors, lightColors, type ThemeColors } from '../theme';

const THEME_KEY = 'mako_theme_mode';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

async function readStoredMode(): Promise<ThemeMode> {
  try {
    const raw =
      Platform.OS === 'web'
        ? localStorage.getItem(THEME_KEY)
        : await SecureStore.getItemAsync(THEME_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // ignore
  }
  return 'system';
}

async function writeStoredMode(mode: ThemeMode) {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(THEME_KEY, mode);
      return;
    }
    await SecureStore.setItemAsync(THEME_KEY, mode);
  } catch {
    // ignore
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void readStoredMode().then((stored) => {
      setModeState(stored);
      setReady(true);
    });
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void writeStoredMode(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark, setMode]);

  const value = useMemo(
    () => ({ mode, isDark, colors, setMode, toggleTheme }),
    [mode, isDark, colors, setMode, toggleTheme],
  );

  if (!ready) {
    return (
      <ThemeContext.Provider
        value={{
          mode: 'system',
          isDark: systemScheme === 'dark',
          colors: systemScheme === 'dark' ? darkColors : lightColors,
          setMode: () => {},
          toggleTheme: () => {},
        }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: 'light' as ThemeMode,
      isDark: false,
      colors: lightColors,
      setMode: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
