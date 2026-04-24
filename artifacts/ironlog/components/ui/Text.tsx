import React from "react";
import { Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native";

import { useThemeColors } from "@/contexts/ThemeContext";

type Variant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "title"
  | "body"
  | "label"
  | "caption"
  | "tiny"
  | "mono";

interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  weight?: "regular" | "medium" | "semibold" | "bold";
}

const fontByWeight: Record<NonNullable<TextProps["weight"]>, string> = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

export function Text({
  variant = "body",
  color,
  muted,
  weight,
  style,
  children,
  ...rest
}: TextProps) {
  const colors = useThemeColors();

  const variantStyle: TextStyle = (() => {
    switch (variant) {
      case "display":
        return { fontSize: 48, lineHeight: 52, fontFamily: fontByWeight.bold, letterSpacing: -1.2 };
      case "h1":
        return { fontSize: 32, lineHeight: 38, fontFamily: fontByWeight.bold, letterSpacing: -0.8 };
      case "h2":
        return { fontSize: 24, lineHeight: 30, fontFamily: fontByWeight.bold, letterSpacing: -0.4 };
      case "h3":
        return { fontSize: 20, lineHeight: 26, fontFamily: fontByWeight.semibold, letterSpacing: -0.2 };
      case "title":
        return { fontSize: 17, lineHeight: 22, fontFamily: fontByWeight.semibold };
      case "body":
        return { fontSize: 15, lineHeight: 21, fontFamily: fontByWeight.regular };
      case "label":
        return { fontSize: 13, lineHeight: 17, fontFamily: fontByWeight.medium };
      case "caption":
        return { fontSize: 12, lineHeight: 16, fontFamily: fontByWeight.regular };
      case "tiny":
        return { fontSize: 10, lineHeight: 14, fontFamily: fontByWeight.medium, letterSpacing: 0.5, textTransform: "uppercase" };
      case "mono":
        return { fontSize: 15, fontFamily: fontByWeight.semibold, fontVariant: ["tabular-nums"] };
    }
  })();

  const finalColor = color ?? (muted ? colors.mutedForeground : colors.foreground);

  return (
    <RNText
      style={[variantStyle, { color: finalColor }, weight ? { fontFamily: fontByWeight[weight] } : null, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
