import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, fonts, rounded, spacing, typography } from '../../theme';

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
  return (
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
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
    backgroundColor: colors.ink,
    borderRadius: rounded.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  eyebrow: {
    ...typography.caption,
    fontFamily: fonts.bodySemi,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.displaySm,
    fontFamily: fonts.display,
    color: colors.canvas,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodySm,
    fontFamily: fonts.body,
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
