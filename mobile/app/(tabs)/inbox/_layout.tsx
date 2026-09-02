import { Stack } from 'expo-router';
import { AppShellGate } from '../../../src/context/AppShellChromeContext';
import { useTheme } from '../../../src/context/ThemeContext';

export default function InboxLayout() {
  const { colors } = useTheme();

  return (
    <AppShellGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors['canvas-soft'] },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Inbox' }} />
        <Stack.Screen name="[id]" options={{ title: 'Conversation' }} />
      </Stack>
    </AppShellGate>
  );
}
