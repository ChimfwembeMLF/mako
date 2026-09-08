import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useTenantTheme } from '../../store/themeStore';
import { fonts, rounded, spacing, typography } from '../../theme';

type Variant = 'primary' | 'outline' | 'ghost' | 'destructive' | 'inverse';

type Props = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const { theme } = useTenantTheme();
  const isDisabled = disabled || loading;
  
  const primaryColor = theme.primaryColor || colors.primary;

  const variantStyle: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: primaryColor }
      : variant === 'outline'
        ? { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.ink }
        : variant === 'ghost'
          ? { backgroundColor: 'transparent' }
          : variant === 'inverse'
            ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }
            : { backgroundColor: colors.negative };

  const labelColor =
    variant === 'primary'
      ? colors['on-primary']
      : variant === 'inverse' || variant === 'destructive'
        ? colors.canvas
        : colors.ink;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text style={[styles.label, { color: labelColor }]} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: rounded.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    ...typography.buttonMd,
    fontFamily: fonts.bodySemi,
  },
});
