import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { useEffectivePermissions } from '../hooks/useEffectivePermissions';
import { colors, spacing, rounded, typography } from '../theme';

const PLATFORM_OPTIONS = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'youtube'];

export default function ContentEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isNew = !id || id === 'new';
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeWorkspace, tenantId } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const { canPublish, ready: permissionsReady } = useEffectivePermissions();

  const { data: socialAccounts = [] } = useQuery({
    queryKey: ['social-accounts', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant && workspaceId),
    queryFn: () => api.listSocialAccounts(effectiveTenant!, workspaceId),
  });
  const hasConnectedAccounts = socialAccounts.length > 0;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['facebook']);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [localImage, setLocalImage] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['content-item', id],
    enabled: !isNew && Boolean(id),
    queryFn: async () => {
      const item = await api.getContent(id!);
      setTitle(item.title || '');
      setContent(item.content || '');
      setPlatforms(item.platforms?.length ? item.platforms : ['facebook']);
      setScheduledDate(item.scheduledDate ? String(item.scheduledDate).slice(0, 10) : '');
      setScheduledTime(item.scheduledTime || '');
      return item;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['content', effectiveTenant, workspaceId] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveTenant || !workspaceId) throw new Error('Select a workspace first');
      if (!content.trim()) throw new Error('Post content is required');
      const body = {
        tenantId: effectiveTenant,
        workspaceId,
        contentType: 'post',
        title: title.trim() || 'Untitled',
        content: content.trim(),
        platforms,
        status: scheduledDate ? 'scheduled' : 'draft',
        ...(scheduledDate ? { scheduledDate, scheduledTime: scheduledTime || '09:00' } : {}),
      };
      if (isNew) {
        return api.createContent(body);
      }
      return api.updateContent(id!, body);
    },
    onSuccess: (item) => {
      invalidate();
      if (isNew && item?.id) {
        router.replace(`/content/${item.id}` as any);
      }
      setStatusMsg('Saved');
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setLocalImage(result.assets[0].uri);
    }
  };

  const uploadAndAttach = async (contentId: string) => {
    if (!localImage || !effectiveTenant) return;
    const uploaded = await api.uploadMedia(localImage, effectiveTenant, workspaceId, contentId);
    const url = uploaded?.url || uploaded?.asset?.url || uploaded?.data?.url;
    const assetId = uploaded?.id || uploaded?.asset?.id;
    if (url) {
      await api.attachMedia(contentId, effectiveTenant, [
        { url, type: 'image', assetId },
      ]);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    setStatusMsg('');
    try {
      const item = await saveMutation.mutateAsync();
      if (localImage && item?.id) {
        await uploadAndAttach(item.id);
        setLocalImage(null);
        setStatusMsg('Saved with media');
        invalidate();
      }
    } catch (e: any) {
      setStatusMsg(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!permissionsReady || !canPublish) {
      Alert.alert('Permission', 'You do not have permission to publish.');
      return;
    }
    if (!hasConnectedAccounts) {
      Alert.alert(
        'Connect accounts',
        'This workspace has no connected social accounts. Open Connections to link one before publishing.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Connections',
            onPress: () => router.push('/connections' as any),
          },
        ],
      );
      return;
    }
    if (!platforms.length) {
      Alert.alert('Platforms', 'Select at least one platform.');
      return;
    }
    setBusy(true);
    setStatusMsg('');
    try {
      let contentId = id;
      if (isNew || !contentId) {
        const item = await saveMutation.mutateAsync();
        contentId = item.id;
        if (localImage) await uploadAndAttach(contentId);
      } else if (localImage) {
        await uploadAndAttach(contentId);
      }
      const result = await api.publishContent(contentId!, platforms);
      const results = result?.results;
      if (results) {
        const lines = Object.entries(results)
          .map(([k, v]: [string, any]) => `${k}: ${v.published ? 'ok' : v.message || 'failed'}`)
          .join('\n');
        setStatusMsg(lines || result?.message || 'Publish finished');
      } else {
        setStatusMsg(result?.message || (result?.queued ? 'Queued for publish' : 'Published'));
      }
      invalidate();
    } catch (e: any) {
      setStatusMsg(e.message || 'Publish failed');
    } finally {
      setBusy(false);
    }
  };

  if (!workspaceId) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>Select a workspace on Home first.</Text>
      </View>
    );
  }

  if (!isNew && isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor={colors.mute}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, styles.body]}
        placeholder="Write your post…"
        placeholderTextColor={colors.mute}
        value={content}
        onChangeText={setContent}
        multiline
      />

      <Text style={styles.label}>Platforms</Text>
      <View style={styles.row}>
        {PLATFORM_OPTIONS.map((p) => {
          const on = platforms.includes(p);
          return (
            <TouchableOpacity
              key={p}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => togglePlatform(p)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{p}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Schedule (optional YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        placeholder="2026-09-01"
        placeholderTextColor={colors.mute}
        value={scheduledDate}
        onChangeText={setScheduledDate}
      />
      <TextInput
        style={styles.input}
        placeholder="09:00"
        placeholderTextColor={colors.mute}
        value={scheduledTime}
        onChangeText={setScheduledTime}
      />

      <TouchableOpacity style={styles.secondaryBtn} onPress={() => void pickImage()}>
        <Text style={styles.secondaryBtnText}>
          {localImage ? 'Change image' : 'Add image'}
        </Text>
      </TouchableOpacity>
      {localImage ? (
        <Image source={{ uri: localImage }} style={styles.preview} />
      ) : null}

      {statusMsg ? <Text style={styles.status}>{statusMsg}</Text> : null}

      <TouchableOpacity
        style={[styles.primaryBtn, busy && styles.disabled]}
        onPress={() => void handleSave()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors['on-primary']} />
        ) : (
          <Text style={styles.primaryBtnText}>Save draft</Text>
        )}
      </TouchableOpacity>

      {!permissionsReady ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
      ) : canPublish ? (
        <>
          {!hasConnectedAccounts ? (
            <Text style={styles.meta}>
              Connect a social account under Connections before publishing.
            </Text>
          ) : null}
          <TouchableOpacity
            style={[
              styles.publishBtn,
              (busy || !hasConnectedAccounts) && styles.disabled,
            ]}
            onPress={() => void handlePublish()}
            disabled={busy || !hasConnectedAccounts}
          >
            <Text style={styles.primaryBtnText}>Publish now</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.meta}>Publish disabled for your role.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors['canvas-soft'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.ink,
    borderWidth: 1,
    borderRadius: rounded.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...typography.bodyMd,
    color: colors.ink,
  },
  body: { minHeight: 140, textAlignVertical: 'top' },
  label: { ...typography.bodySmStrong, color: colors.mute, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    borderWidth: 1,
    borderColor: colors.mute,
    borderRadius: rounded.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.ink },
  chipTextOn: { color: colors['on-primary'] },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: rounded.xl,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  publishBtn: {
    backgroundColor: colors['ink-deep'],
    borderRadius: rounded.xl,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing['2xl'],
  },
  primaryBtnText: { ...typography.buttonMd, color: colors['on-primary'] },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: rounded.xl,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  secondaryBtnText: { ...typography.buttonMd, color: colors.ink },
  preview: { width: '100%', height: 180, borderRadius: rounded.lg, marginBottom: spacing.md },
  status: { ...typography.bodySm, color: colors.body, marginBottom: spacing.md },
  meta: { ...typography.bodySm, color: colors.mute, textAlign: 'center' },
  disabled: { opacity: 0.6 },
});
