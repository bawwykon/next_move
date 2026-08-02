export const colors = {
  background: '#1A1712',
  surface: '#26211A',
  surfaceElevated: '#2F2920',
  text: '#F5F1E8',
  textMuted: '#A89F90',
  reward: '#FBBF24',
  rewardStrong: '#F59E0B',
  calm: '#2DD4BF',
  calmStrong: '#14B8A6',
  success: '#4ADE80',
  danger: '#F87171',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fonts = {
  display: {
    family: 'Baloo2-Bold',
    weight: '700',
  },
  body: {
    family: 'Nunito-Regular',
    weight: '400',
  },
  bodyBold: {
    family: 'Nunito-Bold',
    weight: '700',
  },
} as const;
