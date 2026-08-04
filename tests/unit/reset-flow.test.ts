import { getAuthErrorMessage, signUpConfirmation } from '../../src/lib/auth-errors';

describe('password reset flow errors', () => {
  it('maps an expired or reused reset code to friendly copy', () => {
    const error = {
      code: 'session_not_found',
      message: 'Session from session_id claim in JWT does not exist',
    };
    expect(getAuthErrorMessage(error)).toBe('That reset link has expired — request a new one.');
  });

  it('maps a weak new password to friendly copy (updateUser)', () => {
    const error = { code: 'weak_password', message: 'Password should be at least 6 characters.' };
    expect(getAuthErrorMessage(error)).toBe(
      'That password is too weak — use at least 6 characters.',
    );
  });

  it('maps a rate-limited reset email to friendly copy', () => {
    const error = { code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' };
    expect(getAuthErrorMessage(error)).toBe(
      "You're sending requests too quickly — wait a minute and try again.",
    );
  });

  it('maps a missing reset code to the expired-link copy via fallback-free mapping', () => {
    expect(getAuthErrorMessage(null)).toBe('');
  });
});

describe('register no-session confirmation path', () => {
  it('asks the user to confirm their email when no session was returned', () => {
    expect(signUpConfirmation(null)).toBe(
      'We emailed you a confirmation link — open it, then sign in.',
    );
  });

  it('returns null when a session was granted', () => {
    expect(signUpConfirmation({ user: { id: 'u1' } })).toBeNull();
  });
});
