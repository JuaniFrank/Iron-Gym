import React, { createContext, useContext, useEffect, useMemo } from "react";
import { Platform, useColorScheme } from "react-native";

import colors, { type ThemePalette } from "@/constants/colors";
import { useUserProfile } from "@/domains/profile/queries";

type ColorScheme = "light" | "dark";

interface ThemeContextValue {
  scheme: ColorScheme;
  colors: ThemePalette & { radius: number };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const profile = useUserProfile();

  const scheme: ColorScheme = useMemo(() => {
    if (profile.theme === "light") return "light";
    if (profile.theme === "dark") return "dark";
    return systemScheme === "dark" ? "dark" : "light";
  }, [profile.theme, systemScheme]);

  const value = useMemo<ThemeContextValue>(() => {
    const palette = scheme === "dark" ? colors.dark : colors.light;
    return { scheme, colors: { ...palette, radius: colors.radius } };
  }, [scheme]);

  // Web only: keep the document background in sync with the theme so the
  // safe-area / overscroll / home-indicator areas never flash a different colour.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.documentElement.style.setProperty("--app-bg", value.colors.bg);
  }, [value.colors.bg]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { scheme: "light", colors: { ...colors.light, radius: colors.radius } };
  }
  return ctx;
}

export function useThemeColors() {
  return useTheme().colors;
}
