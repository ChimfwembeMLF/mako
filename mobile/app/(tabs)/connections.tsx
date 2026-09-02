import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { api, type SocialAccount } from '../../src/lib/api';
import {
  handleOAuthCallback,
  parseOAuthCallbackUrl,
  type OAuthPickerState,
} from '../../src/lib/oauth-callback';
import { getMobileOAuthReturnUrl } from '../../src/lib/oauth-redirect';
import { PLATFORMS, platformMeta } from '../../src/constants/platforms';
import { TabShell } from '../../src/components/TabShell';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useOfflineBanner } from '../../src/components/OfflineBanner';
import { useTheme } from '../../src/context/ThemeContext';
import { colors, fonts, spacing, typography } from '../../src/theme';
import { Badge, Button, Card, EmptyState, PageHeader, Screen, useToast } from '../../src/components/ui';

type PickerState = OAuthPickerState;

export default function ConnectionsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { activeWorkspace, tenantId } = useWorkspace();
  const { reportError } = useOfflineBanner();
  const queryClient = useQueryClient();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);

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
        toast.error('Select a workspace using the header switcher first.');
        return;
      }
      setBusy(platform);
      try {
        const returnUrl = getMobileOAuthReturnUrl('publisher');
        const { redirectUrl } = await api.startOAuth(
          platform,
          effectiveTenant,
          returnUrl,
          workspaceId,
        );
        const result = await WebBrowser.openAuthSessionAsync(redirectUrl, returnUrl);
        if (result.type === 'success' && result.url) {
          const outcome = await handleOAuthCallback(parseOAuthCallbackUrl(result.url));
          if (outcome.errorMessage) {
            toast.error(outcome.errorMessage);
          } else if (outcome.successMessage) {
            toast.success(outcome.successMessage);
          } else if (outcome.picker) {
            setPicker(outcome.picker);
          }
        }
        await refetch();
      } catch (e: any) {
        toast.error(e.message || 'Could not connect');
      } finally {
        setBusy(null);
      }
    },
    [effectiveTenant, workspaceId, refetch, toast],
  );

  const disconnect = async (account: SocialAccount) => {
    if (!effectiveTenant) return;
    try {
      await api.disconnectSocial(account.id, effectiveTenant);
      await queryClient.invalidateQueries({
        queryKey: ['social-accounts', effectiveTenant, workspaceId],
      });
    } catch (e: any) {
      toast.error(e.message || 'Could not disconnect');
    }
  };

  if (!workspaceId || !effectiveTenant) {
    return (
      <TabShell>
        <Screen
          empty
          emptyTitle="No workspace selected"
          emptyMessage="Tap the workspace name at the top to choose a workspace."
        />
      </TabShell>
    );
  }

  if (isLoading) {
    return (
      <TabShell>
        <Screen loading skeleton />
      </TabShell>
    );
  }

  const connectedIds = new Set((data as SocialAccount[]).map((a) => a.platform));

  return (
    <TabShell>
    <Screen>
      <PageHeader
        title="Connections"
        subtitle="Link social accounts for the active workspace."
        icon={<Text style={[styles.headerIcon, { color: colors['positive-deep'] }]}>⛓</Text>}
      />

      <Text style={styles.sectionLabel}>Platforms</Text>
      <View style={styles.platformGrid}>
        {PLATFORMS.map((p) => {
          const connected = connectedIds.has(p.id);
          return (
            <Card key={p.id} style={styles.platformCard}>
              <View style={[styles.platformIcon, { backgroundColor: p.bg }]}>
                <Text style={[styles.platformGlyph, { color: p.color }]}>
                  {p.label.charAt(0)}
                </Text>
              </View>
              <View style={styles.platformCopy}>
                <Text style={styles.platformTitle}>{p.label}</Text>
                {connected ? <Badge label="Connected" tone="positive" /> : null}
              </View>
              <Button
                label={connected ? 'Add' : 'Connect'}
                variant={connected ? 'outline' : 'primary'}
                loading={busy === p.id}
                onPress={() => void connect(p.id)}
                style={styles.platformBtn}
              />
            </Card>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Connected accounts</Text>
      <FlatList
        data={data as SocialAccount[]}
        scrollEnabled={false}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const meta = platformMeta(item.platform);
          return (
            <Card style={styles.accountCard}>
              <View style={[styles.platformIcon, { backgroundColor: meta.bg }]}>
                <Text style={[styles.platformGlyph, { color: meta.color }]}>
                  {meta.label.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountTitle}>
                  {item.accountName || item.name || item.platform}
                </Text>
                <Text style={styles.accountMeta}>{meta.label}</Text>
              </View>
              <Button
                label="Disconnect"
                variant="ghost"
                onPress={() => void disconnect(item)}
                style={styles.disconnectBtn}
              />
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="No accounts connected"
            description="Connect a platform above to publish and manage inbox."
          />
        }
      />

      <Modal visible={Boolean(picker)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {picker?.kind === 'youtube'
                ? 'Select a channel'
                : picker?.kind === 'whatsapp'
                  ? 'Select a phone number'
                  : 'Select a Page'}
            </Text>
            {picker?.kind === 'facebook'
              ? picker.pages.map((page) => (
                  <Pressable
                    key={page.id}
                    style={styles.modalOption}
                    onPress={() => {
                      void (async () => {
                        try {
                          await api.finalizeFacebook({
                            setupToken: picker.setupToken,
                            pageId: page.id,
                          });
                          setPicker(null);
                          await refetch();
                        } catch (e: any) {
                          toast.error(e.message || 'Could not finalize');
                        }
                      })();
                    }}
                  >
                    <Text style={styles.accountTitle}>{page.name}</Text>
                  </Pressable>
                ))
              : null}
            {picker?.kind === 'youtube'
              ? picker.channels.map((ch) => (
                  <Pressable
                    key={ch.id}
                    style={styles.modalOption}
                    onPress={() => {
                      void (async () => {
                        try {
                          await api.finalizeYoutube({
                            setupToken: picker.setupToken,
                            channelId: ch.id,
                          });
                          setPicker(null);
                          await refetch();
                        } catch (e: any) {
                          toast.error(e.message || 'Could not finalize');
                        }
                      })();
                    }}
                  >
                    <Text style={styles.accountTitle}>{ch.title}</Text>
                  </Pressable>
                ))
              : null}
            {picker?.kind === 'whatsapp'
              ? picker.phones.map((phone) => (
                  <Pressable
                    key={phone.id}
                    style={styles.modalOption}
                    onPress={() => {
                      void (async () => {
                        try {
                          await api.finalizeWhatsapp({
                            setupToken: picker.setupToken,
                            phoneNumberId: phone.id,
                          });
                          setPicker(null);
                          await refetch();
                        } catch (e: any) {
                          toast.error(e.message || 'Could not finalize');
                        }
                      })();
                    }}
                  >
                    <Text style={styles.accountTitle}>
                      {phone.verifiedName || phone.displayPhoneNumber || phone.id}
                    </Text>
                  </Pressable>
                ))
              : null}
            <Button label="Cancel" variant="ghost" onPress={() => setPicker(null)} />
          </View>
        </View>
      </Modal>
    </Screen>
    </TabShell>
  );
}

const styles = StyleSheet.create({
  headerIcon: { fontSize: 18 },
  sectionLabel: {
    ...typography.bodySmStrong,
    fontFamily: fonts.bodySemi,
    color: colors.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  platformGrid: { gap: spacing.md, marginBottom: spacing.xl },
  platformCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  platformIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformGlyph: {
    ...typography.bodyMdStrong,
    fontFamily: fonts.bodySemi,
  },
  platformCopy: { flex: 1, gap: spacing.xs },
  platformTitle: {
    ...typography.bodyMdStrong,
    fontFamily: fonts.bodySemi,
    color: colors.ink,
  },
  platformBtn: { minHeight: 40, paddingHorizontal: spacing.md },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  accountTitle: {
    ...typography.bodyMdStrong,
    fontFamily: fonts.bodySemi,
    color: colors.ink,
  },
  accountMeta: {
    ...typography.bodySm,
    fontFamily: fonts.body,
    color: colors.mute,
    marginTop: spacing.xxs,
  },
  disconnectBtn: { minHeight: 36, paddingHorizontal: spacing.sm },
  emptyText: { ...typography.bodyMd, color: colors.mute },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    maxHeight: '70%',
  },
  modalTitle: {
    ...typography.displayXs,
    fontFamily: fonts.display,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  modalOption: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
