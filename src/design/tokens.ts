export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = { sm: 10, md: 16, lg: 20, pill: 999 } as const;
export const motion = { quick: 140, standard: 220, deliberate: 320 } as const;

export const lightColors = {
  background: '#F7F5EF',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEDE6',
  text: '#17201C',
  textMuted: '#65716B',
  primary: '#087F5B',
  primaryPressed: '#066548',
  primarySoft: '#DDF2E9',
  income: '#087F5B',
  expense: '#B5473C',
  warning: '#A35C00',
  warningSoft: '#FFF1D6',
  danger: '#B42318',
  dangerSoft: '#FEE4E2',
  info: '#2563EB',
  border: '#DDDCD5',
  overlay: 'rgba(10, 20, 16, 0.42)',
  tabInactive: '#747D78',
  white: '#FFFFFF',
} as const;

export const darkColors: Record<keyof typeof lightColors, string> = {
  background: '#101513',
  surface: '#19201D',
  surfaceMuted: '#242C28',
  text: '#F3F5F4',
  textMuted: '#AAB5AF',
  primary: '#45C99A',
  primaryPressed: '#6BD7B0',
  primarySoft: '#173B2F',
  income: '#5DD1A7',
  expense: '#FF8A7E',
  warning: '#F5B55A',
  warningSoft: '#3B2D17',
  danger: '#FF8A7E',
  dangerSoft: '#41211E',
  info: '#78A7FF',
  border: '#344039',
  overlay: 'rgba(0, 0, 0, 0.68)',
  tabInactive: '#95A19B',
  white: '#FFFFFF',
};

export type ThemeColors = Record<keyof typeof lightColors, string>;
