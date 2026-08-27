import { Tabs } from 'expo-router';
import { colors } from '../../src/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mute,
        tabBarStyle: {
          backgroundColor: colors.ink,
        },
        headerStyle: {
          backgroundColor: colors.ink,
        },
        headerTintColor: colors.primary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="content" options={{ title: 'Content', headerShown: false }} />
      <Tabs.Screen name="connections" options={{ title: 'Connect' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox', headerShown: false }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
