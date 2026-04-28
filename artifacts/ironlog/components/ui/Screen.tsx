import React from "react";
import { Platform, RefreshControlProps, ScrollView, StatusBar, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/contexts/ThemeContext";

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  noPadding?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  edges?: { top?: boolean; bottom?: boolean };
  /** Extra bottom padding to clear the floating tab bar. */
  tabBarSpacing?: boolean;
}

export function Screen({
  children,
  scroll = false,
  noPadding = false,
  style,
  contentStyle,
  refreshControl,
  edges = { top: true, bottom: true },
  tabBarSpacing = false,
}: ScreenProps) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const topInset = edges.top ? (isWeb ? Math.max(insets.top, 16) : insets.top) : 0;
  const baseBottom = edges.bottom ? (isWeb ? Math.max(insets.bottom, 16) : insets.bottom) : 0;
  const bottomInset = baseBottom + (tabBarSpacing ? 110 : 16);

  const horizontalPadding = noPadding ? 0 : 20;

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.bg,
    ...style,
  };

  const innerStyle: ViewStyle = {
    paddingTop: topInset + (noPadding ? 0 : 8),
    paddingBottom: bottomInset,
    paddingHorizontal: horizontalPadding,
    ...contentStyle,
  };

  if (scroll) {
    return (
      <View style={containerStyle}>
        <StatusBar barStyle={scheme === "dark" ? "light-content" : "dark-content"} />
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
      <StatusBar barStyle={scheme === "dark" ? "light-content" : "dark-content"} />
      <View style={[styles.flex, innerStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
