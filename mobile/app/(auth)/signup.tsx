import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { normalizeAuthResponse, useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/lib/api';
import { fonts, spacing, typography } from '../../src/theme';
import { Button, Card, Input } from '../../src/components/ui';
import { GoogleAuthButton, type GoogleAuthSuccess } from '../../src/hooks/useGoogleAuth';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const handleGoogleSignup = async (result: GoogleAuthSuccess) => {
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
        setError('Signup failed: invalid response from server');
      }
    } catch (e: any) {
      setError(e.message || 'Google Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!email || !password || !firstName || !lastName) {
      setError('Please fill out all fields');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await api.signup(email, password, firstName, lastName);
      const payload = normalizeAuthResponse(response);
      if (payload) {
        await signIn(payload);
      } else {
        setError('Signup failed: invalid response from server');
      }
    } catch (e: any) {
      setError(e.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['canvas-soft'] }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Image
            source={require('../../assets/images/mako-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.mute, fontFamily: fonts.body }]}>
            Start your Mako social workspace
          </Text>

          {error ? (
            <Text style={[styles.errorText, { color: colors.negative, fontFamily: fonts.bodySemi }]}>{error}</Text>
          ) : null}

          <Input placeholder="First name" value={firstName} onChangeText={setFirstName} style={styles.field} />
          <Input placeholder="Last name" value={lastName} onChangeText={setLastName} style={styles.field} />
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

          <Button label="Sign up" onPress={handleSignup} loading={loading} style={styles.field} />

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mute }]}>OR</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          <GoogleAuthButton
            label="Sign up with Google"
            onSuccess={(result) => void handleGoogleSignup(result)}
            onError={setError}
            loading={loading}
            disabled={loading}
            style={styles.field}
          />

          <Button
            label="Already have an account? Log in"
            variant="ghost"
            onPress={() => router.push('/(auth)/login' as any)}
            disabled={loading}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: { alignItems: 'stretch', padding: spacing.xl },
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
  field: { marginBottom: spacing.md },
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
  divider: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: spacing.md, ...typography.bodySm },
});
