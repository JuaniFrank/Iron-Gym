import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

interface TabBarProps {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  navigation: {
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

const TABS = [
  { name: "index", title: "INICIO", icon: "home" as const },
  { name: "workout", title: "ENTRENAR", icon: "zap" as const },
  { name: "progress", title: "PROGRESO", icon: "trending-up" as const },
  { name: "nutrition", title: "NUTRICIÓN", icon: "pie-chart" as const },
  { name: "more", title: "MÁS", icon: "grid" as const },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...(props as unknown as TabBarProps)} />}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
    </Tabs>
  );
}

function FloatingTabBar({ state, navigation }: TabBarProps) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = scheme === "dark";

  const bottom = Math.max(insets.bottom, 14) + 8;

  const content = (
    <View style={styles.row}>
      {state.routes.map((route, idx) => {
        const isFocused = state.index === idx;
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            navigation.navigate(route.name);
          }
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={4}
          >
            <Feather
              name={tab.icon}
              size={20}
              color={isFocused ? colors.ink : colors.muted}
            />
            <Text
              variant="tiny"
              color={isFocused ? colors.ink : colors.muted}
              style={{ fontSize: 9, letterSpacing: 1 }}
            >
              {tab.title}
            </Text>
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                marginTop: 1,
                backgroundColor: isFocused ? colors.accent : "transparent",
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );

  const tint: "dark" | "light" = isDark ? "dark" : "light";

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={60}
          tint={tint}
          style={[
            styles.shell,
            {
              borderColor: colors.border,
              backgroundColor: isDark ? "rgba(26,26,24,0.55)" : "rgba(255,255,255,0.55)",
            },
          ]}
        >
          {content}
        </BlurView>
      ) : (
        <View
          style={[
            styles.shell,
            {
              borderColor: colors.border,
              backgroundColor: isDark ? "rgba(26,26,24,0.94)" : "rgba(255,255,255,0.94)",
            },
          ]}
        >
          {content}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
  },
  shell: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 4,
  },
});
