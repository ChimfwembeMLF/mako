import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts, spacing, typography } from '../../theme';
import { Button } from './Button';

type Props = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, style]}>
      {icon ? <View style={[styles.iconTile, { backgroundColor: colors['primary-pale'] }]}>{icon}</View> : null}
      <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.displaySemi }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: colors.mute, fontFamily: fonts.body }]}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.displayXs,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.bodyMd,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  action: {
    minWidth: 160,
  },
});
