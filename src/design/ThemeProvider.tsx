import { createContext, type PropsWithChildren, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from './tokens';
import { useAppStore } from '@/src/state/appStore';

interface ThemeValue {
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeValue>({ colors: lightColors, isDark: false });

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const preference = useAppStore((state) => state.profile?.theme ?? 'system');
  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark');
  const value = useMemo(() => ({ colors: isDark ? darkColors : lightColors, isDark }), [isDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
