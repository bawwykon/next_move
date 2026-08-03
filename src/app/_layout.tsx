import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useLoadedFonts } from '@/lib/fonts';
import { useSessionStore } from '@/state/sessionStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useLoadedFonts();
  const authStatus = useSessionStore((state) => state.authStatus);
  const ready = (loaded || error) && authStatus !== 'loading';

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
