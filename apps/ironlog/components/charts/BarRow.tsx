import React from "react";
import { View } from "react-native";

import { ProgressBar } from "@/components/ui/ProgressBar";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface BarRowProps {
  label: string;
  value: number;
  max: number;
  color?: string;
  format?: (v: number) => string;
  unit?: string;
}

export function BarRow({ label, value, max, color, format = (v) => v.toFixed(0), unit = "g" }: BarRowProps) {
  const colors = useThemeColors();
  return (
    <Col gap={3}>
      <Row jc="space-between">
        <Text variant="caption" color={colors.muted}>
          {label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Text variant="mono" color={colors.ink} style={{ fontSize: 11 }}>
            {format(value)}
          </Text>
          <Text variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
            /{format(max)}
            {unit}
          </Text>
        </View>
      </Row>
      <ProgressBar value={value} max={max} color={color ?? colors.ink} height={3} />
    </Col>
  );
}
