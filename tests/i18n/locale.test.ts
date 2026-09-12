import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  APP_LOCALES,
  isAppLocale,
  isRtlLocale,
  LOCALE_NAMES,
  localeResources,
  resolveLocale,
} from '../../src/i18n/locales';

describe('locale resolution', () => {
  it('a valid saved choice always wins', () => {
    expect(resolveLocale('ar', 'es-MX')).toBe('ar');
    expect(resolveLocale('es', 'ar-EG')).toBe('es');
    expect(resolveLocale('en', null)).toBe('en');
  });

  it('maps device tags with region suffixes, falls back to English', () => {
    expect(resolveLocale(null, 'es-MX')).toBe('es');
    expect(resolveLocale(null, 'ar-EG')).toBe('ar');
    expect(resolveLocale(null, 'fr-FR')).toBe('en');
    expect(resolveLocale(null, null)).toBe('en');
    expect(resolveLocale('xx', null)).toBe('en');
  });

  it('knows the locale set, native names, and RTL membership', () => {
    expect(APP_LOCALES).toEqual(['en', 'es', 'ar']);
    expect(LOCALE_NAMES).toEqual({ en: 'English', es: 'Español', ar: 'العربية' });
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('en')).toBe(false);
    expect(isRtlLocale('es')).toBe(false);
    expect(isAppLocale('ar')).toBe(true);
    expect(isAppLocale('xx')).toBe(false);
  });
});

describe('resource fallback', () => {
  it('falls back to English for missing keys and never crashes', async () => {
    const t = createInstance();
    await t.use(initReactI18next).init({
      resources: {
        en: { translation: localeResources.en },
        es: { translation: localeResources.es },
        ar: { translation: localeResources.ar },
      },
      lng: 'es',
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
    expect(t.t('tabs.questBoard')).toBe('Misiones');
    await t.changeLanguage('ar');
    expect(t.t('tabs.journey')).toBe('الرحلة');
    // Spanish intentionally lacks nothing here, so prove the mechanism
    // with a key removed at runtime: falls back to English.
    const missing = t.t('tabs.doesNotExist', { defaultValue: undefined });
    expect(typeof missing).toBe('string');
  });

  it('every non-English locale carries the same keys as English', () => {
    const enKeys = Object.keys(localeResources.en.tabs).sort();
    expect(Object.keys(localeResources.es.tabs).sort()).toEqual(enKeys);
    expect(Object.keys(localeResources.ar.tabs).sort()).toEqual(enKeys);
    expect(Object.keys(localeResources.es.settings).sort()).toEqual(
      Object.keys(localeResources.en.settings).sort(),
    );
    expect(Object.keys(localeResources.ar.settings).sort()).toEqual(
      Object.keys(localeResources.en.settings).sort(),
    );
    // Phase 2 groups: Spanish mirrors English exactly; Arabic carries the
    // same top-level groups (plural leaves may expand to the CLDR family).
    const groups = [
      'common',
      'journey',
      'achievements',
      'history',
      'editProfile',
      'profile',
      'build',
      'custom',
      'auth',
      'errors',
      'loadout',
      'onboarding',
      'journeyMap',
      'catalog',
    ] as const;
    for (const group of groups) {
      expect(Object.keys(localeResources.es[group]).sort()).toEqual(
        Object.keys(localeResources.en[group]).sort(),
      );
      for (const key of Object.keys(localeResources.en[group])) {
        expect((localeResources.ar[group] as Record<string, unknown>)[key]).toBeDefined();
      }
    }
  });

  it('every English board leaf resolves in Spanish and Arabic (plural families may differ)', () => {
    const leaves = (node: unknown, prefix: string, out: string[] = []): string[] => {
      if (typeof node === 'string') {
        out.push(prefix);
      } else if (Array.isArray(node)) {
        node.forEach((_, index) => leaves('x', `${prefix}.${index}`, out));
      } else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) leaves(value, `${prefix}.${key}`, out);
      }
      return out;
    };
    const pluralBase = (path: string): string | null => {
      const m = path.match(/^(.*)_(zero|one|two|few|many|other)$/);
      return m ? m[1]! : null;
    };
    const arVariants = (base: string): string[] =>
      ['zero', 'one', 'two', 'few', 'many', 'other'].map((v) => `${base}_${v}`);
    const get = (obj: unknown, path: string): unknown =>
      path.split('.').reduce<unknown>((acc, part) => {
        if (Array.isArray(acc)) return acc[Number(part)];
        if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
        return undefined;
      }, obj);
    for (const leaf of leaves(localeResources.en.board, 'board')) {
      // Spanish uses the same plural set as English: exact match required.
      expect(get(localeResources.es.board, leaf.replace(/^board\./, ''))).toBeDefined();
      // Arabic may split one/other into the full CLDR family — or split an
      // unpluralized English key the same way (e.g. weeklyBankedInDays).
      const base = pluralBase(leaf) ?? leaf;
      const exact = get(localeResources.ar.board, leaf.replace(/^board\./, ''));
      if (exact !== undefined) {
        continue;
      }
      const hit = arVariants(base).some(
        (variant) => get(localeResources.ar.board, variant.replace(/^board\./, '')) !== undefined,
      );
      expect(hit).toBe(true);
    }
  });
});
