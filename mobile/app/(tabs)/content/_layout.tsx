import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function ContentLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Content' }} />
      <Stack.Screen name="new" options={{ title: 'New post' }} />
      <Stack.Screen name="[id]" options={{ title: 'Edit post' }} />
    </Stack>
  );
}
