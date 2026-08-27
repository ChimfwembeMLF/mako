import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function InboxLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Inbox' }} />
      <Stack.Screen name="[id]" options={{ title: 'Conversation' }} />
    </Stack>
  );
}
