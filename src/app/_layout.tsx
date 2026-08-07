import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

import { useLoadedFonts } from '@/lib/fonts';
import { captureTabPath } from '@/lib/intended-route';
import { useAppForeground } from '@/hooks/useAppForeground';
import { useDayChange } from '@/hooks/useDayChange';
import { useCompletionStore } from '@/state/completionStore';
import { useCharacterStore } from '@/state/characterStore';
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

  // S5-05 — flush the offline outbox once the session is known (auth-ready)
  // and on every return to the foreground; hydrate keeps the pending marker
  // honest across launches. Both are fire-and-forget and single-in-flight.
  useEffect(() => {
    if (signedIn) {
      void useCompletionStore.getState().hydrate();
      void useCompletionStore.getState().flush();
    }
  }, [signedIn]);

  useAppForeground(() => {
    if (useSessionStore.getState().authStatus === 'signed-in') {
      void useCompletionStore.getState().flush();
    }
  });

  // S6-02 — local-midnight rollover (FR-BOARD-7). The day key is the source of
  // truth; when it flips (timer fire or foreground re-check) the character
  // snapshot refreshes, so the board re-derives "done today", the weekly
  // window, and the daily recommendation for the new day.
  useDayChange(() => {
    if (useSessionStore.getState().authStatus === 'signed-in') {
      void useCharacterStore.getState().refresh();
    }
  });

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
        {/* Ref 04 rule 2 — fullscreen modal, no tab bar, no accidental swipes. */}
        <Stack.Screen name="workout/[id]" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
