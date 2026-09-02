import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInputProps,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts, rounded, spacing, typography } from '../../theme';
import { Input } from './Input';

type AiInputProps = TextInputProps & {
  onEnhance?: () => void | Promise<void>;
  enhancing?: boolean;
  multiline?: boolean;
};

export function AiInput({
  onEnhance,
  enhancing = false,
  multiline,
  style,
  editable = true,
  ...props
}: AiInputProps) {
  const { colors } = useTheme();
  const showEnhance = Boolean(onEnhance && editable);

  return (
    <View style={styles.wrap}>
      <Input
        {...props}
        editable={editable}
        multiline={multiline}
        style={[showEnhance && styles.inputWithButton, style]}
      />
      {showEnhance ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.value?.toString().trim() ? 'Enhance with AI' : 'Generate with AI'}
          onPress={() => void onEnhance?.()}
          disabled={enhancing}
          style={[styles.enhanceBtn, multiline ? styles.enhanceBtnMultiline : styles.enhanceBtnSingle]}
        >
          {enhancing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.sparkle, { color: colors.primary }]}>✨</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

type SuggestionCarouselProps = {
  suggestions: string[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onApply: (text: string) => void;
  onInteract?: () => void;
  isLive?: boolean;
};

function previewLine(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}

export function SuggestionCarousel({
  suggestions,
  selectedIndex,
  onSelectIndex,
  onApply,
  onInteract,
  isLive,
}: SuggestionCarouselProps) {
  const { colors } = useTheme();

  if (suggestions.length === 0) return null;

  const safeIndex = selectedIndex % suggestions.length;
  const current = suggestions[safeIndex]!;

  return (
    <View style={[styles.carousel, { borderColor: colors.border, backgroundColor: colors['canvas-soft'] }]}>
      <View style={[styles.carouselHeader, { borderBottomColor: colors.border, backgroundColor: colors.canvas }]}>
        <Text style={[styles.carouselLabel, { color: colors.mute, fontFamily: fonts.bodySemi }]}>
          ✨ AI suggestions{isLive ? ' · live' : ''}
        </Text>
        <Text style={[styles.carouselCount, { color: colors.mute, fontFamily: fonts.body }]}>
          {safeIndex + 1} / {suggestions.length}
        </Text>
      </View>

      <Pressable
        onPress={() => {
          onInteract?.();
          onApply(current);
        }}
        style={[styles.suggestionCard, { borderColor: colors['primary-pale'], backgroundColor: colors.canvas }]}
      >
        <Text style={[styles.suggestionText, { color: colors.ink, fontFamily: fonts.body }]} numberOfLines={4}>
          {current}
        </Text>
        <Text style={[styles.tapHint, { color: colors.primary, fontFamily: fonts.bodySemi }]}>Tap to use</Text>
      </Pressable>

      {suggestions.length > 1 ? (
        <>
          <View style={styles.navRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous suggestion"
              onPress={() => {
                onInteract?.();
                onSelectIndex((safeIndex - 1 + suggestions.length) % suggestions.length);
              }}
              style={[styles.navBtn, { borderColor: colors.border, backgroundColor: colors.canvas }]}
            >
              <Text style={{ color: colors.ink }}>‹</Text>
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dotsRow}>
              {suggestions.map((text, index) => (
                <Pressable
                  key={index}
                  onPress={() => {
                    onInteract?.();
                    onSelectIndex(index);
                  }}
                  style={[
                    styles.dotChip,
                    {
                      borderColor: index === safeIndex ? colors.primary : colors.border,
                      backgroundColor: index === safeIndex ? colors['primary-pale'] : colors.canvas,
                    },
                  ]}
                >
                  <Text
                    style={[styles.dotChipText, { color: colors.mute, fontFamily: fonts.body }]}
                    numberOfLines={1}
                  >
                    {previewLine(text, 28)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next suggestion"
              onPress={() => {
                onInteract?.();
                onSelectIndex((safeIndex + 1) % suggestions.length);
              }}
              style={[styles.navBtn, { borderColor: colors.border, backgroundColor: colors.canvas }]}
            >
              <Text style={{ color: colors.ink }}>›</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => onApply(current)}
            style={[styles.useBtn, { backgroundColor: colors['primary-pale'] }]}
          >
            <Text style={[styles.useBtnText, { color: colors['positive-deep'], fontFamily: fonts.bodySemi }]}>
              ✨ Use suggestion {safeIndex + 1}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  inputWithButton: { paddingRight: spacing['3xl'] },
  enhanceBtn: {
    position: 'absolute',
    right: spacing.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rounded.md,
  },
  enhanceBtnSingle: { top: '50%', marginTop: -18 },
  enhanceBtnMultiline: { top: spacing.sm },
  sparkle: { fontSize: 18 },
  carousel: {
    borderWidth: 1,
    borderRadius: rounded.lg,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  carouselLabel: { ...typography.caption, textTransform: 'uppercase', letterSpacing: 0.4 },
  carouselCount: { ...typography.caption },
  suggestionCard: {
    margin: spacing.sm,
    borderWidth: 1,
    borderRadius: rounded.md,
    padding: spacing.md,
  },
  suggestionText: { ...typography.bodySm, lineHeight: 20 },
  tapHint: { ...typography.caption, marginTop: spacing.sm },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: rounded.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: { gap: spacing.xs, paddingHorizontal: spacing.xxs },
  dotChip: {
    maxWidth: 120,
    borderWidth: 1,
    borderRadius: rounded.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  dotChipText: { ...typography.caption },
  useBtn: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: rounded.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  useBtnText: { ...typography.bodySm },
});
