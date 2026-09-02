import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { fonts, spacing, typography } from '../../src/theme';
import { Button, Card, Input } from '../../src/components/ui';
import { api } from '../../src/lib/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.forgotPassword(trimmed);
      setSent(true);
    } catch (e: any) {
      setError(e.message || 'Request failed');
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
          <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>
            Reset password
          </Text>
          <Text style={[styles.subtitle, { color: colors.mute, fontFamily: fonts.body }]}>
            {sent
              ? 'If an account exists for that email, we sent reset instructions.'
              : 'Enter your email and we will send reset instructions if an account exists.'}
          </Text>

          {error ? (
            <Text style={[styles.errorText, { color: colors.negative, fontFamily: fonts.bodySemi }]}>
              {error}
            </Text>
          ) : null}

          {!sent ? (
            <>
              <Input
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.field}
              />
              <Button label="Send reset link" onPress={() => void handleSubmit()} loading={loading} style={styles.field} />
            </>
          ) : null}

          <Button
            label="Back to log in"
            variant="ghost"
            onPress={() => router.replace('/(auth)/login' as any)}
            disabled={loading}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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
  errorText: {
    ...typography.bodySmStrong,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
