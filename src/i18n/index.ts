/**
 * I18N-01 — locale runtime (phase 1: plumbing).
 *
 * - `initLocale` runs once at startup (splash gate): saved choice, else
 *   device language, else English. Missing keys fall back to English and
 *   never crash (fallbackLng).
 * - `applyLocale` persists + switches; crossing the LTR/RTL boundary sets
 *   the native RTL flags and reloads (Android only applies RTL on restart).
 * - Locale is device-local (AsyncStorage only, never synced to profiles).
 */
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createInstance, type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import * as Updates from 'expo-updates';

import {
  APP_LOCALES,
  isAppLocale,
  isRtlLocale,
  localeResources,
  resolveLocale,
  type AppLocale,
} from './locales';

export const LOCALE_STORAGE_KEY = 'next_move_locale';

export async function loadSavedLocale(): Promise<AppLocale | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    return isAppLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function saveLocale(locale: AppLocale): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // storage failures must never crash the UI
  }
}

function deviceLanguageTag(): string | null {
  try {
    const locales = Localization.getLocales();
    return locales[0]?.languageTag ?? null;
  } catch {
    return null;
  }
}

function applyRtlFlags(locale: AppLocale): void {
  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(isRtlLocale(locale));
  } catch {
    // native flags unavailable (e.g. web preview) — layout stays LTR
  }
}

let initialized = false;
const i18n: I18nInstance = createInstance();

/** Start i18next with the resolved locale; safe to call once (re-entry no-op). */
export async function initLocale(): Promise<AppLocale> {
  if (initialized) {
    return isAppLocale(i18n.language) ? (i18n.language as AppLocale) : 'en';
  }
  const resolved = resolveLocale(await loadSavedLocale(), deviceLanguageTag());
  applyRtlFlags(resolved);
  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: localeResources.en },
      es: { translation: localeResources.es },
      ar: { translation: localeResources.ar },
    },
    lng: resolved,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  initialized = true;
  return resolved;
}

/**
 * Switch locale at runtime. Same direction: hot-swap via i18next.
 * LTR<->RTL crossing: persist, set flags, reload (Android requirement).
 * Returns true when a reload was triggered (caller should do nothing after).
 */
export async function applyLocale(locale: AppLocale): Promise<boolean> {
  if (!APP_LOCALES.includes(locale)) {
    return false;
  }
  const current = isAppLocale(i18n.language) ? (i18n.language as AppLocale) : 'en';
  await saveLocale(locale);
  if (isRtlLocale(locale) === isRtlLocale(current)) {
    await i18n.changeLanguage(locale);
    return false;
  }
  applyRtlFlags(locale);
  try {
    await Updates.reloadAsync();
  } catch {
    // reload unavailable — flags apply on next cold start
  }
  return true;
}

export { i18n };
export type { AppLocale };
