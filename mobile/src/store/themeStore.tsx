import React, { useCallback } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeConfig = {
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  radius?: number;
};

type ThemeState = {
  theme: ThemeConfig;
  isLoading: boolean;
  setTheme: (theme: ThemeConfig) => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
};

const defaultTheme: ThemeConfig = {
  primaryColor: '#000000', // Default fallback
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: defaultTheme,
      isLoading: true,
      _hasHydrated: false,
      setTheme: (theme) => set({ theme }),
      setHasHydrated: (state) => set({ _hasHydrated: state, isLoading: !state }),
    }),
    {
      name: 'mako_tenant_theme_config',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export const TenantThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};



export const useTenantTheme = () => {
  const theme = useThemeStore((state) => state.theme);
  const setThemeStore = useThemeStore((state) => state.setTheme);
  const isLoading = useThemeStore((state) => state.isLoading);

  const setTheme = useCallback(async (newTheme: ThemeConfig) => {
    setThemeStore(newTheme);
  }, [setThemeStore]);

  return { theme, setTheme, isLoading };
};
