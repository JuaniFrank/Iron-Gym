import { Feather } from "@expo/vector-icons";
import React from "react";
import { ScrollView, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
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
      <Header title="" back compact />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text variant="h1" style={{ marginBottom: 18, paddingHorizontal: 4 }}>
          Logros
        </Text>

        <View
          style={{
            backgroundColor: colors.ink,
            borderRadius: 24,
            padding: 22,
            marginBottom: 18,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              right: -40,
              bottom: -40,
              width: 180,
              height: 180,
              borderRadius: 999,
              backgroundColor: colors.accent,
              opacity: 0.15,
            }}
          />
          <Row gap={16} ai="center">
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="award" size={28} color={colors.accentInk} />
            </View>
            <Col gap={4}>
              <Row gap={4} ai="baseline">
                <Text variant="hero" color={colors.accent}>
                  {unlockedCount}
                </Text>
                <Text variant="h3" color="rgba(242,240,232,0.5)">
                  / {total}
                </Text>
              </Row>
              <Text variant="caption" color="rgba(242,240,232,0.65)">
                Logros desbloqueados
              </Text>
            </Col>
          </Row>
        </View>

        <Col gap={8}>
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedSet.has(a.id);
            return (
              <Card key={a.id} padding={0} style={{ opacity: unlocked ? 1 : 0.55 }}>
                <Row gap={14} style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: unlocked ? colors.accent : colors.surfaceAlt,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather
                      name={a.icon as keyof typeof Feather.glyphMap}
                      size={20}
                      color={unlocked ? colors.accentInk : colors.muted}
                    />
                  </View>
                  <Col gap={2} flex={1}>
                    <Text variant="title">{a.title}</Text>
                    <Text variant="caption" muted>
                      {a.description}
                    </Text>
                  </Col>
                  <Feather
                    name={unlocked ? "check-circle" : "lock"}
                    size={18}
                    color={unlocked ? colors.accentEdge : colors.muted}
                  />
                </Row>
              </Card>
            );
          })}
        </Col>
      </ScrollView>
    </Screen>
  );
}
