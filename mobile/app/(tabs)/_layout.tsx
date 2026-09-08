import { Tabs, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Platform, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useTenantTheme } from '../../src/store/themeStore';
import { fonts } from '../../src/theme';

function TabIcon({ ios, glyph, color }: { ios: string; glyph: string; color: string }) {
  const tint = String(color);
  if (Platform.OS === 'ios') {
    return <SymbolView name={ios as any} size={22} tintColor={tint} />;
  }
  return <Text style={[styles.glyph, { color: tint }]}>{glyph}</Text>;
}

export default function TabLayout() {
  const { colors } = useTheme();
  const { theme } = useTenantTheme();
  
  const activeColor = theme.primaryColor || colors.ink;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: colors.mute,
        tabBarStyle: {
          backgroundColor: colors.canvas,
          borderTopColor: colors.border,
          height: 70, // Increased for larger touch targets
          paddingTop: 10,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodySemi,
          fontSize: 12,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon ios="house.fill" glyph="⌂" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="content"
        options={{
          title: 'Content',
          tabBarIcon: ({ color }) => <TabIcon ios="doc.text.fill" glyph="✎" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          title: 'Connect',
          href: null,
          tabBarIcon: ({ color }) => <TabIcon ios="link" glyph="⛓" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color }) => <TabIcon ios="tray.fill" glyph="✉" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          href: null,
          tabBarIcon: ({ color }) => <TabIcon ios="calendar" glyph="▦" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => (
            <TabIcon ios="ellipsis.circle.fill" glyph="☰" color={String(color)} />
          ),
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const rootState = navigation.getState();
            const moreRoute = rootState.routes.find(
              (r: { key: string; state?: { index?: number } }) => r.key === route.key,
            );
            const stackIndex = moreRoute?.state?.index ?? 0;
            if (stackIndex > 0) {
              e.preventDefault();
              router.replace('/(tabs)/more');
            }
          },
        })}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: null,
          tabBarIcon: ({ color }) => <TabIcon ios="person.fill" glyph="●" color={String(color)} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  glyph: {
    fontSize: 18,
    lineHeight: 22,
  },
});
