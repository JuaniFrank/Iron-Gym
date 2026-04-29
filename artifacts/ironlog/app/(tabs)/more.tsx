import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { ACHIEVEMENTS } from "@/constants/achievements";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";

export default function MoreScreen() {
  const colors = useThemeColors();
  const { profile, achievements, goals } = useIronLog();
  const initials = profile.name.trim().slice(0, 1).toUpperCase() || "A";
  const activeGoals = goals.filter((g) => !g.completed).length;
  const totalAchievements = ACHIEVEMENTS.length;

  return (
    <Screen scroll noPadding tabBarSpacing>
      <Header title="Más" />
      <View style={{ paddingHorizontal: 20 }}>
        <Pressable onPress={() => router.push("/profile")} style={{ marginBottom: 18 }}>
          <Card padding={18}>
            <Row gap={14}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.ink,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text variant="h2" color={colors.bg}>
                  {initials}
                </Text>
              </View>
              <Col gap={4} flex={1}>
                <Text variant="h3">{profile.name}</Text>
                <Text variant="caption" muted>
                  {profile.weightKg.toFixed(1)} kg · {profile.heightCm} cm · {profile.age} años
                </Text>
              </Col>
              <Feather name="chevron-right" size={16} color={colors.muted} />
            </Row>
          </Card>
        </Pressable>

        <SectionLabel>ENTRENAMIENTO</SectionLabel>
        <Card padding={0} style={{ marginBottom: 18 }}>
          <MenuRow
            icon="calendar"
            label="Planificación semanal"
            onPress={() => router.push("/planning")}
          />
          <DividerInset />
          <MenuRow
            icon="target"
            label="Metas"
            badge={activeGoals > 0 ? String(activeGoals) : undefined}
            onPress={() => router.push("/goals")}
          />
          <DividerInset />
          <MenuRow
            icon="award"
            label="Logros"
            badge={
              achievements.length > 0
                ? `${achievements.length} / ${totalAchievements}`
                : undefined
            }
            onPress={() => router.push("/achievements")}
            last
          />
        </Card>

        <SectionLabel>CUERPO</SectionLabel>
        <Card padding={0} style={{ marginBottom: 18 }}>
          <MenuRow
            icon="trending-up"
            label="Peso, medidas y fotos"
            onPress={() => router.push("/body")}
            last
          />
        </Card>

        <SectionLabel>PREFERENCIAS</SectionLabel>
        <Card padding={0}>
          <MenuRow
            icon="sliders"
            label="Ajustes"
            onPress={() => router.push("/settings")}
            last
          />
        </Card>

        <Col gap={6} ai="center" style={{ marginTop: 32 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: colors.accentSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="zap" size={20} color={colors.accentEdge} />
          </View>
          <Text variant="tiny" color={colors.muted}>
            IRONLOG · V1.0
          </Text>
        </Col>
      </View>
    </Screen>
  );
}

function SectionLabel({ children }: { children: string }) {
  const colors = useThemeColors();
  return (
    <Text
      variant="tiny"
      color={colors.muted}
      style={{ paddingHorizontal: 4, paddingVertical: 10 }}
    >
      {children}
    </Text>
  );
}

function DividerInset() {
  return <Divider style={{ marginLeft: 60 }} />;
}

function MenuRow({
  icon,
  label,
  onPress,
  badge,
  last,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  badge?: string;
  last?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceAlt : "transparent",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: last ? 20 : 0,
        borderBottomRightRadius: last ? 20 : 0,
      })}
    >
      <Row jc="space-between">
        <Row gap={14}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              backgroundColor: colors.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name={icon} size={16} color={colors.ink} />
          </View>
          <Text variant="title">{label}</Text>
        </Row>
        <Row gap={8}>
          {badge ? (
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderRadius: 5,
                backgroundColor: colors.accent,
              }}
            >
              <Text variant="tiny" color={colors.accentInk}>
                {badge}
              </Text>
            </View>
          ) : null}
          <Feather name="chevron-right" size={14} color={colors.muted} />
        </Row>
      </Row>
    </Pressable>
  );
}
