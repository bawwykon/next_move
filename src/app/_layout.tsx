import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

import { useLoadedFonts } from '@/lib/fonts';
import { captureTabPath } from '@/lib/intended-route';
import { useSessionStore } from '@/state/sessionStore';

// supabase-js warns on RN that PKCE falls back to 'plain' challenge (dev-only noise).
LogBox.ignoreLogs(['WebCrypto API is not supported']);

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useLoadedFonts();
  const authStatus = useSessionStore((state) => state.authStatus);
  const pathname = usePathname();
  const ready = (loaded || error) && authStatus !== 'loading';

  useEffect(() => {
    captureTabPath(pathname);
  }, [pathname]);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  const signedIn = authStatus === 'signed-in';

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        {/* Kept outside the auth guard so reset-password survives the signed-in flip
            after the recovery code exchange. */}
        <Stack.Screen name="reset-password" />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        {/* S2: signed-in but not onboarded -> show /(onboarding) instead of (tabs) */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
