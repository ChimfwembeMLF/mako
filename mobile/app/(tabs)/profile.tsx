import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { TabShell } from '../../src/components/TabShell';
import { useAuth } from '../../src/context/AuthContext';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/context/ThemeContext';
import { fonts, spacing, typography, type ThemeColors } from '../../src/theme';
import { Icon, Button, Card, PageHeader, Screen } from '../../src/components/ui';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { signOut } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  });

  if (isLoading) {
    return <Screen loading />;
  }

  return (
    <TabShell>
    <Screen>
      <PageHeader
        title="Profile"
        subtitle="Account details for your signed-in Mako user."
        icon={<Icon name="user" size={20} color={colors['positive-deep']} />}
      />

      <Card style={styles.card}>
        {profile ? (
          <View style={styles.infoContainer}>
            <Field label="Email" value={profile.email || '—'} />
            <Field
              label="Name"
              value={[profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—'}
            />
            {profile.tenant?.name ? <Field label="Tenant" value={profile.tenant.name} /> : null}
            {activeWorkspace ? (
              <Field label="Active workspace" value={activeWorkspace.name} />
            ) : null}
          </View>
        ) : (
          <Text style={styles.errorText}>
            {error?.message || 'Could not load profile details.'}
          </Text>
        )}

        <Button label="Sign out" variant="outline" onPress={() => void signOut()} />
      </Card>
    </Screen>
    </TabShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    padding: spacing.xl,
  },
  infoContainer: {
    marginBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodySmStrong,
    fontFamily: fonts.bodySemi,
    color: colors.mute,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.bodyMd,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  errorText: {
    color: colors.negative,
    marginBottom: spacing.lg,
  },
});
