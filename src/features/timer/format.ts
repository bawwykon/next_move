const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * Big-digit countdown text for a whole number of seconds: zero-padded to at
 * least two digits ("12", "03", "00"); three-digit values pass through
 * ("120"). Fractional input is floored.
 */
export function formatCountdown(wholeSeconds: number): string {
  const safe = Math.max(0, Math.floor(wholeSeconds));
  if (safe < 100) {
    return pad2(safe);
  }
  return String(safe);
}

/** mm:ss for a millisecond total ("12:34"); 0ms → "00:00". */
export function formatTotalRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}
