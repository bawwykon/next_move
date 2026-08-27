export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export const RARITY_BORDER: Record<Rarity, string> = {
  Common: '#A89F90',
  Rare: '#60A5FA',
  Epic: '#A78BFA',
  Legendary: '#FBBF24',
} as const;

export const RARITY_LABEL: Record<Rarity, string> = {
  Common: 'Common',
  Rare: 'Rare',
  Epic: 'Epic',
  Legendary: 'Legendary',
};

export function rarityFor(slug: string, fallback: string): Rarity {
  if (
    fallback === 'Common' ||
    fallback === 'Rare' ||
    fallback === 'Epic' ||
    fallback === 'Legendary'
  )
    return fallback as Rarity;
  // fallback mapping for older rows without rarity column
  if (['first-quest', 'first-level', 'first-week'].includes(slug)) return 'Common';
  if (['streak-7', 'workouts-50'].includes(slug)) return 'Rare';
  if (['streak-30', 'workouts-100', 'early-bird', 'night-owl'].includes(slug)) return 'Epic';
  return 'Legendary';
}
