import { Stack } from 'expo-router';
import { AppShellGate } from '../../../src/context/AppShellChromeContext';
import { useTheme } from '../../../src/context/ThemeContext';

export default function MoreLayout() {
  const { colors } = useTheme();

  return (
    <AppShellGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors['canvas-soft'] },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="brand-brain" />
        <Stack.Screen name="media" />
        <Stack.Screen name="templates" />
        <Stack.Screen name="campaigns" />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="team" />
        <Stack.Screen name="approvals" />
        <Stack.Screen name="leads" />
        <Stack.Screen name="mail" />
        <Stack.Screen name="whatsapp" />
        <Stack.Screen name="auto-reply-rules" />
      </Stack>
    </AppShellGate>
  );
}
