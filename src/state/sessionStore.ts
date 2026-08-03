import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/data/supabase';
import { getAuthErrorMessage } from '@/lib/auth-errors';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

interface SessionStore {
  authStatus: AuthStatus;
  session: Session | null;
  intendedRoute: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  setIntendedRoute: (route: string) => void;
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
    if (!data.session) {
      return 'We emailed you a confirmation link — open it, then sign in.';
    }
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, authStatus: 'signed-out' });
  },

  setIntendedRoute: (route) => set({ intendedRoute: route }),
}));

supabase.auth.onAuthStateChange((_event, session) => {
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
