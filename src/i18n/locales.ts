/**
 * I18N-01 — locale resources (phase 1: plumbing + tab-label proof set).
 *
 * Supported: English (default/fallback), Spanish, Arabic. Keys grow per
 * phase; every screen's strings move here instead of staying hardcoded.
 * Language names are intentionally NOT translated (native names everywhere).
 * Arabic copy ships as drafted and is flagged for owner review before the
 * Arabic QA gate (user reads Arabic; Spanish needs a native reviewer).
 */
export type AppLocale = 'en' | 'es' | 'ar';

export const APP_LOCALES: readonly AppLocale[] = ['en', 'es', 'ar'];

export const LOCALE_NAMES: Record<AppLocale, string> = {
  en: 'English',
  es: 'Español',
  ar: 'العربية',
};

/** Arabic is the only RTL locale. */
export function isRtlLocale(locale: AppLocale): boolean {
  return locale === 'ar';
}

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'en' || value === 'es' || value === 'ar';
}

/**
 * Resolve the active locale: a valid saved choice wins; otherwise the
 * device language maps (region suffixes included: es-MX -> es); anything
 * else falls back to English. Pure — deviceTag is injected for testability.
 */
export function resolveLocale(
  saved: string | null | undefined,
  deviceTag: string | null | undefined,
): AppLocale {
  if (isAppLocale(saved)) {
    return saved;
  }
  const tag = (deviceTag ?? '').toLowerCase();
  if (tag.startsWith('ar')) {
    return 'ar';
  }
  if (tag.startsWith('es')) {
    return 'es';
  }
  return 'en';
}

const en = {
  tabs: {
    questBoard: 'Quest Board',
    journey: 'Journey',
    profile: 'Profile',
    settings: 'Settings',
  },
  settings: {
    language: 'Language',
  },
};

const es: typeof en = {
  tabs: {
    questBoard: 'Misiones',
    journey: 'Viaje',
    profile: 'Perfil',
    settings: 'Ajustes',
  },
  settings: {
    language: 'Idioma',
  },
};

// Draft Arabic — owner review required before the Arabic QA gate.
const ar: typeof en = {
  tabs: {
    questBoard: 'المهام',
    journey: 'الرحلة',
    profile: 'الملف',
    settings: 'الإعدادات',
  },
  settings: {
    language: 'اللغة',
  },
};

export const localeResources: Record<AppLocale, typeof en> = { en, es, ar };
