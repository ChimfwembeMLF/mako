import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { rounded, spacing } from '../../theme';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, onPress, selected, style }: Props) {
  const { colors } = useTheme();

  const content = (
    <View
      style={[
        {
          backgroundColor: colors.canvas,
          borderRadius: rounded.xl,
          padding: spacing.lg,
        },
        selected && { borderWidth: 2, borderColor: colors.primary },
        style,
      ]}
    >
      {children}
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

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.96,
  },
});
