import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../context/ThemeContext';
import { fonts, rounded, spacing, typography } from '../theme';
import { Icon } from './ui';

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

export type OnboardingStep = {
  label: string;
  done: boolean;
  onPress: () => void;
};

/** Setup checklist for new workspaces; disappears once every step is done. */
export function OnboardingHint({ steps }: { steps: OnboardingStep[] }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void readDismissed().then((dismissed) => setVisible(!dismissed));
  }, []);

  if (!visible || steps.every((step) => step.done)) return null;

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
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors['positive-deep'], fontFamily: fonts.bodySemi }]}>
          Get set up
        </Text>
        <Pressable onPress={close} style={styles.dismiss} accessibilityRole="button">
          <Text style={[styles.dismissText, { color: colors.body, fontFamily: fonts.bodySemi }]}>
            Dismiss
          </Text>
        </Pressable>
      </View>
      {steps.map((step) => (
        <Pressable
          key={step.label}
          onPress={step.onPress}
          disabled={step.done}
          style={styles.step}
          accessibilityRole="button"
          accessibilityState={{ checked: step.done, disabled: step.done }}
        >
          <Icon
            name={step.done ? 'approvals' : 'circle'}
            size={20}
            color={step.done ? colors['positive-deep'] : colors.body}
          />
          <Text
            style={[
              styles.stepLabel,
              { color: step.done ? colors.body : colors.ink, fontFamily: fonts.bodyMedium },
              step.done && styles.stepDone,
            ]}
          >
            {step.label}
          </Text>
          {step.done ? null : <Icon name="chevronRight" size={18} color={colors.body} />}
        </Pressable>
      ))}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.bodyMdStrong,
  },
  dismiss: {
    minHeight: 44,
    justifyContent: 'center',
  },
  dismissText: {
    ...typography.bodySm,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  stepLabel: {
    ...typography.bodySm,
    flex: 1,
  },
  stepDone: {
    textDecorationLine: 'line-through',
  },
});
