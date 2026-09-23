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
  background: "#F8F5FF",
  surface: "#FFFFFF",
  surfaceMuted: "#EEE7FF",
  text: "#211334",
  textMuted: "#6E617F",
  primary: "#7651D6",
  primaryPressed: "#603CBF",
  primarySoft: "#E9DEFF",
  income: "#138A62",
  expense: "#D84E55",
  warning: "#A96800",
  warningSoft: "#FFF0CE",
  danger: "#C93E4A",
  dangerSoft: "#FFE4E7",
  info: "#376FC8",
  border: "#D8CCED",
  overlay: "rgba(31, 16, 51, 0.48)",
  tabInactive: "#837693",
  white: "#FFFFFF",
} as const;

export const darkColors: Record<keyof typeof lightColors, string> = {
  background: "#170B2B",
  surface: "#2B1648",
  surfaceMuted: "#3A205D",
  text: "#FCFAFF",
  textMuted: "#C7BBDB",
  primary: "#9A6BFF",
  primaryPressed: "#8254E8",
  primarySoft: "#3B2561",
  income: "#46D9A0",
  expense: "#FF7B72",
  warning: "#F4B860",
  warningSoft: "#49351D",
  danger: "#FF7B72",
  dangerSoft: "#4A2335",
  info: "#66A3FF",
  border: "#51337D",
  overlay: "rgba(7, 2, 15, 0.72)",
  tabInactive: "#A798BD",
  white: "#FFFFFF",
};

export type ThemeColors = Record<keyof typeof lightColors, string>;
