import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface HeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  large?: boolean;
}

export function Header({ title, subtitle, back, onBack, right, large = false }: HeaderProps) {
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
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: topInset + 8,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.side}>
          {back ? (
            <Pressable
              onPress={handleBack}
              hitSlop={12}
              style={({ pressed }) => [
                styles.backBtn,
                {
                  backgroundColor: colors.secondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="chevron-left" size={22} color={colors.foreground} />
            </Pressable>
          ) : null}
        </View>

        {!large && (
          <View style={styles.center}>
            <Text variant="title" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="caption" muted numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        )}

        <View style={[styles.side, { alignItems: "flex-end" }]}>{right}</View>
      </View>

      {large && (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          <Text variant="h1">{title}</Text>
          {subtitle ? (
            <Text variant="body" muted style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  side: {
    width: 80,
    flexDirection: "row",
    alignItems: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
