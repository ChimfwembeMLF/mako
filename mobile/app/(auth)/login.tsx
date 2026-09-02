import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { normalizeAuthResponse, useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/lib/api';
import { fonts, spacing, typography } from '../../src/theme';
import { Button, Card, Input } from '../../src/components/ui';
import { GoogleAuthButton, type GoogleAuthSuccess } from '../../src/hooks/useGoogleAuth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const handleGoogleLogin = async (result: GoogleAuthSuccess) => {
    setLoading(true);
    setError('');
    try {
      if (result.kind === 'jwt') {
        await signIn({ token: result.token });
        return;
      }
      const apiResponse = await api.googleAuth(result.token);
      const payload = normalizeAuthResponse(apiResponse);
      if (payload) {
        await signIn(payload);
      } else {
        setError('Login failed: invalid response from server');
      }
    } catch (e: any) {
      setError(e.message || 'Google Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await api.login(email, password);
      const payload = normalizeAuthResponse(response);
      if (payload) {
        await signIn(payload);
      } else {
        setError('Login failed: invalid response from server');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['canvas-soft'] }]}>
      <View style={styles.container}>
        <Card style={styles.card}>
          <Image
            source={require('../../assets/images/mako-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: colors.mute, fontFamily: fonts.body }]}>
            Sign in to your Mako workspace
          </Text>

          {error ? (
            <Text style={[styles.errorText, { color: colors.negative, fontFamily: fonts.bodySemi }]}>{error}</Text>
          ) : null}

          <Input
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.field}
          />

          <Input
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.field}
          />

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password' as any)}
            disabled={loading}
            style={styles.forgotLink}
          >
            <Text style={[styles.forgotText, { color: colors.mute, fontFamily: fonts.bodySemi }]}>
              Forgot password?
            </Text>
          </Pressable>

          <Button label="Log in" onPress={handleLogin} loading={loading} style={styles.field} />

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mute }]}>OR</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          <GoogleAuthButton
            label="Continue with Google"
            onSuccess={(result) => void handleGoogleLogin(result)}
            onError={setError}
            loading={loading}
            disabled={loading}
            style={styles.field}
          />

          <Button
            label="Don't have an account? Sign up"
            variant="ghost"
            onPress={() => router.push('/(auth)/signup' as any)}
            disabled={loading}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    alignItems: 'stretch',
    padding: spacing.xl,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.displayXs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodySm,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.md,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  forgotText: {
    ...typography.bodySmStrong,
  },
  errorText: {
    ...typography.bodySmStrong,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    ...typography.bodySm,
  },
});
