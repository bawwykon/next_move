import {
  captureTabPath,
  clearCapturedTabPath,
  postLoginRoute,
  readCapturedTabPath,
  toTabHref,
} from '../../src/lib/intended-route';

describe('intendedRoute helpers', () => {
  beforeEach(() => clearCapturedTabPath());

  it('maps tab pathnames to tab hrefs', () => {
    expect(toTabHref('/quest-board')).toBe('/(tabs)/quest-board');
    expect(toTabHref('/journey')).toBe('/(tabs)/journey');
    expect(toTabHref('/profile')).toBe('/(tabs)/profile');
  });

  it('ignores non-tab pathnames', () => {
    expect(toTabHref('/welcome')).toBeNull();
    expect(toTabHref('/login')).toBeNull();
    expect(toTabHref('/reset-password')).toBeNull();
  });

  it('captures only tab paths as the intended route', () => {
    captureTabPath('/welcome');
    expect(readCapturedTabPath()).toBeNull();
    captureTabPath('/journey');
    expect(readCapturedTabPath()).toBe('/(tabs)/journey');
  });

  it('keeps the last captured tab path across non-tab navigation', () => {
    captureTabPath('/journey');
    captureTabPath('/welcome');
    captureTabPath('/reset-password');
    expect(readCapturedTabPath()).toBe('/(tabs)/journey');
  });

  it('clears the captured path', () => {
    captureTabPath('/profile');
    clearCapturedTabPath();
    expect(readCapturedTabPath()).toBeNull();
  });

  it('restores a valid captured route, else the default quest board', () => {
    expect(postLoginRoute('/(tabs)/journey')).toBe('/(tabs)/journey');
    expect(postLoginRoute('/(tabs)/profile')).toBe('/(tabs)/profile');
    expect(postLoginRoute(null)).toBe('/(tabs)/quest-board');
    expect(postLoginRoute('/welcome')).toBe('/(tabs)/quest-board');
  });
});
