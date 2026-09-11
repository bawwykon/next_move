import type { TFunction } from 'i18next';

export const SIGN_UP_CONFIRMATION_MESSAGE =
  'We emailed you a confirmation link — open it, then sign in.';

const FALLBACK_MESSAGE = 'Something went wrong — give it another try.';
const NETWORK_MESSAGE = "Can't reach the server — check your connection and try again.";

const CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: "That email and password don't match — try again.",
  validation_failed: "That email doesn't look right — double-check it.",
  email_not_confirmed: 'We emailed you a confirmation link — open it, then sign in.',
  user_already_exists: 'An account with that email already exists — sign in instead.',
  weak_password: 'That password is too weak — use at least 6 characters.',
  over_email_send_rate_limit: "You're sending requests too quickly — wait a minute and try again.",
  session_not_found: 'That reset link has expired — request a new one.',
};

const NETWORK_MARKERS = ['network request failed', 'failed to fetch', 'load failed', 'timed out'];

const CODE_KEY: Record<string, string> = {
  invalid_credentials: 'errors.invalidCredentials',
  validation_failed: 'errors.validationFailed',
  email_not_confirmed: 'errors.emailNotConfirmed',
  user_already_exists: 'errors.userExists',
  weak_password: 'errors.weakPassword',
  over_email_send_rate_limit: 'errors.rateLimit',
  session_not_found: 'errors.sessionNotFound',
};

export function getAuthErrorMessage(error: unknown, t?: TFunction): string {
  const fallback = t ? t('errors.fallback') : FALLBACK_MESSAGE;
  const network = t ? t('errors.network') : NETWORK_MESSAGE;
  if (error == null) {
    return '';
  }
  if (typeof error !== 'object') {
    return fallback;
  }
  const candidate = error as { code?: unknown; message?: unknown };
  if (typeof candidate.code === 'string') {
    if (t) {
      const key = CODE_KEY[candidate.code];
      if (key) {
        return t(key);
      }
    } else {
      const mapped = CODE_MESSAGES[candidate.code];
      if (mapped) {
        return mapped;
      }
    }
  }
  if (typeof candidate.message === 'string') {
    const lowered = candidate.message.toLowerCase();
    if (NETWORK_MARKERS.some((marker) => lowered.includes(marker))) {
      return network;
    }
  }
  return fallback;
}

export function signUpConfirmation(session: unknown): string | null {
  return session ? null : SIGN_UP_CONFIRMATION_MESSAGE;
}
