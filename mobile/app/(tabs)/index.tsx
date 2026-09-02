import React from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { TabShell } from '../../src/components/TabShell';
import { OnboardingHint } from '../../src/components/OnboardingHint';
import { useTheme } from '../../src/context/ThemeContext';
import { HeroBanner, PageHeader, QuickLinkCard, Screen } from '../../src/components/ui';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <TabShell>
      <Screen>
        <HeroBanner
          title="Publish. Engage. Measure."
          subtitle="Content, scheduling, connections, and inbox — your social workspace on mobile."
          primaryAction={{
            label: 'Create post',
            onPress: () => router.push('/content/new' as any),
          }}
          secondaryAction={{
            label: 'Open inbox',
            onPress: () => router.push('/inbox' as any),
          }}
        />

        <OnboardingHint />

        <PageHeader
          title="Quick actions"
          subtitle="Same core flows as the web social dashboard."
        />

        <QuickLinkCard
          title="Content Engine"
          description="Write and publish posts"
          icon={<Text style={{ fontSize: 20, color: colors['positive-deep'] }}>✎</Text>}
          onPress={() => router.push('/content' as any)}
        />
        <QuickLinkCard
          title="Scheduler"
          description="View and manage scheduled posts"
          icon={<Text style={{ fontSize: 20, color: colors['positive-deep'] }}>▦</Text>}
          iconBg={colors['canvas-soft']}
          onPress={() => router.push('/schedule' as any)}
        />
        <QuickLinkCard
          title="Connections"
          description="Link Facebook, Instagram, LinkedIn & more"
          icon={<Text style={{ fontSize: 20, color: colors['positive-deep'] }}>⛓</Text>}
          onPress={() => router.push('/connections' as any)}
        />
        <QuickLinkCard
          title="Social Inbox"
          description="Comments, DMs and replies"
          icon={<Text style={{ fontSize: 20, color: colors['positive-deep'] }}>✉</Text>}
          onPress={() => router.push('/inbox' as any)}
        />

        <PageHeader title="Explore" subtitle="Brand tools and workspace settings live under More." />
        <QuickLinkCard
          title="Open More menu"
          description="Brand Brain, Media, Analytics, Team & Settings"
          icon={<Text style={{ fontSize: 20, color: colors['positive-deep'] }}>☰</Text>}
          onPress={() => router.push('/more' as any)}
        />
      </Screen>
    </TabShell>
  );
}
