import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { useIronLog } from "@/contexts/IronLogContext";

type ColorScheme = "light" | "dark";

interface ThemeContextValue {
  scheme: ColorScheme;
  colors: typeof colors.light & { radius: number };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const { profile } = useIronLog();

  const scheme: ColorScheme = useMemo(() => {
    if (profile.theme === "light") return "light";
    if (profile.theme === "dark") return "dark";
    return systemScheme === "dark" ? "dark" : "light";
  }, [profile.theme, systemScheme]);

  const value = useMemo<ThemeContextValue>(() => {
    const palette = scheme === "dark" ? colors.dark : colors.light;
    return { scheme, colors: { ...palette, radius: colors.radius } };
  }, [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback to light if used outside provider (shouldn't happen)
    return { scheme: "light", colors: { ...colors.light, radius: colors.radius } };
  }
  return ctx;
}

export function useThemeColors() {
  return useTheme().colors;
}
