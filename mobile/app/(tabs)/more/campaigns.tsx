import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ContentCampaign } from '../../../src/lib/api';
import { PLATFORMS } from '../../../src/constants/platforms';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { fonts, rounded, spacing, typography } from '../../../src/theme';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  FormFieldAi,
  Input,
  PageHeader,
  Screen,
  Sheet,
  useToast,
} from '../../../src/components/ui';

const POST_COUNT_OPTIONS = ['3', '5', '7', '10', '14'];
const DEFAULT_PLATFORMS = ['linkedin', 'facebook', 'instagram'];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDate(value?: string): string {
  if (!value) return '';
  return String(value).split('T')[0];
}

export default function CampaignsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeWorkspace, tenantId } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('');
  const [goal, setGoal] = useState('');
  const [postCount, setPostCount] = useState('7');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [platforms, setPlatforms] = useState<string[]>(DEFAULT_PLATFORMS);

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['campaigns', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant && workspaceId),
    queryFn: () => api.listCampaigns(effectiveTenant!, workspaceId),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['campaign', selectedId, effectiveTenant],
    enabled: Boolean(selectedId && effectiveTenant),
    queryFn: () => api.getCampaign(selectedId!, effectiveTenant!),
  });

  const generate = useMutation({
    mutationFn: () => {
      if (!effectiveTenant || !workspaceId) throw new Error('Select a workspace first');
      if (!theme.trim()) throw new Error('Enter a campaign theme');
      return api.generateCampaign({
        tenantId: effectiveTenant,
        workspaceId,
        theme: theme.trim(),
        name: name.trim() || undefined,
        goal: goal.trim() || undefined,
        platforms,
        postCount: parseInt(postCount, 10),
        startDate,
      });
    },
    onSuccess: (result) => {
      const count = result.posts?.length ?? 0;
      toast.success(`Campaign generated — ${count} posts scheduled`);
      setTheme('');
      setGoal('');
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['campaigns', effectiveTenant, workspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => {
      if (!effectiveTenant) throw new Error('No workspace');
      return api.deleteCampaign(id, effectiveTenant);
    },
    onSuccess: () => {
      toast.success('Campaign deleted');
      setSelectedId(null);
      void queryClient.invalidateQueries({ queryKey: ['campaigns', effectiveTenant, workspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePlatform = (id: string) => {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  if (!effectiveTenant || !workspaceId) {
    return <Screen empty emptyTitle="No workspace" emptyMessage="Select a workspace from the header." />;
  }
  if (isLoading) return <Screen loading skeleton />;

  const campaign = detail?.campaign;
  const posts = detail?.posts ?? [];

  return (
    <Screen>
      <PageHeader
        title="AI Campaigns"
        subtitle="Generate a multi-day content series from one theme."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>📣</Text>}
      />

      <View style={[styles.generateCard, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
          Create campaign
        </Text>
        <Text style={[styles.cardHint, { color: colors.mute, fontFamily: fonts.body }]}>
          AI plans posts across days and platforms using your Brand Brain.
        </Text>

        <Text style={[styles.fieldLabel, { color: colors.mute, fontFamily: fonts.bodySemi }]}>
          Campaign name
        </Text>
        <FormFieldAi
          form="campaign"
          tenantId={effectiveTenant}
          fieldKey="name"
          value={name}
          onChange={setName}
          placeholder="e.g. Summer Product Launch"
        />

        <Text style={[styles.fieldLabel, { color: colors.mute, fontFamily: fonts.bodySemi }]}>
          Campaign theme *
        </Text>
        <FormFieldAi
          form="campaign"
          tenantId={effectiveTenant}
          fieldKey="theme"
          value={theme}
          onChange={setTheme}
          multiline
          placeholder="What is this campaign about?"
        />

        <Text style={[styles.fieldLabel, { color: colors.mute, fontFamily: fonts.bodySemi }]}>Goal</Text>
        <FormFieldAi
          form="campaign"
          tenantId={effectiveTenant}
          fieldKey="goal"
          value={goal}
          onChange={setGoal}
          placeholder="Drive sign-ups, build awareness…"
        />

        <Text style={[styles.fieldLabel, { color: colors.mute, fontFamily: fonts.bodySemi }]}>
          Number of posts
        </Text>
        <View style={styles.chipRow}>
          {POST_COUNT_OPTIONS.map((n) => (
            <Chip
              key={n}
              label={`${n} posts`}
              selected={postCount === n}
              onPress={() => setPostCount(n)}
            />
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.mute, fontFamily: fonts.bodySemi }]}>
          Start date (YYYY-MM-DD)
        </Text>
        <Input value={startDate} onChangeText={setStartDate} placeholder="2026-09-01" />

        <Text style={[styles.fieldLabel, { color: colors.mute, fontFamily: fonts.bodySemi }]}>
          Platforms
        </Text>
        <View style={styles.chipRow}>
          {PLATFORMS.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              selected={platforms.includes(p.id)}
              onPress={() => togglePlatform(p.id)}
            />
          ))}
        </View>

        <Button
          label="Generate AI campaign"
          onPress={() => void generate.mutate()}
          loading={generate.isPending}
          disabled={!theme.trim() || generate.isPending}
          style={styles.generateBtn}
        />
      </View>

      <View style={styles.listHeader}>
        <Text style={[styles.listTitle, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
          Your campaigns
        </Text>
        <Text style={[styles.listCount, { color: colors.mute, fontFamily: fonts.body }]}>
          {data.length} total
        </Text>
      </View>

      <FlatList
        data={data as ContentCampaign[]}
        scrollEnabled={false}
        refreshing={isLoading}
        onRefresh={() => void refetch()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => setSelectedId(item.id)}>
            <View style={styles.cardTop}>
              <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
                {item.name || 'Campaign'}
              </Text>
              <View style={styles.badges}>
                {item.status ? <Badge label={item.status} tone="muted" /> : null}
                {item.postCount != null ? (
                  <Badge label={`${item.postCount} posts`} tone="muted" />
                ) : null}
              </View>
            </View>
            {item.theme ? (
              <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]} numberOfLines={1}>
                {item.theme}
              </Text>
            ) : null}
            {item.summary ? (
              <Text style={[styles.summary, { color: colors.body, fontFamily: fonts.body }]} numberOfLines={2}>
                {item.summary}
              </Text>
            ) : null}
            <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>
              {item.startDate ? `Starts ${formatDate(item.startDate)} · ` : ''}
              {item.created_at ? formatDate(item.created_at) : ''}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No campaigns yet"
            description="Fill in the form above and generate your first AI campaign."
          />
        }
      />

      <Sheet visible={Boolean(selectedId)} onClose={() => setSelectedId(null)} title="Campaign detail">
        {detailLoading ? (
          <Text style={{ color: colors.mute }}>Loading…</Text>
        ) : campaign ? (
          <>
            <Text style={[styles.detailTitle, { color: colors.ink, fontFamily: fonts.displaySemi }]}>
              {campaign.name || 'Campaign'}
            </Text>
            {campaign.theme ? (
              <Text style={[styles.detailMeta, { color: colors.mute, fontFamily: fonts.body }]}>
                Theme: {campaign.theme}
              </Text>
            ) : null}
            {campaign.goal ? (
              <Text style={[styles.detailMeta, { color: colors.mute, fontFamily: fonts.body }]}>
                Goal: {campaign.goal}
              </Text>
            ) : null}
            {campaign.summary ? (
              <Text style={[styles.detailBody, { color: colors.body, fontFamily: fonts.body }]}>
                {campaign.summary}
              </Text>
            ) : null}

            <Text style={[styles.postsHeading, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
              Scheduled posts ({posts.length})
            </Text>
            {posts.length === 0 ? (
              <Text style={[styles.detailMeta, { color: colors.mute }]}>No posts found.</Text>
            ) : (
              posts.map((post, index) => {
                const platform = Array.isArray(post.platforms) ? post.platforms[0] : undefined;
                return (
                  <View
                    key={post.id || String(index)}
                    style={[styles.postCard, { borderColor: colors.border, backgroundColor: colors['canvas-soft'] }]}
                  >
                    <Text style={[styles.postTitle, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
                      {post.title || 'Untitled'}
                    </Text>
                    <Text style={[styles.detailMeta, { color: colors.mute, fontFamily: fonts.body }]}>
                      {platform ? `${platform} · ` : ''}
                      {post.scheduledDate ? formatDate(post.scheduledDate) : 'Unscheduled'}
                    </Text>
                    {post.content ? (
                      <Text
                        style={[styles.postBody, { color: colors.body, fontFamily: fonts.body }]}
                        numberOfLines={3}
                      >
                        {stripHtml(String(post.content))}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}

            <Button
              label="View in Schedule"
              variant="outline"
              onPress={() => {
                setSelectedId(null);
                router.push('/(tabs)/schedule' as any);
              }}
              style={styles.sheetBtn}
            />
            <Button
              label="Delete campaign"
              variant="ghost"
              loading={remove.isPending}
              onPress={() => selectedId && void remove.mutate(selectedId)}
              style={styles.sheetBtn}
            />
          </>
        ) : (
          <Text style={{ color: colors.mute }}>Could not load campaign.</Text>
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  generateCard: {
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  cardTitle: { ...typography.bodyMdStrong },
  cardHint: { ...typography.bodySm, marginTop: spacing.xxs, marginBottom: spacing.md },
  fieldLabel: { ...typography.bodySmStrong, marginBottom: spacing.xs, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  generateBtn: { marginTop: spacing.md },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  listTitle: { ...typography.bodyMdStrong },
  listCount: { ...typography.caption },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  title: { ...typography.bodyMdStrong, flex: 1 },
  meta: { ...typography.caption, marginTop: spacing.xxs, textTransform: 'capitalize' },
  summary: { ...typography.bodySm, marginTop: spacing.xs },
  detailTitle: { ...typography.displayXs, marginBottom: spacing.sm },
  detailMeta: { ...typography.bodySm, marginBottom: spacing.xs },
  detailBody: { ...typography.bodyMd, marginBottom: spacing.md },
  postsHeading: { ...typography.bodySmStrong, marginTop: spacing.md, marginBottom: spacing.sm },
  postCard: {
    borderWidth: 1,
    borderRadius: rounded.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  postTitle: { ...typography.bodySmStrong },
  postBody: { ...typography.bodySm, marginTop: spacing.xs },
  sheetBtn: { marginTop: spacing.sm },
});
