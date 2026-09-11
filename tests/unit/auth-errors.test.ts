import { authErrorMessage, getAuthErrorCode, getAuthErrorMessage } from '../../src/lib/auth-errors';
import { englishT } from '../i18n/testLocale';
import type { TFunction } from 'i18next';

let t: TFunction;
beforeAll(async () => {
  t = await englishT();
});

describe('getAuthErrorMessage', () => {
  it('maps invalid credentials to friendly copy', () => {
    const error = { code: 'invalid_credentials', message: 'Invalid login credentials' };
    expect(getAuthErrorMessage(error)).toBe("That email and password don't match — try again.");
  });

  it('maps a wrongly formatted email to a format hint', () => {
    const error = { code: 'validation_failed', message: 'Invalid email or password format' };
    expect(getAuthErrorMessage(error)).toBe("That email doesn't look right — double-check it.");
  });

  it('maps network failures to a connection message', () => {
    const error = new TypeError('Network request failed');
    expect(getAuthErrorMessage(error)).toBe(
      "Can't reach the server — check your connection and try again.",
    );
  });

  it('falls back for unknown codes', () => {
    const error = { code: 'mystery_code', message: 'something cryptic' };
    expect(getAuthErrorMessage(error)).toBe('Something went wrong — give it another try.');
  });

  it('returns an empty string when there is no error', () => {
    expect(getAuthErrorMessage(null)).toBe('');
    expect(getAuthErrorMessage(undefined)).toBe('');
  });
});

describe('getAuthErrorCode', () => {
  it('returns null when there is no error', () => {
    expect(getAuthErrorCode(null)).toBeNull();
    expect(getAuthErrorCode(undefined)).toBeNull();
  });

  it('maps server codes 1:1 (rate limit normalizes)', () => {
    expect(getAuthErrorCode({ code: 'invalid_credentials' })).toBe('invalid_credentials');
    expect(getAuthErrorCode({ code: 'over_email_send_rate_limit' })).toBe('rate_limit');
    expect(getAuthErrorCode({ code: 'session_not_found' })).toBe('session_not_found');
  });

  it('maps network failures and falls back otherwise', () => {
    expect(getAuthErrorCode(new TypeError('Network request failed'))).toBe('network');
    expect(getAuthErrorCode({ code: 'mystery_code' })).toBe('fallback');
    expect(getAuthErrorCode('boom')).toBe('fallback');
  });
});

describe('authErrorMessage', () => {
  it('renders every code in the active locale without crashing', () => {
    expect(authErrorMessage('invalid_credentials', t)).toBe(
      "That email and password don't match — try again.",
    );
    expect(authErrorMessage('network', t)).toBe(
      "Can't reach the server — check your connection and try again.",
    );
    expect(authErrorMessage('fallback', t)).toBe('Something went wrong — give it another try.');
    expect(authErrorMessage('confirmation_sent', t)).toBe(
      'We emailed you a confirmation link — open it, then sign in.',
    );
  });
});
