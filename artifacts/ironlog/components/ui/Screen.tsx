import React from "react";
import { Platform, ScrollView, StyleSheet, View, ViewStyle, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors } from "@/contexts/ThemeContext";

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  noPadding?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  refreshControl?: React.ReactElement;
  edges?: { top?: boolean; bottom?: boolean };
}

export function Screen({
  children,
  scroll = false,
  noPadding = false,
  style,
  contentStyle,
  refreshControl,
  edges = { top: true, bottom: true },
}: ScreenProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const topInset = edges.top ? (isWeb ? Math.max(insets.top, 67) : insets.top) : 0;
  const bottomInset = edges.bottom ? (isWeb ? Math.max(insets.bottom, 100) : insets.bottom + 84) : 0;

  const padding = noPadding ? 0 : 16;

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.background,
    ...style,
  };

  const innerStyle: ViewStyle = {
    paddingTop: topInset + (noPadding ? 0 : 8),
    paddingBottom: bottomInset,
    paddingHorizontal: padding,
    ...contentStyle,
  };

  if (scroll) {
    return (
      <View style={containerStyle}>
        <StatusBar
          barStyle={colors.background === "#0A0A0A" ? "light-content" : "dark-content"}
        />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={innerStyle}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <StatusBar
        barStyle={colors.background === "#0A0A0A" ? "light-content" : "dark-content"}
      />
      <View style={[styles.flex, innerStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
