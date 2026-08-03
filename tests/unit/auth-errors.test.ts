import { getAuthErrorMessage } from '../../src/lib/auth-errors';

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
