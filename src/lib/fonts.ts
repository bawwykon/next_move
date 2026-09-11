import { useFonts as useExpoFonts } from 'expo-font';

import type { AppLocale } from '@/i18n/locales';

export const fontAssets = {
  'Baloo2-Bold': require('@/assets/fonts/Baloo2-Bold.ttf'),
  'Nunito-Regular': require('@/assets/fonts/Nunito-Regular.ttf'),
  'Nunito-Bold': require('@/assets/fonts/Nunito-Bold.ttf'),
  // I18N-01 — Arabic companions (OFL): Baloo Bhaijaan 2 matches Baloo 2's
  // rounded display feel; Almarai pairs with Nunito for body. Also loaded
  // (small files) so glyphs exist even before the locale is known.
  'BalooBhaijaan2-Bold': require('@/assets/fonts/BalooBhaijaan2-Bold.ttf'),
  'Almarai-Regular': require('@/assets/fonts/Almarai-Regular.ttf'),
  'Almarai-Bold': require('@/assets/fonts/Almarai-Bold.ttf'),
} as const;

/**
 * I18N-03 (Arabic phase) — when the locale is Arabic, the Latin family names
 * used across every StyleSheet (`Baloo2-Bold`, `Nunito-*`) resolve to the
 * Arabic companion files, so all screens pick up Arabic typography with no
 * per-screen changes. Same-direction switches (en<->es) keep Latin files;
 * LTR<->RTL switches reload the app, so the correct set loads at startup.
 */
const fontAssetsAr = {
  'Baloo2-Bold': require('@/assets/fonts/BalooBhaijaan2-Bold.ttf'),
  'Nunito-Regular': require('@/assets/fonts/Almarai-Regular.ttf'),
  'Nunito-Bold': require('@/assets/fonts/Almarai-Bold.ttf'),
  'BalooBhaijaan2-Bold': require('@/assets/fonts/BalooBhaijaan2-Bold.ttf'),
  'Almarai-Regular': require('@/assets/fonts/Almarai-Regular.ttf'),
  'Almarai-Bold': require('@/assets/fonts/Almarai-Bold.ttf'),
} as const;

export function useLoadedFonts(locale: AppLocale | null) {
  return useExpoFonts(locale === 'ar' ? fontAssetsAr : fontAssets);
}
