import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts, spacing, typography } from '../../theme';

type Props = {
  message?: string;
};

export function AppLogoLoader({ message }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.center}>
      <Image
        source={require('../../../assets/images/mako-logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Mako"
      />
      {message ? (
        <Text style={[styles.message, { color: colors.mute, fontFamily: fonts.body }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  logo: {
    width: 112,
    height: 112,
  },
  message: {
    ...typography.bodyMd,
    textAlign: 'center',
  },
});
