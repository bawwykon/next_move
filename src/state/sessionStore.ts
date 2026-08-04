import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/data/supabase';
import { getAuthErrorMessage, signUpConfirmation } from '@/lib/auth-errors';
import { consumeManualSignOut, markManualSignOut, readCapturedTabPath } from '@/lib/intended-route';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

interface SessionStore {
  authStatus: AuthStatus;
  session: Session | null;
  intendedRoute: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  setIntendedRoute: (route: string) => void;
  clearIntendedRoute: () => void;
}

export const useSessionStore = create<SessionStore>()((set) => ({
  authStatus: 'loading',
  session: null,
  intendedRoute: null,

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return getAuthErrorMessage(error);
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return getAuthErrorMessage(error);
    }
    return signUpConfirmation(data.session);
  },

  signOut: async () => {
    markManualSignOut();
    await supabase.auth.signOut();
    set({ session: null, authStatus: 'signed-out' });
  },

  setIntendedRoute: (route) => set({ intendedRoute: route }),
  clearIntendedRoute: () => set({ intendedRoute: null }),
}));

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    const manual = consumeManualSignOut();
    // Forced session expiry (refresh revoked server-side) captures the last tab path
    // so the next login restores it (Ref 04 line 45). Manual sign-out skips capture.
    useSessionStore.setState({
      session: null,
      authStatus: 'signed-out',
      ...(manual ? {} : { intendedRoute: readCapturedTabPath() }),
    });
    return;
  }
  useSessionStore.setState({
    session,
    authStatus: session ? 'signed-in' : 'signed-out',
  });
});

void supabase.auth.getSession().then(({ data }) => {
  useSessionStore.setState({
    session: data.session,
    authStatus: data.session ? 'signed-in' : 'signed-out',
  });
});
