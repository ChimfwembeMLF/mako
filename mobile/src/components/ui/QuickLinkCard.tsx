import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, rounded, spacing, typography } from '../../theme';

type Props = {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg?: string;
  onPress: () => void;
};

export function QuickLinkCard({
  title,
  description,
  icon,
  iconBg = colors['primary-pale'],
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.iconTile, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Text style={styles.arrow}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.96,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: rounded.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.bodyMdStrong,
    fontFamily: fonts.bodySemi,
    color: colors.ink,
  },
  description: {
    ...typography.bodySm,
    fontFamily: fonts.body,
    color: colors.mute,
  },
  arrow: {
    ...typography.bodyMdStrong,
    color: colors.mute,
  },
});
