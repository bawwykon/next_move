import { Redirect } from 'expo-router';

import { useSessionStore } from '@/state/sessionStore';

export default function IndexRedirect() {
  const authStatus = useSessionStore((state) => state.authStatus);
  const target = authStatus === 'signed-in' ? '/(tabs)/quest-board' : '/(auth)/welcome';

  return <Redirect href={target} />;
}
