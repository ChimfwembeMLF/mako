import React from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts, rounded, spacing, typography } from '../../theme';

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
          borderColor: colors.ink,
          borderWidth: 1,
          borderRadius: rounded.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          ...typography.bodyMd,
          fontFamily: fonts.body,
          minHeight: 48,
        },
        props.style,
      ]}
    />
  );
}
