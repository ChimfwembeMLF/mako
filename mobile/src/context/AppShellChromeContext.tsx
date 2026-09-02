import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppShellHeader } from '../components/AppShellHeader';
import { useTheme } from './ThemeContext';

type AppShellChromeContextValue = {
  setChromeHidden: (hidden: boolean) => void;
};

const AppShellChromeContext = createContext<AppShellChromeContextValue | null>(null);

export function useAppShellChrome() {
  return useContext(AppShellChromeContext);
}

type AppShellGateProps = {
  children: React.ReactNode;
  /** Always hide workspace header (auth screens, etc.) */
  hideHeader?: boolean;
};

/** Wraps tab/stack layouts so loading screens can hide the workspace header. */
export function AppShellGate({ children, hideHeader }: AppShellGateProps) {
  const { colors } = useTheme();
  const [chromeHidden, setChromeHidden] = useState(false);

  const setChromeHiddenStable = useCallback((hidden: boolean) => {
    setChromeHidden(hidden);
  }, []);

  const value = useMemo(
    () => ({ setChromeHidden: setChromeHiddenStable }),
    [setChromeHiddenStable],
  );

  const showHeader = !hideHeader && !chromeHidden;

  return (
    <AppShellChromeContext.Provider value={value}>
      <View style={{ flex: 1, backgroundColor: colors['canvas-soft'] }}>
        {showHeader ? <AppShellHeader /> : null}
        {children}
      </View>
    </AppShellChromeContext.Provider>
  );
}
