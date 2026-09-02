import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { fonts, spacing, typography } from '../../theme';

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
  const { colors } = useTheme();
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
          <Text style={[styles.backText, { color: colors.primary }]}>← More</Text>
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <View style={styles.lead}>
          {icon ? (
            <View style={[styles.iconTile, { backgroundColor: colors['primary-pale'] }]}>{icon}</View>
          ) : null}
          <View style={styles.copy}>
            <Text
              style={[styles.title, { color: colors.ink }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[styles.subtitle, { color: colors.mute }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {subtitle}
              </Text>
            ) : null}
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
    minWidth: 0,
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
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.md,
    minWidth: 0,
  },
  lead: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    ...typography.displayXs,
    fontFamily: fonts.display,
  },
  subtitle: {
    ...typography.bodySm,
    fontFamily: fonts.body,
  },
  actions: {
    flexShrink: 0,
    flexGrow: 0,
    alignSelf: 'flex-start',
    marginLeft: 'auto',
  },
});
