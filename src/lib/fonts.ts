import { useFonts as useExpoFonts } from 'expo-font';

export const fontAssets = {
  'Baloo2-Bold': require('@/assets/fonts/Baloo2-Bold.ttf'),
  'Nunito-Regular': require('@/assets/fonts/Nunito-Regular.ttf'),
  'Nunito-Bold': require('@/assets/fonts/Nunito-Bold.ttf'),
} as const;

export function useLoadedFonts() {
  return useExpoFonts(fontAssets);
}
