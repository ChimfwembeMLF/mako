import { Tabs, router, usePathname } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../src/components/ui';
import { useTheme } from '../../src/context/ThemeContext';
import { fonts, spacing } from '../../src/theme';

function tabIcon(name: IconName) {
  return ({ color }: { color: ColorValue }) => <Icon name={name} color={color as string} />;
}

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // These screens have no tab of their own; they live in the More menu.
  const inMoreMenu = /^\/(connections|profile)/.test(usePathname());
  const tabLabelStyle = { fontFamily: fonts.bodyMedium, fontSize: 11 };

  // The bar stays in layout flow (not absolute) so lists and the inbox composer never sit behind it.
  return (
    <View style={[styles.root, { backgroundColor: colors['canvas-soft'] }]}>
    <Tabs
      backBehavior="history"
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        sceneStyle: { backgroundColor: colors['canvas-soft'] },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.mute,
        tabBarLabelStyle: tabLabelStyle,
        tabBarItemStyle: { height: 64, justifyContent: 'center', paddingVertical: 0 },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: 64,
          marginHorizontal: spacing.xl,
          marginTop: spacing.sm,
          marginBottom: Math.max(insets.bottom, spacing.xl),
          paddingTop: 0,
          paddingBottom: 0,
          elevation: 0,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: tabIcon('home'),
        }}
      />
      <Tabs.Screen
        name="content"
        options={{
          title: 'Posts',
          tabBarIcon: tabIcon('content'),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: tabIcon('calendar'),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: tabIcon('inbox'),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          // The bar's tint follows the focused route, so More has to set its own active look.
          tabBarIcon: ({ focused }) => (
            <Icon name="menu" color={focused || inMoreMenu ? colors.ink : colors.mute} />
          ),
          tabBarLabelStyle: [tabLabelStyle, inMoreMenu && { color: colors.ink }],
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
        name="connections"
        options={{
          title: 'Social accounts',
          href: null,
          tabBarIcon: tabIcon('connections'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: null,
          tabBarIcon: tabIcon('user'),
        }}
      />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
