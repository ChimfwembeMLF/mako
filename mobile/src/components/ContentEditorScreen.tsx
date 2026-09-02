import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { useTheme } from '../context/ThemeContext';
import { useEffectivePermissions } from '../hooks/useEffectivePermissions';
import { fonts, spacing, rounded, typography } from '../theme';
import { Button, Chip, FormFieldAi, Input, Sheet, SheetRow, useToast } from './ui';
import { resolveQueued } from '../lib/queue';

const PLATFORM_OPTIONS = [
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
  'whatsapp',
];

export default function ContentEditorScreen() {
  const { id, templateTitle, templateBody } = useLocalSearchParams<{
    id?: string;
    templateTitle?: string;
    templateBody?: string;
  }>();
  const isNew = !id || id === 'new';
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeWorkspace, tenantId } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const {
    canPublish,
    canCreate,
    canEdit,
    ready: permissionsReady,
  } = useEffectivePermissions();
  const canMutate = isNew ? canCreate : canEdit;
  const toast = useToast();
  const { colors } = useTheme();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryPick, setLibraryPick] = useState<{ url: string; assetId?: string; type?: string } | null>(
    null,
  );

  const { data: socialAccounts = [] } = useQuery({
    queryKey: ['social-accounts', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant && workspaceId),
    queryFn: () => api.listSocialAccounts(effectiveTenant!, workspaceId),
  });

  const { data: libraryMedia = [], isLoading: libraryLoading } = useQuery({
    queryKey: ['media', effectiveTenant, workspaceId, 'picker'],
    enabled: Boolean(libraryOpen && effectiveTenant),
    queryFn: () => api.listMedia(effectiveTenant!, workspaceId),
  });

  const connectedPlatforms = useMemo(() => {
    const set = new Set<string>();
    for (const a of socialAccounts) {
      if (a.platform) set.add(String(a.platform).toLowerCase());
    }
    return set;
  }, [socialAccounts]);

  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [content, setContent] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [localImage, setLocalImage] = useState<string | null>(null);
  const [existingMedia, setExistingMedia] = useState<
    Array<{ id?: string; url?: string; type?: string }>
  >([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['content-item', id],
    enabled: !isNew && Boolean(id),
    queryFn: async () => {
      const item = await api.getContent(id!);
      setTitle(item.title || '');
      setTheme(item.campaignTheme || '');
      setContent(item.content || '');
      const itemPlatforms = (item.platforms || []).map((p) => String(p).toLowerCase());
      setPlatforms(itemPlatforms);
      setScheduledDate(item.scheduledDate ? String(item.scheduledDate).slice(0, 10) : '');
      setScheduledTime(item.scheduledTime || '');
      setExistingMedia(item.media || []);
      return item;
    },
  });

  React.useEffect(() => {
    if (!isNew) return;
    if (templateTitle) setTitle(String(templateTitle));
    if (templateBody) setContent(String(templateBody));
  }, [isNew, templateTitle, templateBody]);

  React.useEffect(() => {
    if (!isNew) return;
    if (platforms.length) return;
    const first = [...connectedPlatforms][0];
    if (first) setPlatforms([first]);
  }, [isNew, connectedPlatforms, platforms.length]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['content', effectiveTenant, workspaceId] });
  };

  const buildBody = (statusOverride?: string) => {
    const status =
      statusOverride ||
      (scheduledDate ? 'scheduled' : 'draft');
    return {
      tenantId: effectiveTenant!,
      workspaceId: workspaceId!,
      contentType: 'post',
      title: title.trim() || 'Untitled',
      content: content.trim(),
      campaignTheme: theme.trim() || undefined,
      platforms,
      status,
      ...(status === 'scheduled' && scheduledDate
        ? { scheduledDate, scheduledTime: scheduledTime || '09:00' }
        : status === 'draft'
          ? { scheduledDate: null, scheduledTime: null }
          : {}),
    };
  };

  const saveMutation = useMutation({
    mutationFn: async (statusOverride?: string) => {
      if (!effectiveTenant || !workspaceId) throw new Error('Select a workspace first');
      if (!content.trim()) throw new Error('Post content is required');
      const body = buildBody(statusOverride);
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
      toast.success('Saved');
      setStatusMsg('');
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setStatusMsg(e.message);
    },
  });

  const togglePlatform = (p: string) => {
    if (!connectedPlatforms.has(p)) return;
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const handleGenerate = async () => {
    if (!effectiveTenant || !workspaceId) {
      toast.error('Select a workspace first');
      return;
    }
    if (!theme.trim() && !content.trim()) {
      toast.error('Add a theme or some draft content');
      return;
    }
    setGenerating(true);
    try {
      const raw = await api.generateContent({
        theme: theme.trim() || undefined,
        draft: content.trim() || undefined,
        workspaceId,
        tenantId: effectiveTenant,
        contentType: 'content',
      });
      const result = (await resolveQueued(raw as any)) as {
        title?: string;
        content?: string;
        error?: string;
      };
      if (result?.error) throw new Error(result.error);
      if (result?.content) setContent(result.content);
      if (result?.title) setTitle(result.title);
      if (!result?.content && theme.trim() && !content.trim()) {
        setContent(theme.trim());
        if (!title.trim()) setTitle(theme.slice(0, 80));
      }
      toast.success('Content generated');
    } catch (e: any) {
      toast.error(e.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo library',
        'Photo library access is required to attach images. Enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setLocalImage(result.assets[0].uri);
    }
  };

  const uploadAndAttach = async (contentId: string) => {
    if (!effectiveTenant) return;
    if (libraryPick) {
      await api.attachMedia(contentId, effectiveTenant, [
        {
          url: libraryPick.url,
          type: libraryPick.type || 'image',
          assetId: libraryPick.assetId,
        },
      ]);
      setLibraryPick(null);
      return;
    }
    if (!localImage) return;
    const uploaded = await api.uploadMedia(localImage, effectiveTenant, workspaceId, contentId);
    const url = uploaded?.url || uploaded?.asset?.url || uploaded?.data?.url;
    const assetId = uploaded?.id || uploaded?.asset?.id;
    if (url) {
      await api.attachMedia(contentId, effectiveTenant, [{ url, type: 'image', assetId }]);
    }
  };

  const handleSave = async () => {
    if (!permissionsReady || !canMutate) {
      toast.error('You do not have permission to save this draft.');
      return;
    }
    setBusy(true);
    setStatusMsg('');
    try {
      const item = await saveMutation.mutateAsync(undefined);
      if ((localImage || libraryPick) && item?.id) {
        await uploadAndAttach(item.id);
        setLocalImage(null);
        setStatusMsg('');
        toast.success('Saved with media');
        invalidate();
      } else {
        toast.success('Saved');
      }
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
      setStatusMsg(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSchedule = async () => {
    if (!permissionsReady || !canEdit || isNew) return;
    setBusy(true);
    setStatusMsg('');
    try {
      setScheduledDate('');
      setScheduledTime('');
      await api.updateContent(id!, {
        ...buildBody('draft'),
        scheduledDate: null,
        scheduledTime: null,
        status: 'draft',
      });
      toast.success('Schedule cancelled');
      setStatusMsg('');
      invalidate();
    } catch (e: any) {
      toast.error(e.message || 'Could not cancel schedule');
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!permissionsReady || !canPublish) {
      toast.error('You do not have permission to publish.');
      return;
    }
    if (!connectedPlatforms.size) {
      toast.error('Connect a social account before publishing.');
      router.push('/connections' as any);
      return;
    }
    const publishable = platforms.filter((p) => connectedPlatforms.has(p));
    if (!publishable.length) {
      toast.error('Select at least one connected platform.');
      router.push('/connections' as any);
      return;
    }
    setBusy(true);
    setStatusMsg('');
    try {
      // Always persist edits before publish (existing drafts included).
      const item = await saveMutation.mutateAsync(undefined);
      let contentId = item?.id || id;
      if ((localImage || libraryPick) && contentId) {
        await uploadAndAttach(contentId);
        setLocalImage(null);
      }
      const result = await api.publishContent(contentId!, publishable);
      const results = result?.results;
      if (results) {
        const failed = Object.values(results).some((v: any) => !v?.published);
        const lines = Object.entries(results)
          .map(([k, v]: [string, any]) => `${k}: ${v.published ? 'ok' : v.message || 'failed'}`)
          .join('\n');
        if (failed) toast.error(lines || 'Some platforms failed to publish');
        else toast.success('Published');
        setStatusMsg(lines || result?.message || '');
      } else {
        toast.success(result?.message || (result?.queued ? 'Queued for publish' : 'Published'));
        setStatusMsg('');
      }
      invalidate();
    } catch (e: any) {
      toast.error(e.message || 'Publish failed');
      setStatusMsg(e.message || 'Publish failed');
    } finally {
      setBusy(false);
    }
  };

  if (!workspaceId) {
    return (
      <View style={styles.center}>
        <Text style={[styles.meta, { color: colors.mute }]}>Select a workspace on Home first.</Text>
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
    <ScrollView style={[styles.container, { backgroundColor: colors['canvas-soft'] }]} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={[styles.label, { color: colors.mute }]}>Campaign theme</Text>
      <FormFieldAi
        form="content"
        tenantId={effectiveTenant}
        fieldKey="theme"
        value={theme}
        onChange={setTheme}
        placeholder="e.g. Summer sale, product launch, weekly tip…"
        editable={canMutate}
      />
      <Text style={[styles.label, { color: colors.mute }]}>Title</Text>
      <FormFieldAi
        form="content"
        tenantId={effectiveTenant}
        fieldKey="title"
        value={title}
        onChange={setTitle}
        placeholder="Post headline"
        editable={canMutate}
      />
      <Text style={[styles.label, { color: colors.mute }]}>Content</Text>
      <Input
        placeholder="Write your post…"
        value={content}
        onChangeText={setContent}
        multiline
        editable={canMutate}
        style={[styles.field, styles.body]}
      />

      {canMutate ? (
        <Button
          label="Generate with AI"
          variant="outline"
          onPress={() => void handleGenerate()}
          loading={generating}
          disabled={generating || busy}
          style={styles.field}
        />
      ) : null}

      <Text style={[styles.label, { color: colors.mute }]}>Platforms (connected only)</Text>
      {!connectedPlatforms.size ? (
        <Text style={[styles.meta, { color: colors.mute }]}>
          No connected accounts. Open Connections to link a network before publishing.
        </Text>
      ) : null}
      <View style={styles.row}>
        {PLATFORM_OPTIONS.map((p) => {
          const connected = connectedPlatforms.has(p);
          const on = platforms.includes(p);
          return (
            <Chip
              key={p}
              label={p}
              selected={on}
              disabled={!connected || !canMutate}
              onPress={() => togglePlatform(p)}
            />
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.mute }]}>Schedule (optional YYYY-MM-DD)</Text>
      <Input
        placeholder="2026-09-01"
        value={scheduledDate}
        onChangeText={setScheduledDate}
        editable={canMutate}
        style={styles.field}
      />
      <Input
        placeholder="09:00"
        value={scheduledTime}
        onChangeText={setScheduledTime}
        editable={canMutate}
        style={styles.field}
      />

      {!isNew && scheduledDate ? (
        <Button
          label="Cancel schedule"
          variant="outline"
          onPress={() => void handleCancelSchedule()}
          disabled={busy || !canEdit}
          style={styles.field}
        />
      ) : null}

      {canMutate ? (
        <>
          <Button
            label={localImage ? 'Change device image' : 'Add from device'}
            variant="outline"
            onPress={() => void pickImage()}
            style={styles.field}
          />
          <Button
            label={libraryPick ? 'Change library image' : 'Add from media library'}
            variant="outline"
            onPress={() => setLibraryOpen(true)}
            style={styles.field}
          />
        </>
      ) : null}
      {localImage ? <Image source={{ uri: localImage }} style={styles.preview} /> : null}
      {libraryPick?.url ? (
        <Image source={{ uri: libraryPick.url }} style={styles.preview} />
      ) : null}
      {existingMedia.map((m, i) =>
        m.url ? (
          <Image key={m.id || m.url || String(i)} source={{ uri: m.url }} style={styles.preview} />
        ) : null,
      )}

      {statusMsg ? <Text style={[styles.status, { color: colors.body }]}>{statusMsg}</Text> : null}

      {!permissionsReady ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
      ) : (
        <>
          {canMutate ? (
            <Button
              label="Save draft"
              onPress={() => void handleSave()}
              loading={busy}
              disabled={busy}
              style={styles.field}
            />
          ) : (
            <Text style={[styles.meta, { color: colors.mute }]}>Editing disabled for your role.</Text>
          )}

          {canPublish ? (
            <Button
              label="Publish now"
              onPress={() => void handlePublish()}
              loading={busy}
              disabled={busy || !connectedPlatforms.size}
              style={styles.publishBtn}
            />
          ) : (
            <Text style={[styles.meta, { color: colors.mute }]}>Publish disabled for your role.</Text>
          )}
        </>
      )}

      <Sheet visible={libraryOpen} onClose={() => setLibraryOpen(false)} title="Media library">
        {libraryLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : (libraryMedia as Array<{ id?: string; url?: string; name?: string; type?: string }>).length ? (
          (libraryMedia as Array<{ id?: string; url?: string; name?: string; type?: string }>).map((item) => (
            <SheetRow
              key={item.id || item.url}
              label={item.name || item.type || 'Asset'}
              subtitle={item.url}
              selected={libraryPick?.url === item.url}
              onPress={() => {
                if (!item.url) return;
                setLibraryPick({ url: item.url, assetId: item.id, type: item.type || 'image' });
                setLocalImage(null);
                setLibraryOpen(false);
              }}
            />
          ))
        ) : (
          <Text style={[styles.meta, { color: colors.mute }]}>No media in library yet.</Text>
        )}
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  field: { marginBottom: spacing.md },
  body: { minHeight: 140, textAlignVertical: 'top' },
  label: {
    ...typography.bodySmStrong,
    fontFamily: fonts.bodySemi,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  publishBtn: { marginBottom: spacing['2xl'] },
  preview: { width: '100%', height: 180, borderRadius: rounded.lg, marginBottom: spacing.md },
  status: { ...typography.bodySm, fontFamily: fonts.body, marginBottom: spacing.md },
  meta: {
    ...typography.bodySm,
    fontFamily: fonts.body,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
