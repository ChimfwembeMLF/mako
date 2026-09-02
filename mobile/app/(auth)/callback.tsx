import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { AppLogoLoader } from '../../src/components/ui/AppLogoLoader';
import { useTheme } from '../../src/context/ThemeContext';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const router = useRouter();
  const { signIn } = useAuth();
  const { colors } = useTheme();
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
    <View style={[styles.center, { backgroundColor: colors['canvas-soft'] }]}>
      <AppLogoLoader message={message} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
  },
});
