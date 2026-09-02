import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useWorkspace, type WorkspaceContextValue } from '../context/WorkspaceContext';
import { Badge } from './ui/Badge';
import { Sheet, SheetRow } from './ui/Sheet';
import { fonts, spacing, typography } from '../theme';

type WorkspaceRow = {
  id: string;
  name?: string;
  tenantId?: string;
  role?: string;
};

export function AppShellHeader() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { activeWorkspace, tenantId, setActiveWorkspace, setTenantId, reconcileWorkspaces } =
    useWorkspace();
  const [open, setOpen] = useState(false);

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces', tenantId],
    queryFn: () => api.getWorkspaces(tenantId),
  });

  React.useEffect(() => {
    if (Array.isArray(workspaces)) {
      void reconcileWorkspaces(workspaces as WorkspaceRow[]);
    }
  }, [workspaces, reconcileWorkspaces]);

  const selectWorkspace = async (item: WorkspaceRow) => {
    if (item.tenantId) await setTenantId(item.tenantId);
    const next: WorkspaceContextValue = {
      id: item.id,
      name: item.name || 'Untitled Workspace',
      role: item.role || 'member',
      tenantId: item.tenantId,
    };
    await setActiveWorkspace(next);
    setOpen(false);
  };

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            paddingTop: insets.top + spacing.xs,
            backgroundColor: colors.canvas,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => setOpen(true)} style={styles.trigger} accessibilityRole="button">
          <View style={[styles.iconTile, { backgroundColor: colors['primary-pale'] }]}>
            <Text style={[styles.iconGlyph, { color: colors['positive-deep'] }]}>◆</Text>
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.label, { color: colors.mute, fontFamily: fonts.body }]}>Workspace</Text>
            <Text
              style={[styles.name, { color: colors.ink, fontFamily: fonts.displaySemi }]}
              numberOfLines={1}
            >
              {activeWorkspace?.name || 'Select workspace'}
            </Text>
          </View>
          <Text style={[styles.chevron, { color: colors.mute }]}>▾</Text>
        </Pressable>
      </View>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Switch workspace">
        {(workspaces as WorkspaceRow[]).length === 0 ? (
          <Text style={[styles.empty, { color: colors.mute, fontFamily: fonts.body }]}>
            No workspaces found.
          </Text>
        ) : (
          (workspaces as WorkspaceRow[]).map((item) => {
            const selected = activeWorkspace?.id === item.id;
            return (
              <SheetRow
                key={item.id}
                label={item.name || 'Untitled Workspace'}
                subtitle={item.role ? `Role: ${item.role}` : undefined}
                selected={selected}
                onPress={() => void selectWorkspace(item)}
                right={selected ? <Badge label="Active" tone="positive" /> : null}
              />
            );
          })
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 16,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...typography.caption,
  },
  name: {
    ...typography.bodyMdStrong,
  },
  chevron: {
    fontSize: 14,
  },
  empty: {
    ...typography.bodyMd,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
});
