import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { AppLogoLoader } from '../src/components/ui/AppLogoLoader';
import { useTheme } from '../src/context/ThemeContext';

export default function Index() {
  const { token, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors['canvas-soft'] }}>
        <AppLogoLoader />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
