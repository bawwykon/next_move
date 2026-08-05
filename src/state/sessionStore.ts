import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/data/supabase';
import { getOnboarded, saveOnboarding } from '@/data/repositories/profile';
import type { OnboardingPayload } from '@/features/onboarding/wizardController';
import { getAuthErrorMessage, signUpConfirmation } from '@/lib/auth-errors';
import { consumeManualSignOut, markManualSignOut, readCapturedTabPath } from '@/lib/intended-route';
import { useCharacterStore } from '@/state/characterStore';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

interface SessionStore {
  authStatus: AuthStatus;
  session: Session | null;
  onboarded: boolean | null;
  intendedRoute: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  completeOnboarding: (payload: OnboardingPayload) => Promise<string | null>;
  setIntendedRoute: (route: string) => void;
  clearIntendedRoute: () => void;
}

export const useSessionStore = create<SessionStore>()((set) => ({
  authStatus: 'loading',
  session: null,
  onboarded: null,
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

  completeOnboarding: async (payload) => {
    const error = await saveOnboarding(payload);
    if (error) {
      return error;
    }
    set({ onboarded: true });
    // TODO(NFR-9): emit onboarding_completed analytics event once an SDK is wired up.
    return null;
  },

  setIntendedRoute: (route) => set({ intendedRoute: route }),
  clearIntendedRoute: () => set({ intendedRoute: null }),
}));

function applySession(session: Session | null) {
  useSessionStore.setState({
    session,
    authStatus: session ? 'signed-in' : 'signed-out',
  });
  if (session) {
    void getOnboarded().then((onboarded) => {
      if (onboarded !== null) {
        useSessionStore.setState({ onboarded });
      }
    });
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    const manual = consumeManualSignOut();
    // Forced session expiry (refresh revoked server-side) captures the last tab path
    // so the next login restores it (Ref 04 line 45). Manual sign-out skips capture.
    useSessionStore.setState({
      session: null,
      authStatus: 'signed-out',
      onboarded: null,
      ...(manual ? {} : { intendedRoute: readCapturedTabPath() }),
    });
    useCharacterStore.getState().reset();
    return;
  }
  applySession(session);
});

void supabase.auth.getSession().then(({ data }) => {
  applySession(data.session);
});
