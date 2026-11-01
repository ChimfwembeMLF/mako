import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts, rounded, shadows, spacing, typography } from '../../theme';
import { Icon } from './Icon';

type Props = {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg?: string;
  onPress: () => void;
};

export function QuickLinkCard({ title, description, icon, iconBg, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.canvas, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: iconBg ?? colors['primary-pale'] }]}>{icon}</View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.description, { color: colors.mute }]}>{description}</Text>
      </View>
      <Icon name="chevronRight" size={20} color={colors.mute} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: rounded.xl,
    borderWidth: 1,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    ...shadows.softCard,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: rounded.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.headlineSm,
  },
  description: {
    ...typography.bodySm,
    fontFamily: fonts.bodyMedium,
  },
});
