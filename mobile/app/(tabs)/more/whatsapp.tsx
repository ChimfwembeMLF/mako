import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { fonts, spacing, typography } from '../../../src/theme';
import { Badge, Button, Card, PageHeader, Screen } from '../../../src/components/ui';

export default function WhatsappScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { activeWorkspace, tenantId } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['whatsapp-status', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant),
    queryFn: () => api.getWhatsappStatus(effectiveTenant!, workspaceId),
  });

  if (!effectiveTenant) {
    return <Screen empty emptyTitle="No workspace" emptyMessage="Select a workspace from the header." />;
  }
  if (isLoading) return <Screen loading skeleton />;

  const connected = Boolean(data?.connected);
  const phone = data?.displayPhoneNumber;
  const account = data?.accountName;

  return (
    <Screen>
      <PageHeader
        title="WhatsApp"
        subtitle="Connection status and inbox access."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>💬</Text>}
      />

      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
            {connected ? 'Connected' : 'Not connected'}
          </Text>
          <Badge label={connected ? 'Live' : 'Setup needed'} tone={connected ? 'positive' : 'warning'} />
        </View>
        {phone ? (
          <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>{phone}</Text>
        ) : null}
        {account ? (
          <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>{account}</Text>
        ) : null}
        {data?.message ? (
          <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>{data.message}</Text>
        ) : null}
        {data?.graphError ? (
          <Text style={[styles.error, { color: colors.negative, fontFamily: fonts.body }]}>{data.graphError}</Text>
        ) : null}
        {error ? (
          <Text style={[styles.error, { color: colors.negative, fontFamily: fonts.body }]}>{error.message}</Text>
        ) : null}
        {!connected ? (
          <Text style={[styles.hint, { color: colors.mute, fontFamily: fonts.body }]}>
            Complete WhatsApp Business setup on the web app, then return here to confirm status.
          </Text>
        ) : null}
      </Card>

      <Button
        label="Open Social Inbox"
        variant="primary"
        onPress={() => router.push('/inbox' as any)}
        style={styles.button}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.bodyMdStrong },
  meta: { ...typography.bodySm, marginTop: spacing.xs },
  error: { ...typography.bodySm, marginTop: spacing.sm },
  hint: { ...typography.bodySm, marginTop: spacing.md },
  button: { marginTop: spacing.sm },
});
