import React from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { buildMoreMenuRows, type MobileNavItem } from '../../../src/constants/mobile-nav';
import { useEffectivePermissions } from '../../../src/hooks/useEffectivePermissions';
import { useAuth } from '../../../src/context/AuthContext';
import { api } from '../../../src/lib/api';
import { useTheme } from '../../../src/context/ThemeContext';
import { fonts, rounded, shadows, spacing, typography } from '../../../src/theme';
import { Button, Icon, PageHeader, Screen } from '../../../src/components/ui';

function LockedNavItem({ item }: { item: MobileNavItem }) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.row, styles.rowLocked, { borderColor: colors.border, backgroundColor: colors.canvas }]}
      accessibilityRole="text"
    >
      <View style={[styles.iconTile, { backgroundColor: colors['canvas-soft'] }]}>
        <Icon name={item.icon} size={20} color={colors.mute} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.mute }]}>{item.title}</Text>
        <Text style={[styles.rowDesc, { color: colors.mute, fontFamily: fonts.body }]}>
          Ask a workspace admin for access
        </Text>
      </View>
      <Icon name="lock" size={18} color={colors.mute} />
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
        <Icon name={item.icon} size={20} color={colors['positive-deep']} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.ink }]}>{item.title}</Text>
        {item.description ? (
          <Text style={[styles.rowDesc, { color: colors.mute, fontFamily: fonts.body }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
      </View>
      <Icon name="chevronRight" size={20} color={colors.mute} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const perms = useEffectivePermissions();
  const { signOut } = useAuth();
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: api.getProfile });

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
        icon={<Icon name="menu" size={20} color={colors['positive-deep']} />}
      />

      <SectionList
        scrollEnabled={false}
        sections={sections}
        keyExtractor={(item) => item.route}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={[styles.sectionLabel, { color: colors.mute }]}>{title}</Text>
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
        // Outside the permission-gated rows so every role can sign out.
        ListFooterComponent={
          <View style={styles.account}>
            {profile?.email ? (
              <Text style={[styles.accountEmail, { color: colors.mute }]} numberOfLines={1}>
                Signed in as {profile.email}
              </Text>
            ) : null}
            <Button label="Sign out" variant="outline" onPress={() => void signOut()} />
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    ...typography.labelUppercase,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: rounded.xl,
    borderWidth: 1,
    ...shadows.softCard,
  },
  rowLocked: {
    opacity: 0.85,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: rounded.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    ...typography.headlineSm,
  },
  rowDesc: {
    ...typography.bodySm,
    fontFamily: fonts.bodyMedium,
    marginTop: 2,
  },
  account: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  accountEmail: {
    ...typography.bodySm,
    fontFamily: fonts.bodyMedium,
    textAlign: 'center',
  },
  empty: {
    ...typography.bodyMd,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});

/** @deprecated Use inline LockedNavItem — exported for task reference */
export { LockedNavItem };
