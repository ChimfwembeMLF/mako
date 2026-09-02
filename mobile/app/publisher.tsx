import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  handleOAuthCallback,
  parseOAuthCallbackParams,
  type OAuthPickerState,
} from '../src/lib/oauth-callback';
import { useWorkspace } from '../src/context/WorkspaceContext';
import { api } from '../src/lib/api';
import { Button, Screen, useToast } from '../src/components/ui';
import { colors, fonts, spacing, typography } from '../src/theme';

export default function PublisherOAuthScreen() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { activeWorkspace, tenantId } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;
  const [picker, setPicker] = useState<OAuthPickerState | null>(null);
  const [processing, setProcessing] = useState(true);

  const invalidateAccounts = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['social-accounts', effectiveTenant, workspaceId],
    });
  };

  useEffect(() => {
    let cancelled = false;
    const callbackParams = parseOAuthCallbackParams(params);

    void (async () => {
      try {
        const outcome = await handleOAuthCallback(callbackParams);
        if (cancelled) return;

        if (outcome.errorMessage) {
          toast.error(outcome.errorMessage);
        } else if (outcome.successMessage) {
          toast.success(outcome.successMessage);
          await invalidateAccounts();
        }

        if (outcome.picker) {
          setPicker(outcome.picker);
          setProcessing(false);
          return;
        }

        router.replace('/(tabs)/connections');
      } catch (e: any) {
        if (!cancelled) {
          toast.error(e.message || 'Connection failed');
          router.replace('/(tabs)/connections');
        }
      } finally {
        if (!cancelled) setProcessing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for this redirect URL
  }, []);

  const finish = async (message: string) => {
    toast.success(message);
    setPicker(null);
    await invalidateAccounts();
    router.replace('/(tabs)/connections');
  };

  if (processing && !picker) {
    return <Screen loading loadingMessage="Finishing connection…" padded={false} />;
  }

  return (
    <Screen>
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
                          await finish('Facebook connected');
                        } catch (e: any) {
                          toast.error(e.message || 'Could not finalize');
                        }
                      })();
                    }}
                  >
                    <Text style={styles.optionTitle}>{page.name}</Text>
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
                          await finish('YouTube connected');
                        } catch (e: any) {
                          toast.error(e.message || 'Could not finalize');
                        }
                      })();
                    }}
                  >
                    <Text style={styles.optionTitle}>{ch.title}</Text>
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
                          await finish('WhatsApp connected');
                        } catch (e: any) {
                          toast.error(e.message || 'Could not finalize');
                        }
                      })();
                    }}
                  >
                    <Text style={styles.optionTitle}>
                      {phone.verifiedName || phone.displayPhoneNumber || phone.id}
                    </Text>
                  </Pressable>
                ))
              : null}
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => router.replace('/(tabs)/connections')}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  optionTitle: {
    ...typography.bodyMdStrong,
    fontFamily: fonts.bodySemi,
    color: colors.ink,
  },
});
