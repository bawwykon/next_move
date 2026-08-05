import { Redirect } from 'expo-router';

import { useSessionStore } from '@/state/sessionStore';

export default function IndexRedirect() {
  const authStatus = useSessionStore((state) => state.authStatus);
  const onboarded = useSessionStore((state) => state.onboarded);

  if (authStatus !== 'signed-in') {
    return <Redirect href="/(auth)/welcome" />;
  }
  // Mirrors the root layout guard (Ref 04): not-onboarded users land on the
  // wizard, never on a guard-blocked (tabs) route.
  if (onboarded === true) {
    return <Redirect href="/(tabs)/quest-board" />;
  }
  return <Redirect href="/(onboarding)" />;
}
