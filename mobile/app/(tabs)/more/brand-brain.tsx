import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useTheme } from '../../../src/context/ThemeContext';
import {
  BRAND_BRAIN_SECTIONS,
  BRAND_TYPE_OPTIONS,
  brandDataFromApi,
  brandDataToApi,
  brandProfileCompletion,
  initialBrandData,
  type BrandData,
} from '../../../src/constants/brandBrain';
import { fonts, rounded, spacing, typography } from '../../../src/theme';
import {
  Badge,
  Button,
  Chip,
  FormFieldAi,
  Input,
  PageHeader,
  Screen,
  useToast,
} from '../../../src/components/ui';

export default function BrandBrainScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { activeWorkspace, tenantId } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;

  const [activeSection, setActiveSection] = useState(BRAND_BRAIN_SECTIONS[0].id);
  const [data, setData] = useState<BrandData>(initialBrandData);

  const { isLoading } = useQuery({
    queryKey: ['brand-profile', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant),
    queryFn: async () => {
      try {
        const row = await api.getBrandProfileMine(effectiveTenant!, workspaceId);
        setData(brandDataFromApi(row ?? undefined));
        return row;
      } catch {
        setData(initialBrandData);
        return null;
      }
    },
  });

  const completion = useMemo(() => brandProfileCompletion(data), [data]);
  const section = BRAND_BRAIN_SECTIONS.find((s) => s.id === activeSection) ?? BRAND_BRAIN_SECTIONS[0];

  const setField = (key: keyof BrandData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const save = useMutation({
    mutationFn: () => {
      if (!effectiveTenant) throw new Error('No workspace selected');
      return api.saveBrandProfile(effectiveTenant, workspaceId, brandDataToApi(data));
    },
    onSuccess: () => {
      toast.success('Brand profile saved');
      void queryClient.invalidateQueries({ queryKey: ['brand-profile', effectiveTenant, workspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!effectiveTenant) {
    return (
      <Screen empty emptyTitle="No workspace" emptyMessage="Select a workspace from the header." />
    );
  }

  if (isLoading) return <Screen loading skeleton />;

  return (
    <Screen>
      <PageHeader
        title="Brand Brain"
        subtitle="Train AI on your brand voice, audience, and guardrails."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>🧠</Text>}
        actions={<Button label="Save" loading={save.isPending} onPress={() => void save.mutate()} />}
      />

      <View style={[styles.progressCard, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
        <View style={styles.progressRow}>
          <Text style={[styles.progressLabel, { color: colors.mute, fontFamily: fonts.bodySemi }]}>
            Profile completion
          </Text>
          <Badge label={`${completion}%`} tone={completion >= 70 ? 'positive' : 'muted'} />
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors['canvas-soft'] }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${completion}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
      </View>

      <Text style={[styles.fieldLabel, { color: colors.mute, fontFamily: fonts.bodySemi }]}>
        Brand profile type
      </Text>
      <View style={styles.chipRow}>
        {BRAND_TYPE_OPTIONS.map((opt) => (
          <Chip
            key={opt.id}
            label={opt.label}
            selected={data.brandType === opt.id}
            onPress={() => setField('brandType', opt.id)}
          />
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sectionRow}
        style={styles.sectionScroll}
      >
        {BRAND_BRAIN_SECTIONS.map((s) => (
          <Chip
            key={s.id}
            label={s.label}
            selected={activeSection === s.id}
            onPress={() => setActiveSection(s.id)}
          />
        ))}
      </ScrollView>

      {section.fields.map((field) => (
        <View key={field.key}>
          <Text style={[styles.fieldLabel, { color: colors.mute, fontFamily: fonts.bodySemi }]}>
            {field.label}
          </Text>
          {field.ai !== false ? (
            <FormFieldAi
              form="brand-brain"
              tenantId={effectiveTenant}
              fieldKey={field.key}
              value={data[field.key]}
              onChange={(v) => setField(field.key, v)}
              multiline={field.multiline}
              placeholder={field.placeholder}
            />
          ) : (
            <Input
              value={data[field.key]}
              onChangeText={(v) => setField(field.key, v)}
              multiline={field.multiline}
              placeholder={field.placeholder}
              style={field.multiline ? styles.textarea : undefined}
            />
          )}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressLabel: { ...typography.bodySmStrong },
  progressTrack: {
    height: 6,
    borderRadius: rounded.pill,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: rounded.pill },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionScroll: { marginBottom: spacing.md },
  sectionRow: { gap: spacing.sm, paddingRight: spacing.lg },
  fieldLabel: { ...typography.bodySmStrong, marginBottom: spacing.xs, marginTop: spacing.sm },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
});
