import React from "react";
import { View, ViewProps, ViewStyle } from "react-native";

interface StackProps extends ViewProps {
  gap?: number;
  ai?: ViewStyle["alignItems"];
  jc?: ViewStyle["justifyContent"];
  flex?: number;
  wrap?: boolean;
  style?: ViewStyle;
}

export function Row({
  gap = 8,
  ai = "center",
  jc = "flex-start",
  flex,
  wrap,
  style,
  children,
  ...rest
}: StackProps) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: ai,
          justifyContent: jc,
          gap,
          flex,
          flexWrap: wrap ? "wrap" : "nowrap",
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

export function Col({
  gap = 8,
  ai,
  jc,
  flex,
  style,
  children,
  ...rest
}: StackProps) {
  return (
    <View
      style={[
        {
          flexDirection: "column",
          alignItems: ai,
          justifyContent: jc,
          gap,
          flex,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
