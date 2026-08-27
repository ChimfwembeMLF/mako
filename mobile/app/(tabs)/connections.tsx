import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api, type SocialAccount } from '../../src/lib/api';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useOfflineBanner } from '../../src/components/OfflineBanner';
import { colors, spacing, rounded, typography } from '../../src/theme';

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'linkedin', label: 'LinkedIn' },
];

export default function ConnectionsScreen() {
  const { activeWorkspace, tenantId } = useWorkspace();
  const { reportError } = useOfflineBanner();
  const queryClient = useQueryClient();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;
  const [busy, setBusy] = useState<string | null>(null);
  const [pagePicker, setPagePicker] = useState<{
    setupToken: string;
    pages: Array<{ id: string; name: string }>;
  } | null>(null);

  const { data = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['social-accounts', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant && workspaceId),
    queryFn: () => api.listSocialAccounts(effectiveTenant!, workspaceId),
  });

  React.useEffect(() => {
    reportError(error?.message ?? null);
  }, [error, reportError]);

  const connect = useCallback(
    async (platform: string) => {
      if (!effectiveTenant || !workspaceId) {
        Alert.alert('Workspace', 'Select a workspace on Home first.');
        return;
      }
      setBusy(platform);
      try {
        const returnUrl = Linking.createURL('publisher');
        const { redirectUrl } = await api.startOAuth(
          platform,
          effectiveTenant,
          returnUrl,
          workspaceId,
        );
        const result = await WebBrowser.openAuthSessionAsync(redirectUrl, returnUrl);
        if (result.type === 'success' && result.url) {
          const parsed = Linking.parse(result.url);
          const setup =
            (parsed.queryParams?.facebookSetup as string) ||
            (parsed.queryParams?.setupToken as string);
          if (setup && (platform === 'facebook' || platform === 'instagram')) {
            const setupData = await api.getFacebookSetup(setup);
            const pages = setupData?.pages || [];
            if (pages.length === 1) {
              await api.finalizeFacebook({ setupToken: setup, pageId: pages[0].id });
            } else if (pages.length > 1) {
              setPagePicker({ setupToken: setup, pages });
            }
          }
        }
        await refetch();
      } catch (e: any) {
        Alert.alert('Connection failed', e.message || 'Could not connect');
      } finally {
        setBusy(null);
      }
    },
    [effectiveTenant, workspaceId, refetch],
  );

  const disconnect = async (account: SocialAccount) => {
    if (!effectiveTenant) return;
    try {
      await api.disconnectSocial(account.id, effectiveTenant);
      await queryClient.invalidateQueries({
        queryKey: ['social-accounts', effectiveTenant, workspaceId],
      });
    } catch (e: any) {
      Alert.alert('Disconnect failed', e.message || 'Could not disconnect');
    }
  };

  if (!workspaceId || !effectiveTenant) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>Select a workspace on Home first.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connections</Text>
      <Text style={styles.meta}>Link accounts for the active workspace.</Text>

      <View style={styles.row}>
        {PLATFORMS.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.connectBtn}
            disabled={busy === p.id}
            onPress={() => void connect(p.id)}
          >
            {busy === p.id ? (
              <ActivityIndicator color={colors['on-primary']} />
            ) : (
              <Text style={styles.connectBtnText}>{p.label}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <FlatList
          data={data as SocialAccount[]}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {item.accountName || item.name || item.platform}
                </Text>
                <Text style={styles.meta}>{item.platform}</Text>
              </View>
              <TouchableOpacity onPress={() => void disconnect(item)}>
                <Text style={styles.danger}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.meta}>No accounts connected yet.</Text>}
        />
      )}

      <Modal visible={Boolean(pagePicker)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.title}>Select a Page</Text>
            {pagePicker?.pages.map((page) => (
              <Pressable
                key={page.id}
                style={styles.card}
                onPress={() => {
                  void (async () => {
                    try {
                      await api.finalizeFacebook({
                        setupToken: pagePicker.setupToken,
                        pageId: page.id,
                      });
                      setPagePicker(null);
                      await refetch();
                    } catch (e: any) {
                      Alert.alert('Finalize failed', e.message || 'Could not finalize');
                    }
                  })();
                }}
              >
                <Text style={styles.cardTitle}>{page.name}</Text>
              </Pressable>
            ))}
            <TouchableOpacity onPress={() => setPagePicker(null)}>
              <Text style={styles.meta}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors['canvas-soft'], padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.displayXs, color: colors.ink, marginBottom: spacing.sm },
  meta: { ...typography.bodySm, color: colors.mute, marginBottom: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  connectBtn: {
    backgroundColor: colors.primary,
    borderRadius: rounded.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  connectBtnText: { ...typography.buttonMd, color: colors['on-primary'] },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardTitle: { ...typography.bodyMdStrong, color: colors.ink },
  danger: { ...typography.bodySmStrong, color: colors.negative },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: rounded.xl,
    borderTopRightRadius: rounded.xl,
    padding: spacing.xl,
    maxHeight: '70%',
  },
});
