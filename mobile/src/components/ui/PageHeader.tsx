import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { colors, fonts, spacing, typography } from '../../theme';

type Props = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  /** Show ← back control (auto-detected on More sub-screens when omitted) */
  showBack?: boolean;
};

export function PageHeader({ title, subtitle, icon, actions, showBack }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const onMoreSubScreen = /\/more\/.+/.test(pathname);
  const shouldShowBack = showBack ?? onMoreSubScreen;

  return (
    <View style={styles.wrap}>
      {shouldShowBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to More menu"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>← More</Text>
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <View style={styles.lead}>
          {icon ? <View style={styles.iconTile}>{icon}</View> : null}
          <View style={styles.copy}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backText: {
    ...typography.bodySmStrong,
    fontFamily: fonts.bodySemi,
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  lead: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors['primary-pale'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.displayXs,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  subtitle: {
    ...typography.bodySm,
    fontFamily: fonts.body,
    color: colors.mute,
  },
  actions: {
    flexShrink: 0,
  },
});
