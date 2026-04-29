import { Feather } from "@expo/vector-icons";
import React from "react";
import { View, ViewStyle } from "react-native";

import { Card } from "@/components/ui/Card";
import { Col } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface StatProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  align?: "left" | "center" | "right";
  highlight?: boolean;
  style?: ViewStyle;
}

/** Inline column stat — TINY label, monoLg value, optional caption sub. */
export function Stat({ label, value, sub, align = "left", highlight, style }: StatProps) {
  const colors = useThemeColors();
  const ai = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
  return (
    <Col gap={4} ai={ai} style={style}>
      <Text variant="tiny" color={colors.muted}>
        {label}
      </Text>
      {typeof value === "string" || typeof value === "number" ? (
        <View
          style={{
            backgroundColor: highlight ? colors.accent : "transparent",
            paddingHorizontal: highlight ? 6 : 0,
            borderRadius: 4,
          }}
        >
          <Text variant="monoLg" color={colors.ink}>
            {value}
          </Text>
        </View>
      ) : (
        value
      )}
      {sub ? (
        <Text variant="caption" muted>
          {sub}
        </Text>
      ) : null}
    </Col>
  );
}

interface BigStatProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  sub?: string;
}

/** Centered stat tile used in workout summary grids. */
export function BigStat({ icon, label, value, sub }: BigStatProps) {
  const colors = useThemeColors();
  return (
    <Card padding={14} style={{ alignItems: "center", gap: 6 }}>
      <Feather name={icon} size={14} color={colors.muted} />
      <Text variant="mono" color={colors.ink} style={{ fontSize: 18, fontWeight: "600" }}>
        {value}
        {sub ? (
          <Text variant="caption" muted>
            {sub}
          </Text>
        ) : null}
      </Text>
      <Text variant="tiny" color={colors.muted}>
        {label}
      </Text>
    </Card>
  );
}
