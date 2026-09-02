import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts, rounded, spacing, typography } from '../../theme';

type Props = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected, disabled, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[
        styles.chip,
        {
          borderColor: colors.ink,
          backgroundColor: selected ? colors.primary : colors.canvas,
        },
        selected && { borderColor: colors.primary },
        disabled && styles.chipDisabled,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: selected ? colors['on-primary'] : colors.ink },
          disabled && { color: colors.mute },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: rounded.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipDisabled: {
    opacity: 0.35,
  },
  text: {
    ...typography.bodySmStrong,
    fontFamily: fonts.bodySemi,
  },
});
