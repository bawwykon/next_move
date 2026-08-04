export const TAB_HREFS = ['/(tabs)/quest-board', '/(tabs)/journey', '/(tabs)/profile'] as const;

export const DEFAULT_POST_LOGIN_ROUTE = '/(tabs)/quest-board';

export function toTabHref(pathname: string): string | null {
  switch (pathname) {
    case '/quest-board':
      return '/(tabs)/quest-board';
    case '/journey':
      return '/(tabs)/journey';
    case '/profile':
      return '/(tabs)/profile';
    default:
      return null;
  }
}

export function postLoginRoute(intendedRoute: string | null): (typeof TAB_HREFS)[number] {
  if (intendedRoute && (TAB_HREFS as readonly string[]).includes(intendedRoute)) {
    return intendedRoute as (typeof TAB_HREFS)[number];
  }
  return DEFAULT_POST_LOGIN_ROUTE;
}

let capturedTabPath: string | null = null;
let manualSignOut = false;

export function captureTabPath(pathname: string): void {
  const href = toTabHref(pathname);
  if (href) {
    capturedTabPath = href;
  }
}

export function readCapturedTabPath(): string | null {
  return capturedTabPath;
}

export function clearCapturedTabPath(): void {
  capturedTabPath = null;
}

export function markManualSignOut(): void {
  manualSignOut = true;
}

export function consumeManualSignOut(): boolean {
  const wasManual = manualSignOut;
  manualSignOut = false;
  return wasManual;
}
