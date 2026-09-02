import React from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { buildMoreMenuRows, type MobileNavItem } from '../../../src/constants/mobile-nav';
import { useEffectivePermissions } from '../../../src/hooks/useEffectivePermissions';
import { useTheme } from '../../../src/context/ThemeContext';
import { fonts, spacing, typography } from '../../../src/theme';
import { PageHeader, Screen } from '../../../src/components/ui';

function LockedNavItem({ item }: { item: MobileNavItem }) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.row, styles.rowLocked, { borderColor: colors.border, backgroundColor: colors.canvas }]}
      accessibilityRole="text"
    >
      <View style={[styles.iconTile, { backgroundColor: colors['canvas-soft'] }]}>
        <Text style={styles.icon}>{item.icon}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.mute, fontFamily: fonts.bodySemi }]}>{item.title}</Text>
        <Text style={[styles.rowDesc, { color: colors.mute, fontFamily: fonts.body }]}>
          Not available for your role
        </Text>
      </View>
      <Text style={[styles.lock, { color: colors.mute }]}>🔒</Text>
    </View>
  );
}

function NavRow({ item, onPress }: { item: MobileNavItem; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: colors.border, backgroundColor: colors.canvas },
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: colors['primary-pale'] }]}>
        <Text style={styles.icon}>{item.icon}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.ink, fontFamily: fonts.bodySemi }]}>{item.title}</Text>
        {item.description ? (
          <Text style={[styles.rowDesc, { color: colors.mute, fontFamily: fonts.body }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.chevron, { color: colors.mute }]}>›</Text>
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const perms = useEffectivePermissions();

  const sections = buildMoreMenuRows({
    can: perms.can,
    isSuperAdmin: perms.isSuperAdmin,
    loading: !perms.ready,
  }).map((group) => ({
    title: group.group,
    data: group.items,
  }));

  return (
    <Screen>
      <PageHeader
        title="More"
        subtitle="Brand tools, library, insights, and workspace admin."
        icon={<Text style={[styles.headerIcon, { color: colors['positive-deep'] }]}>☰</Text>}
      />

      <SectionList
        scrollEnabled={false}
        sections={sections}
        keyExtractor={(item) => item.route}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={[styles.sectionLabel, { color: colors.mute, fontFamily: fonts.bodySemi }]}>{title}</Text>
        )}
        renderItem={({ item }) =>
          item.locked ? (
            <LockedNavItem item={item} />
          ) : (
            <NavRow item={item} onPress={() => router.push(item.route as any)} />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        SectionSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        ListEmptyComponent={
          !perms.ready ? (
            <Text style={[styles.empty, { color: colors.mute }]}>Loading menu…</Text>
          ) : (
            <Text style={[styles.empty, { color: colors.mute }]}>No destinations available.</Text>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerIcon: {
    fontSize: 18,
  },
  sectionLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  rowLocked: {
    opacity: 0.85,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    ...typography.bodyMdStrong,
  },
  rowDesc: {
    ...typography.bodySm,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 24,
  },
  lock: {
    fontSize: 16,
  },
  empty: {
    ...typography.bodyMd,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});

/** @deprecated Use inline LockedNavItem — exported for task reference */
export { LockedNavItem };
