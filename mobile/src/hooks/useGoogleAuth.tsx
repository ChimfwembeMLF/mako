import React from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { getGoogleMobileAuthUrl } from '../lib/api';
import { Button } from '../components/ui';

WebBrowser.maybeCompleteAuthSession();

function readGoogleClientIds() {
  return {
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
    web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  };
}

function hasNativeGoogleClientId(): boolean {
  const { ios, android } = readGoogleClientIds();
  if (Platform.OS === 'ios') return Boolean(ios);
  if (Platform.OS === 'android') return Boolean(android);
  return false;
}

/** Uses api GOOGLE_CLIENT_ID via server redirect — same as web client Auth.tsx. */
function hasServerGoogleAuth(): boolean {
  return Boolean(readGoogleClientIds().web);
}

export function isGoogleAuthAvailableForPlatform(): boolean {
  if (Platform.OS === 'web') return hasServerGoogleAuth();
  return hasNativeGoogleClientId() || hasServerGoogleAuth();
}

export type GoogleAuthSuccess =
  | { kind: 'jwt'; token: string }
  | { kind: 'googleAccessToken'; token: string };

type GoogleAuthButtonProps = {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onSuccess: (result: GoogleAuthSuccess) => void;
  onError: (message: string) => void;
  style?: React.ComponentProps<typeof Button>['style'];
};

export function GoogleAuthButton(props: GoogleAuthButtonProps) {
  if (!isGoogleAuthAvailableForPlatform()) {
    return (
      <Button
        label="Google sign-in not configured"
        variant="outline"
        disabled
        style={props.style}
      />
    );
  }

  const useServerOAuth =
    (Platform.OS === 'web' && hasServerGoogleAuth()) ||
    (Platform.OS !== 'web' && !hasNativeGoogleClientId() && hasServerGoogleAuth());

  if (useServerOAuth) {
    return <GoogleServerAuthButton {...props} />;
  }

  return <GoogleNativeAuthButton {...props} />;
}

/** Web / native: expo-auth-session with platform client ids */
function GoogleNativeAuthButton({
  label,
  loading,
  disabled,
  onSuccess,
  onError,
  style,
}: GoogleAuthButtonProps) {
  const { ios, android, web } = readGoogleClientIds();

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: ios || undefined,
    androidClientId: android || undefined,
    webClientId: web || undefined,
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken;
      if (token) onSuccess({ kind: 'googleAccessToken', token });
    } else if (response?.type === 'error') {
      onError(response.error?.message || 'Google authentication failed');
    }
  }, [response, onSuccess, onError]);

  return (
    <Button
      label={label}
      variant="outline"
      onPress={() => void promptAsync()}
      loading={loading}
      disabled={disabled || !request}
      style={style}
    />
  );
}

/** Native / Expo Web: browser redirect to API /auth/google/mobile (matches web client). */
function GoogleServerAuthButton({
  label,
  loading,
  disabled,
  onSuccess,
  onError,
  style,
}: GoogleAuthButtonProps) {
  const [busy, setBusy] = React.useState(false);

  const prompt = async () => {
    setBusy(true);
    try {
      const returnUrl = Linking.createURL('callback');
      const authUrl = getGoogleMobileAuthUrl(returnUrl);

      if (Platform.OS === 'web') {
        window.location.assign(authUrl);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
      if (result.type !== 'success' || !result.url) {
        if (result.type === 'cancel' || result.type === 'dismiss') return;
        onError('Google sign-in was not completed');
        return;
      }
      const parsed = Linking.parse(result.url);
      const params = parsed.queryParams || {};
      const err = params.error;
      if (err) {
        onError(typeof err === 'string' ? err : String(err));
        return;
      }
      const token = params.token;
      if (!token || typeof token !== 'string') {
        onError('Missing sign-in token from server');
        return;
      }
      onSuccess({ kind: 'jwt', token });
    } catch (e: any) {
      onError(e.message || 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      label={label}
      variant="outline"
      onPress={() => void prompt()}
      loading={loading || busy}
      disabled={disabled}
      style={style}
    />
  );
}
