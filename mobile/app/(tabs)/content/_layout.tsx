import { Stack } from 'expo-router';
import { AppShellGate } from '../../../src/context/AppShellChromeContext';
import { useTheme } from '../../../src/context/ThemeContext';

export default function ContentLayout() {
  const { colors } = useTheme();

  return (
    <AppShellGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors['canvas-soft'] },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Content' }} />
        <Stack.Screen name="new" options={{ title: 'New post' }} />
        <Stack.Screen name="[id]" options={{ title: 'Edit post' }} />
      </Stack>
    </AppShellGate>
  );
}
