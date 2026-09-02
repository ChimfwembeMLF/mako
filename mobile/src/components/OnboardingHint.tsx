import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../context/ThemeContext';
import { fonts, rounded, spacing, typography } from '../theme';

const STORAGE_KEY = 'mako_onboarding_dismissed';

async function readDismissed(): Promise<boolean> {
  try {
    const raw =
      Platform.OS === 'web'
        ? localStorage.getItem(STORAGE_KEY)
        : await SecureStore.getItemAsync(STORAGE_KEY);
    return raw === '1';
  } catch {
    return false;
  }
}

async function writeDismissed(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, '1');
      return;
    }
    await SecureStore.setItemAsync(STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}

export function OnboardingHint() {
  const router = useRouter();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void readDismissed().then((dismissed) => setVisible(!dismissed));
  }, []);

  if (!visible) return null;

  const close = () => {
    setVisible(false);
    void writeDismissed();
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors['primary-pale'],
          borderColor: colors['positive-deep'],
        },
      ]}
    >
      <Text style={[styles.title, { color: colors['positive-deep'], fontFamily: fonts.bodySemi }]}>
        Get started on mobile
      </Text>
      <Text style={[styles.body, { color: colors.body, fontFamily: fonts.body }]}>
        Connect a social account, then create your first post from Content or Home.
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/connections' as any)}
          style={[styles.cta, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.ctaText, { color: colors['on-primary'], fontFamily: fonts.bodySemi }]}>
            Connect accounts
          </Text>
        </Pressable>
        <Pressable onPress={close} style={styles.dismiss}>
          <Text style={[styles.dismissText, { color: colors.mute, fontFamily: fonts.bodySemi }]}>
            Dismiss
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: rounded.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.bodyMdStrong,
    marginBottom: spacing.xs,
  },
  body: {
    ...typography.bodySm,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  cta: {
    borderRadius: rounded.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  ctaText: {
    ...typography.bodySmStrong,
  },
  dismiss: {
    paddingVertical: spacing.sm,
  },
  dismissText: {
    ...typography.bodySmStrong,
  },
});
