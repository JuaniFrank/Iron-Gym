import React, { useState } from "react";
import {
  Platform,
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
  /** Use a tiny uppercase mono label inside the field, like the redesign Field. */
  fieldLabel?: string;
  suffix?: string;
}

export function Input({
  label,
  error,
  hint,
  containerStyle,
  rightAdornment,
  fieldLabel,
  suffix,
  style,
  ...rest
}: InputProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <Text variant="tiny" color={colors.muted}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: error ? colors.danger : focused ? colors.borderStrong : colors.border,
          paddingHorizontal: 14,
          paddingVertical: fieldLabel ? 8 : 0,
          minHeight: fieldLabel ? 56 : 48,
          justifyContent: "center",
        }}
      >
        {fieldLabel ? (
          <Text variant="tiny" color={colors.muted} style={{ marginBottom: 2 }}>
            {fieldLabel}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
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
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                color: colors.ink,
                fontFamily: fieldLabel
                  ? Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
                  : "Inter_500Medium",
              },
              style,
            ]}
          />
          {suffix ? (
            <Text variant="caption" color={colors.muted} style={{ marginLeft: 6 }}>
              {suffix}
            </Text>
          ) : null}
          {rightAdornment}
        </View>
      </View>
      {error ? (
        <Text variant="caption" color={colors.danger}>
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
    fontSize: 16,
    paddingVertical: 8,
  },
});
