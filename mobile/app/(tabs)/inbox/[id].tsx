import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type InboxMessage } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useEffectivePermissions } from '../../../src/hooks/useEffectivePermissions';
import { colors, spacing, rounded, typography } from '../../../src/theme';

export default function InboxThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeWorkspace, tenantId } = useWorkspace();
  const queryClient = useQueryClient();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;
  const { canReply, ready: permissionsReady } = useEffectivePermissions();
  const [draft, setDraft] = useState('');

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['inbox-messages', id, effectiveTenant, workspaceId],
    enabled: Boolean(id && effectiveTenant),
    queryFn: () => api.listInboxMessages(effectiveTenant!, id!, workspaceId),
  });

  const replyMutation = useMutation({
    mutationFn: () =>
      api.replyInbox(effectiveTenant!, id!, draft.trim(), workspaceId),
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({
        queryKey: ['inbox-messages', id, effectiveTenant, workspaceId],
      });
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={data as InboxMessage[]}
          keyExtractor={(item, index) => item.id || String(index)}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => (
            <View style={styles.bubble}>
              <Text style={styles.body}>{item.body || item.message || '—'}</Text>
              <Text style={styles.meta}>
                {item.direction || ''} · {item.createdAt || item.created_at || ''}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.meta}>No messages in this thread.</Text>}
        />
      )}
      {error ? <Text style={styles.error}>{error.message}</Text> : null}
      {replyMutation.error ? (
        <Text style={styles.error}>{(replyMutation.error as Error).message}</Text>
      ) : null}

      {!permissionsReady ? (
        <ActivityIndicator color={colors.primary} style={{ margin: spacing.lg }} />
      ) : canReply ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Write a reply…"
            placeholderTextColor={colors.mute}
            value={draft}
            onChangeText={setDraft}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || replyMutation.isPending) && styles.disabled]}
            disabled={!draft.trim() || replyMutation.isPending}
            onPress={() => replyMutation.mutate()}
          >
            {replyMutation.isPending ? (
              <ActivityIndicator color={colors['on-primary']} />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={[styles.meta, { padding: spacing.lg }]}>
          Reply disabled for your role.
        </Text>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors['canvas-soft'] },
  bubble: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  body: { ...typography.bodyMd, color: colors.ink },
  meta: { ...typography.caption, color: colors.mute, marginTop: spacing.xs },
  error: { color: colors.negative, paddingHorizontal: spacing.lg },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors['canvas-soft'],
    backgroundColor: colors.canvas,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: rounded.md,
    paddingHorizontal: spacing.md,
    ...typography.bodyMd,
    color: colors.ink,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: rounded.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  sendText: { ...typography.buttonMd, color: colors['on-primary'] },
  disabled: { opacity: 0.5 },
});
