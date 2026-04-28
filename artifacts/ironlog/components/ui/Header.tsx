import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  /** When true, render the title as a large h1 below a thin nav row. */
  large?: boolean;
  style?: ViewStyle;
  /** Hide the back button slot when neither back nor right is needed. */
  compact?: boolean;
}

export function Header({
  title,
  subtitle,
  back,
  onBack,
  right,
  large = true,
  style,
  compact = false,
}: HeaderProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? Math.max(insets.top, 16) : insets.top;

  const handleBack = () => {
    onBack?.();
    if (router.canGoBack()) router.back();
  };

  return (
    <View
      style={[
        {
          paddingHorizontal: 20,
          paddingTop: topInset + 8,
          paddingBottom: large ? 4 : 8,
          backgroundColor: colors.bg,
        },
        style,
      ]}
    >
      {!compact && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 36,
            marginBottom: large ? 14 : 6,
          }}
        >
          {back ? (
            <Pressable
              onPress={handleBack}
              hitSlop={12}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Feather name="chevron-left" size={18} color={colors.ink} />
            </Pressable>
          ) : (
            <View style={{ width: 36, height: 36 }} />
          )}

          <View style={{ flex: 1 }} />

          {right ?? <View style={{ width: 36, height: 36 }} />}
        </View>
      )}

      {large ? (
        <View>
          {title ? <Text variant="h1">{title}</Text> : null}
          {subtitle ? (
            <Text variant="body" muted style={{ marginTop: 4 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : title ? (
        <View style={{ alignItems: "center" }}>
          <Text variant="title">{title}</Text>
          {subtitle ? (
            <Text variant="caption" muted>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
