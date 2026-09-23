import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from "react";
import { useColorScheme } from "react-native";

import { useAppStore } from "@/src/state/appStore";
import { darkColors, lightColors, type ThemeColors } from "./tokens";

interface ThemeValue {
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeValue>({
  colors: darkColors,
  isDark: true,
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemTheme = useColorScheme();
  const preference = useAppStore((state) => state.profile?.theme ?? "system");
  const isDark =
    preference === "dark" ||
    (preference === "system" && systemTheme !== "light");
  const value = useMemo(
    () => ({ colors: isDark ? darkColors : lightColors, isDark }),
    [isDark],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
