import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { rounded, shadows } from '../../theme';
import { Icon } from './Icon';

/** Where to land when there is no history, e.g. the screen was opened from a deep link. */
function fallbackRoute(pathname: string) {
  if (pathname.startsWith('/content')) return '/content';
  if (pathname.startsWith('/inbox')) return '/inbox';
  return '/more';
}

export function BackButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackRoute(pathname) as any))}
      style={[styles.button, { backgroundColor: colors.canvas, borderColor: colors.border }, style]}
    >
      <Icon name="chevronLeft" size={20} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: rounded.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.softCard,
  },
});
