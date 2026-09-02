import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts, rounded, spacing, typography } from '../../theme';

type Tone = 'default' | 'positive' | 'warning' | 'muted' | 'scheduled';

type Props = {
  label: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, tone = 'default', style }: Props) {
  const { colors, isDark } = useTheme();

  const bg =
    tone === 'positive'
      ? colors['primary-pale']
      : tone === 'warning'
        ? isDark
          ? '#4a3b1c'
          : '#FFF4CC'
        : tone === 'muted'
          ? colors['canvas-soft']
          : tone === 'scheduled'
            ? isDark
              ? '#1a2a44'
              : '#E7F0FF'
            : colors['primary-pale'];

  const textColor =
    tone === 'positive'
      ? colors['positive-deep']
      : tone === 'warning'
        ? colors['warning-deep']
        : tone === 'muted'
          ? colors.body
          : tone === 'scheduled'
            ? isDark
              ? '#7eb8ff'
              : '#1877F2'
            : colors['positive-deep'];

  return (
    <View style={[styles.base, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: rounded.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    ...typography.caption,
    fontFamily: fonts.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
