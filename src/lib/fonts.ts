import { useFonts as useExpoFonts } from 'expo-font';

export const fontAssets = {
  'Baloo2-Bold': require('@/assets/fonts/Baloo2-Bold.ttf'),
  'Nunito-Regular': require('@/assets/fonts/Nunito-Regular.ttf'),
  'Nunito-Bold': require('@/assets/fonts/Nunito-Bold.ttf'),
  // I18N-01 — Arabic companions (OFL): Baloo Bhaijaan 2 matches Baloo 2's
  // rounded display feel; Almarai pairs with Nunito for body. Loaded always
  // (small files); per-screen family switching lands in the Arabic phase.
  'BalooBhaijaan2-Bold': require('@/assets/fonts/BalooBhaijaan2-Bold.ttf'),
  'Almarai-Regular': require('@/assets/fonts/Almarai-Regular.ttf'),
  'Almarai-Bold': require('@/assets/fonts/Almarai-Bold.ttf'),
} as const;

export function useLoadedFonts() {
  return useExpoFonts(fontAssets);
}
