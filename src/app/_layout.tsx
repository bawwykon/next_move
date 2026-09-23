import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';

import { useLoadedFonts } from '@/lib/fonts';
import { initLocale, type AppLocale } from '@/i18n';
import { track } from '@/data/analytics';
import { loadLocalSettings } from '@/data/repositories/settings';
import { setSoundFxEnabled } from '@/lib/sounds';
import { captureTabPath } from '@/lib/intended-route';
import { useAppForeground } from '@/hooks/useAppForeground';
import { useDayChange } from '@/hooks/useDayChange';
import { useCompletionStore } from '@/state/completionStore';
import { useCharacterStore } from '@/state/characterStore';
import { useSessionStore } from '@/state/sessionStore';

// supabase-js warns on RN that PKCE falls back to 'plain' challenge (dev-only noise).
LogBox.ignoreLogs(['WebCrypto API is not supported']);

SplashScreen.preventAutoHideAsync();

// NFR-9 — one `app_opened` per process launch, once.
let appOpenedTracked = false;

export default function RootLayout() {
  const [locale, setLocale] = useState<AppLocale | null>(null);

  // I18N-01 — resolve locale (saved, else device, else English) before first
  // paint so no screen flashes the wrong language. I18N-03 — fonts load
  // after the locale is known so Arabic gets its companion files.
  useEffect(() => {
    let cancelled = false;
    void initLocale()
      .catch(() => 'en' as AppLocale)
      .then((resolved) => {
        if (!cancelled) {
          setLocale(resolved);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!locale) {
    return null;
  }
  return <ReadyRoot locale={locale} />;
}

function ReadyRoot({ locale }: { locale: AppLocale }) {
  const [loaded, error] = useLoadedFonts(locale);
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

  // NFR-9 — app_opened fires once per process launch (device open/foreground
  // events are deliberately out of scope: privacy-lean, per PRD §8.2).
  useEffect(() => {
    if (ready && !appOpenedTracked) {
      appOpenedTracked = true;
      void track('app_opened');
    }
  }, [ready]);

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
      // Coexist with background music (Spotify etc.): our cues are short
      // UI/effect sounds, so request no exclusive focus — mix instead of
      // pausing whatever the user is listening to. Without this, every tap
      // cue forces an audio-focus transaction that both stops music and can
      // stutter rapid taps (builder add-taps) on some devices.
      void setAudioModeAsync({ interruptionMode: 'mixWithOthers' }).catch(() => undefined);
      void loadLocalSettings()
        .then((saved) => setSoundFxEnabled(saved.soundFx))
        .catch(() => undefined);
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
        {/* Ref 04 rule 2 — fullscreen modal, no tab bar, no accidental swipes
            (gestureEnabled blocks iOS swipe-dismiss so quit always confirms). */}
        <Stack.Screen
          name="workout/[id]"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
