import React from "react";
import { Platform, Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native";

import { useThemeColors } from "@/contexts/ThemeContext";

type Variant =
  | "display"
  | "hero"
  | "h1"
  | "h2"
  | "h3"
  | "title"
  | "body"
  | "label"
  | "caption"
  | "tiny"
  | "mono"
  | "monoLg";

interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  weight?: "regular" | "medium" | "semibold" | "bold";
  italic?: boolean;
}

const fontByWeight: Record<NonNullable<TextProps["weight"]>, string> = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

// Platform-default monospace — gives JetBrains Mono-ish numerals via tabular-nums.
const MONO_FAMILY = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string;

export function Text({
  variant = "body",
  color,
  muted,
  weight,
  italic,
  style,
  children,
  ...rest
}: TextProps) {
  const colors = useThemeColors();

  const variantStyle: TextStyle = (() => {
    switch (variant) {
      case "display":
        // Editorial display (hero numerals e.g. rest timer, body fat %)
        return {
          fontSize: 56,
          lineHeight: 60,
          fontFamily: fontByWeight.regular,
          letterSpacing: -2,
          fontStyle: "italic",
        };
      case "hero":
        return { fontSize: 40, lineHeight: 44, fontFamily: fontByWeight.medium, letterSpacing: -1.6 };
      case "h1":
        return { fontSize: 30, lineHeight: 34, fontFamily: fontByWeight.semibold, letterSpacing: -0.9 };
      case "h2":
        return { fontSize: 22, lineHeight: 26, fontFamily: fontByWeight.semibold, letterSpacing: -0.4 };
      case "h3":
        return { fontSize: 18, lineHeight: 24, fontFamily: fontByWeight.semibold, letterSpacing: -0.2 };
      case "title":
        return { fontSize: 16, lineHeight: 20, fontFamily: fontByWeight.semibold, letterSpacing: -0.1 };
      case "body":
        return { fontSize: 15, lineHeight: 22, fontFamily: fontByWeight.regular };
      case "label":
        return { fontSize: 13, lineHeight: 18, fontFamily: fontByWeight.medium };
      case "caption":
        return { fontSize: 12, lineHeight: 16, fontFamily: fontByWeight.regular };
      case "tiny":
        return {
          fontSize: 10,
          lineHeight: 12,
          fontFamily: MONO_FAMILY,
          fontWeight: "500",
          letterSpacing: 1.2,
          textTransform: "uppercase",
        };
      case "mono":
        return {
          fontSize: 14,
          lineHeight: 18,
          fontFamily: MONO_FAMILY,
          fontWeight: "500",
          fontVariant: ["tabular-nums"],
          letterSpacing: -0.2,
        };
      case "monoLg":
        return {
          fontSize: 26,
          lineHeight: 30,
          fontFamily: MONO_FAMILY,
          fontWeight: "600",
          fontVariant: ["tabular-nums"],
          letterSpacing: -0.6,
        };
    }
  })();

  const finalColor = color ?? (muted ? colors.muted : colors.ink);

  return (
    <RNText
      style={[
        variantStyle,
        { color: finalColor },
        weight ? { fontFamily: fontByWeight[weight] } : null,
        italic ? { fontStyle: "italic" } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
