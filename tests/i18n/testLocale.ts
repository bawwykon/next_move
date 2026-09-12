import { createInstance, type TFunction } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { localeResources } from '@/i18n/locales';

let cached: TFunction | null = null;

/** English `t` bound to the real locale tables (unit tests assert real copy). */
export async function englishT(): Promise<TFunction> {
  if (!cached) {
    const instance = createInstance();
    await instance.use(initReactI18next).init({
      resources: {
        en: { translation: localeResources.en },
        es: { translation: localeResources.es },
        ar: { translation: localeResources.ar },
      },
      lng: 'en',
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
    cached = instance.t.bind(instance) as TFunction;
  }
  return cached;
}

let cachedAr: TFunction | null = null;

/** Arabic-bound `t` for ar-only keys and the explicit Arabic code paths. */
export async function arabicT(): Promise<TFunction> {
  if (!cachedAr) {
    const instance = createInstance();
    await instance.use(initReactI18next).init({
      resources: {
        en: { translation: localeResources.en },
        es: { translation: localeResources.es },
        ar: { translation: localeResources.ar },
      },
      lng: 'ar',
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
    cachedAr = instance.t.bind(instance) as TFunction;
  }
  return cachedAr;
}
