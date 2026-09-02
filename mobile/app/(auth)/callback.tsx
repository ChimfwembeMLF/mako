import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { colors, fonts, spacing, typography } from '../../src/theme';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const router = useRouter();
  const { signIn } = useAuth();
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const err = typeof params.error === 'string' ? params.error : undefined;
      if (err) {
        if (!cancelled) {
          setMessage(decodeURIComponent(err));
          setTimeout(() => router.replace('/(auth)/login'), 2500);
        }
        return;
      }

      const token = typeof params.token === 'string' ? params.token : undefined;
      if (!token) {
        if (!cancelled) {
          setMessage('Missing sign-in token');
          setTimeout(() => router.replace('/(auth)/login'), 2500);
        }
        return;
      }

      try {
        await signIn({ token });
        if (!cancelled) router.replace('/(tabs)');
      } catch (e: any) {
        if (!cancelled) {
          setMessage(e.message || 'Sign-in failed');
          setTimeout(() => router.replace('/(auth)/login'), 2500);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handle this redirect once
  }, []);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.meta}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors['canvas-soft'],
    padding: spacing.xl,
  },
  meta: {
    ...typography.bodyMd,
    fontFamily: fonts.body,
    color: colors.mute,
    textAlign: 'center',
  },
});
