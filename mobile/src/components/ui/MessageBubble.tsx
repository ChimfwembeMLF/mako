import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMessageTime } from '../../lib/dates';
import { useTheme } from '../../context/ThemeContext';
import { fonts, rounded, spacing, typography } from '../../theme';

type Props = {
  body: string;
  timestamp?: string | null;
  authorName?: string | null;
  direction?: 'inbound' | 'outbound' | 'system';
  selected?: boolean;
  replyPreview?: string | null;
  status?: string | null;
  onPress?: () => void;
};

export function MessageBubble({
  body,
  timestamp,
  authorName,
  direction = 'inbound',
  selected,
  replyPreview,
  status,
  onPress,
}: Props) {
  const { colors } = useTheme();
  const outbound = direction === 'outbound';
  const system = direction === 'system';

  const content = (
    <View style={[styles.row, outbound && styles.rowOutbound]}>
      {!outbound ? (
        <View style={[styles.avatar, { backgroundColor: colors['primary-pale'] }]}>
          <Text style={[styles.avatarText, { color: colors['positive-deep'] }]}>
            {initials(authorName || 'Guest')}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.bubble,
          outbound
            ? { backgroundColor: colors.primary, borderBottomRightRadius: rounded.sm }
            : { backgroundColor: colors.canvas, borderTopLeftRadius: rounded.sm },
          selected && { borderWidth: 2, borderColor: colors['positive-deep'] },
          system && { backgroundColor: colors['canvas-soft'], alignSelf: 'center', maxWidth: '100%' },
        ]}
      >
        {authorName && !outbound ? (
          <Text style={[styles.author, { color: colors['positive-deep'] }]}>{authorName}</Text>
        ) : null}
        <Text style={[styles.body, { color: outbound ? colors['on-primary'] : colors.ink }]}>{body}</Text>
        {replyPreview ? (
          <View style={[styles.replyBox, { backgroundColor: colors['primary-pale'] }]}>
            <Text style={[styles.replyLabel, { color: colors['positive-deep'] }]}>Your reply</Text>
            <Text style={[styles.replyText, { color: colors.body }]}>{replyPreview}</Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          {status ? <Text style={[styles.status, { color: colors.mute }]}>{status}</Text> : null}
          {timestamp ? (
            <Text style={[styles.meta, { color: colors.mute }, outbound && styles.metaOutbound]}>
              {formatMessageTime(timestamp)}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rowOutbound: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: rounded.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.caption,
    fontFamily: fonts.bodySemi,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: rounded.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  author: {
    ...typography.caption,
    fontFamily: fonts.bodySemi,
    marginBottom: spacing.xxs,
  },
  body: {
    ...typography.bodyMd,
    fontFamily: fonts.body,
  },
  replyBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: rounded.md,
  },
  replyLabel: {
    ...typography.caption,
    fontFamily: fonts.bodySemi,
    marginBottom: spacing.xxs,
  },
  replyText: {
    ...typography.bodySm,
    fontFamily: fonts.body,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  meta: {
    ...typography.caption,
    fontFamily: fonts.body,
  },
  metaOutbound: {
    opacity: 0.65,
  },
  status: {
    ...typography.caption,
    fontFamily: fonts.bodySemi,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.96,
  },
});
