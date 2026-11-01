import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, rounded, shadows, spacing, typography } from '../../theme';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
};

export function HeroBanner({
  eyebrow = 'Social workspace',
  title,
  subtitle,
  primaryAction,
  secondaryAction,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.hero, { backgroundColor: colors['surface-contrast'] }]}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
      <Text style={[styles.title, { color: colors['on-contrast'] }]} numberOfLines={3} ellipsizeMode="tail">
        {title}
      </Text>
      <Text style={styles.subtitle} numberOfLines={4} ellipsizeMode="tail">
        {subtitle}
      </Text>
      {(primaryAction || secondaryAction) && (
        <View style={styles.actions}>
          {primaryAction ? (
            <Button label={primaryAction.label} onPress={primaryAction.onPress} style={styles.cta} />
          ) : null}
          {secondaryAction ? (
            <Button
              label={secondaryAction.label}
              variant="inverse"
              onPress={secondaryAction.onPress}
              style={styles.ctaOutline}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: rounded.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...shadows.floatingNav,
  },
  eyebrow: {
    ...typography.labelUppercase,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.displaySm,
    fontFamily: fonts.display,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodySm,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cta: {
    minHeight: 44,
  },
  ctaOutline: {
    minHeight: 44,
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
