import { QueryClientProvider } from '@tanstack/react-query';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { WorkspaceProvider } from '../src/context/WorkspaceContext';
import { OfflineProvider } from '../src/components/OfflineBanner';
import { AppLogoLoader, ToastProvider } from '../src/components/ui';
import { queryClient } from '../src/lib/query-client';
import { useAppFonts } from '../src/hooks/useAppFonts';
import { TenantThemeProvider, useTenantTheme } from '../src/store/themeStore';
import { useWorkspace } from '../src/context/WorkspaceContext';
import { api } from '../src/lib/api';
import { usePushNotifications } from '../src/hooks/usePushNotifications';

function InitialLayout() {
  const { token, isLoading } = useAuth();
  const { colors } = useTheme();
  const { setTheme } = useTenantTheme();
  const { tenantId } = useWorkspace();
  const segments = useSegments();
  const router = useRouter();

  usePushNotifications(!!token);

  useEffect(() => {
    if (tenantId) {
      api.getTenantTheme(tenantId).then(theme => {
        if (theme) {
          setTheme(theme);
        }
      }).catch(err => {
        if (err.message !== 'Not Found') {
          console.error(err);
        }
      });
    }
  }, [tenantId, setTheme]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup && segments[0] !== 'publisher') {
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup && segments[1] !== 'callback') {
      router.replace('/(tabs)');
    }
  }, [token, isLoading, segments, router]);

  const { hasShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (token && hasShareIntent && segments[0] !== '(auth)') {
      // Small timeout to allow tabs to mount if just opening
      setTimeout(() => {
        router.push('/content/new' as any);
      }, 100);
    }
  }, [hasShareIntent, token, segments, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors['canvas-soft'] }}>
        <AppLogoLoader />
      </View>
    );
  }

  return <Slot />;
}

function FontGate({ children }: { children: React.ReactNode }) {
  const { loaded } = useAppFonts();
  const { colors } = useTheme();

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors['canvas-soft'] }}>
        <AppLogoLoader />
      </View>
    );
  }

  return <>{children}</>;
}

import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <TenantThemeProvider>
            <FontGate>
              <QueryClientProvider client={queryClient}>
                <AuthProvider>
                <WorkspaceProvider>
                  <OfflineProvider>
                    <ToastProvider>
                      <InitialLayout />
                    </ToastProvider>
                  </OfflineProvider>
                </WorkspaceProvider>
              </AuthProvider>
            </QueryClientProvider>
          </FontGate>
          </TenantThemeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}
