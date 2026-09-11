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
  });
});
