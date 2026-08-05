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
  const onboarded = useSessionStore((state) => state.onboarded);
  const pathname = usePathname();
  const signedIn = authStatus === 'signed-in';
  const needsOnboarding = signedIn && onboarded === false;
  // Signed-in but onboarded flag not loaded yet: hold the splash instead of
  // flickering between guards (Ref 04 guard pattern).
  const ready = (loaded || error) && authStatus !== 'loading' && !(signedIn && onboarded === null);

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
        <Stack.Protected guard={needsOnboarding}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded === true}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
