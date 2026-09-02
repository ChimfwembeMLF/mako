import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../src/context/AuthContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { api } from '../../../src/lib/api';
import { fonts, spacing, typography } from '../../../src/theme';
import { Button, Card, PageHeader, Screen } from '../../../src/components/ui';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { activeWorkspace } = useWorkspace();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  });

  if (isLoading) return <Screen loading skeleton />;

  return (
    <Screen>
      <PageHeader
        title="Settings"
        subtitle="Account and appearance preferences."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>⚙</Text>}
      />
      <Card style={styles.card}>
        <Field label="Email" value={profile?.email || '—'} colors={colors} />
        <Field
          label="Name"
          value={[profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || '—'}
          colors={colors}
        />
        {activeWorkspace ? (
          <Field label="Active workspace" value={activeWorkspace.name} colors={colors} />
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.section, { color: colors.ink, fontFamily: fonts.bodySemi }]}>Appearance</Text>
        <Text style={[styles.hint, { color: colors.mute, fontFamily: fonts.body }]}>
          {isDark ? 'Dark mode is on' : 'Light mode is on'}
        </Text>
        <Button
          label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          variant="outline"
          onPress={toggleTheme}
          style={styles.themeBtn}
        />
      </Card>

      <Button label="Sign out" variant="outline" onPress={() => void signOut()} />
    </Screen>
  );
}

function Field({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: { mute: string; ink: string };
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.mute, fontFamily: fonts.bodySemi }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.ink, fontFamily: fonts.body }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.xl, marginBottom: spacing.lg },
  field: { marginBottom: spacing.lg },
  label: { ...typography.bodySmStrong, marginBottom: spacing.xxs },
  value: { ...typography.bodyMd },
  section: { ...typography.bodyMdStrong, marginBottom: spacing.xs },
  hint: { ...typography.bodySm, marginBottom: spacing.md },
  themeBtn: { marginBottom: spacing.sm },
});
