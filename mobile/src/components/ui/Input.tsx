import React from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts, rounded, shadows, spacing, typography } from '../../theme';

export function Input(props: TextInputProps) {
  const { colors } = useTheme();

  return (
    <TextInput
      placeholderTextColor={colors.mute}
      {...props}
      style={[
        {
          backgroundColor: colors.canvas,
          color: colors.ink,
          borderColor: colors.border,
          borderWidth: 1,
          // Pill for single-line fields; a full radius would clip multi-line text
          borderRadius: props.multiline ? rounded.lg : rounded.full,
          paddingHorizontal: 20,
          paddingVertical: spacing.md,
          ...typography.bodySm,
          fontFamily: fonts.bodyMedium,
          minHeight: 48,
          ...shadows.softCard,
        },
        props.style,
      ]}
    />
  );
}
