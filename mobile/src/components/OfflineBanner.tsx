import React, { createContext, useCallback, useContext, useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

type OfflineContextValue = {
  reportError: (message: string | null) => void;
  message: string | null;
};

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const reportError = useCallback((next: string | null) => {
    if (!next) {
      setMessage(null);
      return;
    }
    const offline =
      next.toLowerCase().includes('offline') || next.toLowerCase().includes('timed out');
    setMessage(offline ? next : null);
  }, []);

  return (
    <OfflineContext.Provider value={{ reportError, message }}>
      {children}
      {message ? (
        <View style={styles.banner} pointerEvents="none">
          <Text style={styles.text}>{message}</Text>
        </View>
      ) : null}
    </OfflineContext.Provider>
  );
}

export function useOfflineBanner() {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    return { reportError: (_: string | null) => undefined, message: null };
  }
  return ctx;
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 48,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors['warning'],
    borderRadius: 12,
    padding: spacing.md,
    zIndex: 50,
  },
  text: {
    ...typography.bodySmStrong,
    color: colors['warning-content'],
    textAlign: 'center',
  },
});
