import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, assertReplySent, type InboxMessage } from '../lib/api';
import { resolveQueued } from '../lib/queue';
import { useWorkspace } from '../context/WorkspaceContext';
import { useEffectivePermissions } from '../hooks/useEffectivePermissions';
import { useTheme } from '../context/ThemeContext';
import { Button, Input, MessageBubble } from './ui';
import { fonts, spacing, typography } from '../theme';

type CommentNode = {
  id: string;
  commentText?: string;
  commenterName?: string;
  replyText?: string | null;
  status?: string | null;
  created_at?: string;
};

export type InboxThreadPanelProps = {
  id: string;
  channel?: string;
  contentId?: string;
};

export function InboxThreadPanel({ id, channel, contentId }: InboxThreadPanelProps) {
  const { colors } = useTheme();
  const isComment = channel === 'post_comment' || String(id || '').startsWith('post:');
  const { activeWorkspace, tenantId } = useWorkspace();
  const queryClient = useQueryClient();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;
  const { canReply, ready: permissionsReady } = useEffectivePermissions();
  const [draft, setDraft] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiDraftError, setAiDraftError] = useState<string | null>(null);

  const dmQuery = useQuery({
    queryKey: ['inbox-messages', id, effectiveTenant, workspaceId],
    enabled: Boolean(id && effectiveTenant) && !isComment,
    queryFn: () => api.listInboxMessages(effectiveTenant!, id!, workspaceId),
  });

  const commentQuery = useQuery({
    queryKey: ['comment-thread', contentId || id, effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant) && isComment,
    queryFn: async () => {
      const resolvedContentId =
        contentId || (String(id).startsWith('post:') ? String(id).slice(5) : undefined);
      const data = await api.commentRepliesInbox(effectiveTenant!, workspaceId, resolvedContentId);
      const posts = data?.posts || [];
      const post =
        posts.find((p: any) => String(p.contentId) === String(resolvedContentId)) || posts[0];
      const comments = (post?.comments || []) as CommentNode[];
      if (comments[0]?.id && !replyTargetId) {
        setReplyTargetId(comments[0].id);
      }
      return comments;
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const text = draft.trim();
      if (!text) throw new Error('Message is required');
      if (isComment) {
        const target = replyTargetId || (commentQuery.data?.[0] as CommentNode | undefined)?.id;
        if (!target) throw new Error('No comment selected to reply to');
        const result = await api.sendCommentReply(target, text);
        return assertReplySent(result);
      }
      const result = await api.replyInbox(effectiveTenant!, id!, text, workspaceId);
      return assertReplySent(result);
    },
    onSuccess: async () => {
      setDraft('');
      if (isComment) {
        await queryClient.invalidateQueries({
          queryKey: ['comment-thread', contentId || id, effectiveTenant, workspaceId],
        });
      } else {
        await queryClient.invalidateQueries({
          queryKey: ['inbox-messages', id, effectiveTenant, workspaceId],
        });
      }
    },
  });

  const runAiDraft = async () => {
    if (!isComment) return;
    const target = replyTargetId || (commentQuery.data?.[0] as CommentNode | undefined)?.id;
    if (!target) {
      setAiDraftError('Select a comment to reply to');
      return;
    }
    setAiDraftError(null);
    setAiDrafting(true);
    try {
      const raw = await api.suggestCommentReply(target);
      const result = (await resolveQueued(raw as any)) as { content?: string };
      const text = result?.content?.trim() ?? '';
      if (!text) throw new Error('No suggestion returned');
      setDraft(text);
    } catch (e: any) {
      setAiDraftError(e.message || 'AI draft failed');
    } finally {
      setAiDrafting(false);
    }
  };

  const isLoading = isComment ? commentQuery.isLoading : dmQuery.isLoading;
  const error = isComment ? commentQuery.error : dmQuery.error;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors['canvas-soft'] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {isComment ? (
        <View style={[styles.hintBar, { backgroundColor: colors['primary-pale'] }]}>
          <Text style={[styles.hintText, { color: colors['positive-deep'], fontFamily: fonts.bodySemi }]}>
            Tap a comment to select it for reply
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : isComment ? (
        <FlatList
          data={(commentQuery.data || []) as CommentNode[]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.thread}
          renderItem={({ item }) => (
            <MessageBubble
              body={item.commentText || '—'}
              authorName={item.commenterName || 'Commenter'}
              timestamp={item.created_at}
              status={item.status || undefined}
              replyPreview={item.replyText}
              selected={replyTargetId === item.id}
              onPress={() => setReplyTargetId(item.id)}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.mute, fontFamily: fonts.body }]}>
              No comments in this thread.
            </Text>
          }
        />
      ) : (
        <FlatList
          data={(dmQuery.data || []) as InboxMessage[]}
          keyExtractor={(item, index) => item.id || String(index)}
          contentContainerStyle={styles.thread}
          renderItem={({ item }) => {
            const directionRaw = String(item.direction || '').toLowerCase();
            const outbound =
              directionRaw.includes('out') ||
              directionRaw === 'sent' ||
              directionRaw === 'agent';
            return (
              <MessageBubble
                body={item.body || item.message || '—'}
                timestamp={item.createdAt || item.created_at}
                direction={outbound ? 'outbound' : 'inbound'}
                authorName={outbound ? 'You' : 'Contact'}
              />
            );
          }}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.mute, fontFamily: fonts.body }]}>
              No messages in this thread.
            </Text>
          }
        />
      )}

      {error ? (
        <Text style={[styles.error, { color: colors.negative, fontFamily: fonts.body }]}>
          {(error as Error).message}
        </Text>
      ) : null}
      {replyMutation.error ? (
        <Text style={[styles.error, { color: colors.negative, fontFamily: fonts.body }]}>
          {(replyMutation.error as Error).message}
        </Text>
      ) : null}
      {aiDraftError ? (
        <Text style={[styles.error, { color: colors.negative, fontFamily: fonts.body }]}>{aiDraftError}</Text>
      ) : null}

      {!permissionsReady ? (
        <ActivityIndicator color={colors.primary} style={{ margin: spacing.lg }} />
      ) : canReply ? (
        <View
          style={[
            styles.composer,
            { borderTopColor: colors.border, backgroundColor: colors.canvas },
          ]}
        >
          <Input
            placeholder={isComment ? 'Reply to selected comment…' : 'Write a reply…'}
            value={draft}
            onChangeText={setDraft}
            style={styles.input}
            multiline
          />
          {isComment ? (
            <Button
              label="AI draft"
              variant="outline"
              onPress={() => void runAiDraft()}
              loading={aiDrafting}
              disabled={aiDrafting || replyMutation.isPending}
              style={styles.aiBtn}
            />
          ) : null}
          <Button
            label="Send"
            onPress={() => replyMutation.mutate()}
            loading={replyMutation.isPending}
            disabled={!draft.trim() || replyMutation.isPending}
            style={styles.sendBtn}
          />
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.mute, fontFamily: fonts.body }]}>
          Reply disabled for your role.
        </Text>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hintBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  hintText: {
    ...typography.caption,
  },
  thread: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  empty: {
    ...typography.bodySm,
    textAlign: 'center',
    padding: spacing.lg,
  },
  error: {
    paddingHorizontal: spacing.lg,
  },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  aiBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  sendBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
});
