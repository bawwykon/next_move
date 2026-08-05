/**
 * Local calendar date → 'YYYY-MM-DD' (Ref 05 §tz). The emulator/device
 * timezone is authoritative; never use toISOString (UTC shift).
 */
export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 'YYYY-MM-DD' → UTC milliseconds of that local calendar day (DST-safe for
 * day arithmetic). Returns null for malformed keys.
 */
export function dayKeyToUtcMs(key: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return Date.UTC(year, month - 1, day);
}
