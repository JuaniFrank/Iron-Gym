import { Feather } from "@expo/vector-icons";
import React from "react";
import { ScrollView, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { ACHIEVEMENTS } from "@/constants/achievements";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";

export default function AchievementsScreen() {
  const colors = useThemeColors();
  const { achievements } = useIronLog();
  const unlockedSet = new Set(achievements.map((a) => a.id));

  const unlockedCount = achievements.length;
  const total = ACHIEVEMENTS.length;

  return (
    <Screen noPadding>
      <Header title="Logros" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card style={{ backgroundColor: colors.accent, borderColor: colors.primary }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="award" size={28} color="#FFFFFF" />
            </View>
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text variant="h2" color={colors.primary}>
                {unlockedCount} / {total}
              </Text>
              <Text variant="caption" color={colors.accentForeground}>
                Logros desbloqueados
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ gap: 8 }}>
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedSet.has(a.id);
            return (
              <Card key={a.id} style={{ opacity: unlocked ? 1 : 0.6 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: unlocked ? colors.primary : colors.secondary,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Feather
                      name={a.icon as any}
                      size={20}
                      color={unlocked ? "#FFFFFF" : colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="title">{a.title}</Text>
                    <Text variant="caption" muted>
                      {a.description}
                    </Text>
                  </View>
                  {unlocked ? (
                    <Feather name="check-circle" size={20} color={colors.primary} />
                  ) : (
                    <Feather name="lock" size={18} color={colors.mutedForeground} />
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
