import { Stack } from 'expo-router';
import { View } from 'react-native';
import { AppShellHeader } from '../../../src/components/AppShellHeader';
import { useTheme } from '../../../src/context/ThemeContext';
import { fonts } from '../../../src/theme';

export default function ContentLayout() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors['canvas-soft'] }}>
      <AppShellHeader />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fonts.display, fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors['canvas-soft'] },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Content' }} />
        <Stack.Screen name="new" options={{ title: 'New post' }} />
        <Stack.Screen name="[id]" options={{ title: 'Edit post' }} />
      </Stack>
    </View>
  );
}
