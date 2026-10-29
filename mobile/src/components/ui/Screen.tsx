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
import { EmptyState } from './EmptyState';
import { Skeleton, SkeletonList } from './Skeleton';

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
  scroll?: boolean;
};

export function Screen({
  children,
  loading,
  skeleton,
  empty,
  emptyMessage = 'Nothing here yet.',
  emptyTitle,
  emptyActionLabel,
  onEmptyAction,
  loadingMessage,
  padded = true,
  scroll = true,
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
    const skeletonView = scroll ? (
      <ScrollView
        contentContainerStyle={[padded && styles.pad, styles.skeletonContainer, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        {...rest}
      >
        <Skeleton height={20} width="38%" style={styles.skeletonRow} />
        <Skeleton height={14} width="92%" style={styles.skeletonRow} />
        <Skeleton height={14} width="76%" style={styles.skeletonRow} />
        <SkeletonList count={3} />
      </ScrollView>
    ) : (
      <View style={[styles.safe, padded && styles.pad, styles.skeletonContainer, contentContainerStyle]} {...rest}>
        <Skeleton height={20} width="38%" style={styles.skeletonRow} />
        <Skeleton height={14} width="92%" style={styles.skeletonRow} />
        <Skeleton height={14} width="76%" style={styles.skeletonRow} />
        <SkeletonList count={3} />
      </View>
    );

    if (skeleton) {
      return (
        <SafeAreaView
          style={[styles.safe, { backgroundColor: colors['canvas-soft'] }]}
          edges={['top', 'bottom']}
        >
          {skeletonView}
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors['canvas-soft'] }]}
        edges={['top', 'bottom']}
      >
        <View style={[styles.center, padded && styles.pad]}>
          <Skeleton height={18} width="48%" style={styles.skeletonRow} />
          <Skeleton height={12} width="84%" style={styles.skeletonRow} />
          <Skeleton height={12} width="70%" style={styles.skeletonRow} />
          <Skeleton height={220} width="100%" style={[styles.skeletonRow, { marginTop: spacing.md }]} />
        </View>
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
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padded && styles.pad, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          {...rest}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.safe, padded && styles.pad, contentContainerStyle]} {...rest}>
          {children}
        </View>
      )}
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
  skeletonContainer: {
    gap: spacing.md,
  },
  skeletonRow: {
    marginBottom: spacing.xs,
  },
});
