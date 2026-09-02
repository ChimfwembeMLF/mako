import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme';
import { EmptyState } from './EmptyState';
import { SkeletonList } from './Skeleton';

type Props = ScrollViewProps & {
  children?: React.ReactNode;
  loading?: boolean;
  skeleton?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  padded?: boolean;
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
  padded = true,
  contentContainerStyle,
  ...rest
}: Props) {
  const { colors } = useTheme();

  if (loading && skeleton) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors['canvas-soft'] }]} edges={['bottom']}>
        <View style={[padded && styles.pad]}>
          <SkeletonList count={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors['canvas-soft'] }]} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
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
