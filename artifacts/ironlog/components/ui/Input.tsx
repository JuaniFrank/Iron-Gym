import React, { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  rightAdornment?: React.ReactNode;
}

export function Input({
  label,
  error,
  hint,
  containerStyle,
  rightAdornment,
  style,
  ...rest
}: InputProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <Text variant="label" muted>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.secondary,
          borderRadius: colors.radius,
          borderWidth: 1,
          borderColor: error ? colors.destructive : focused ? colors.primary : "transparent",
          paddingHorizontal: 14,
          minHeight: 48,
        }}
      >
        <TextInput
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              color: colors.foreground,
              fontFamily: "Inter_500Medium",
            },
            style,
          ]}
        />
        {rightAdornment}
      </View>
      {error ? (
        <Text variant="caption" color={colors.destructive}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
});
