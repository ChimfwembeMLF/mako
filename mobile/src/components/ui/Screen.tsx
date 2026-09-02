import React, { useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppShellChrome } from '../../context/AppShellChromeContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme';
import { AppLogoLoader } from './AppLogoLoader';
import { EmptyState } from './EmptyState';

type Props = ScrollViewProps & {
  children?: React.ReactNode;
  loading?: boolean;
  /** @deprecated Logo loader is used for all loading states */
  skeleton?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  loadingMessage?: string;
  padded?: boolean;
};

export function Screen({
  children,
  loading,
  skeleton: _skeleton,
  empty,
  emptyMessage = 'Nothing here yet.',
  emptyTitle,
  emptyActionLabel,
  onEmptyAction,
  loadingMessage,
  padded = true,
  contentContainerStyle,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const chrome = useAppShellChrome();

  useEffect(() => {
    if (!loading || !chrome) return;
    chrome.setChromeHidden(true);
    return () => chrome.setChromeHidden(false);
  }, [loading, chrome]);

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors['canvas-soft'] }]}
        edges={['top', 'bottom']}
      >
        <AppLogoLoader message={loadingMessage} />
      </SafeAreaView>
    );
  }

  if (empty) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors['canvas-soft'] }]} edges={['bottom']}>
        <View style={[styles.center, padded && styles.pad]}>
          <EmptyState
            title={emptyTitle || emptyMessage}
            description={emptyTitle ? emptyMessage : undefined}
            actionLabel={emptyActionLabel}
            onAction={onEmptyAction}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['canvas-soft'] }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[padded && styles.pad, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        {...rest}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  pad: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
