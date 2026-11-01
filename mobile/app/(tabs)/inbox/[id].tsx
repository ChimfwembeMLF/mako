import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { InboxThreadPanel } from '../../../src/components/InboxThreadPanel';
import { BackButton } from '../../../src/components/ui';
import { useTheme } from '../../../src/context/ThemeContext';
import { spacing, typography } from '../../../src/theme';

export default function InboxThreadScreen() {
  const { colors } = useTheme();
  const { id, channel, contentId } = useLocalSearchParams<{
    id: string;
    channel?: string;
    contentId?: string;
  }>();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <BackButton />
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
          Conversation
        </Text>
      </View>
      <InboxThreadPanel id={String(id)} channel={channel} contentId={contentId} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  title: {
    ...typography.headlineLg,
    flex: 1,
  },
});
