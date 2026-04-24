import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";

export default function MoreScreen() {
  const colors = useThemeColors();
  const { profile, achievements, goals } = useIronLog();

  return (
    <Screen scroll>
      <View style={{ marginBottom: 16 }}>
        <Text variant="h1">Más</Text>
      </View>

      {/* Profile card */}
      <Pressable onPress={() => router.push("/profile")}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
              }}
            >
              <Text variant="h2" color="#FFFFFF">
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h3">{profile.name}</Text>
              <Text variant="caption" muted>
                {profile.weightKg.toFixed(1)} kg · {profile.heightCm} cm · {profile.age} años
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </View>
        </Card>
      </Pressable>

      <View style={{ marginTop: 24 }}>
        <Text variant="tiny" muted style={{ marginBottom: 8, paddingHorizontal: 4 }}>
          ENTRENAMIENTO
        </Text>
        <View style={{ gap: 1, borderRadius: colors.radius, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <MenuRow icon="calendar" label="Planificación semanal" onPress={() => router.push("/planning")} />
          <Separator />
          <MenuRow
            icon="target"
            label="Metas"
            badge={goals.filter((g) => !g.completed).length || undefined}
            onPress={() => router.push("/goals")}
          />
          <Separator />
          <MenuRow
            icon="award"
            label="Logros"
            badge={achievements.length || undefined}
            onPress={() => router.push("/achievements")}
          />
        </View>
      </View>

      <View style={{ marginTop: 24 }}>
        <Text variant="tiny" muted style={{ marginBottom: 8, paddingHorizontal: 4 }}>
          CUERPO
        </Text>
        <View style={{ gap: 1, borderRadius: colors.radius, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <MenuRow icon="trending-up" label="Peso, medidas y fotos" onPress={() => router.push("/body")} />
        </View>
      </View>

      <View style={{ marginTop: 24 }}>
        <Text variant="tiny" muted style={{ marginBottom: 8, paddingHorizontal: 4 }}>
          PREFERENCIAS
        </Text>
        <View style={{ gap: 1, borderRadius: colors.radius, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <MenuRow icon="settings" label="Ajustes" onPress={() => router.push("/settings")} />
        </View>
      </View>

      <View style={{ marginTop: 32, alignItems: "center" }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <Feather name="zap" size={20} color={colors.primary} />
        </View>
        <Text variant="caption" muted>
          IronLog · v1.0
        </Text>
      </View>
    </Screen>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  badge,
  destructive,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
  destructive?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.secondary : "transparent",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: colors.secondary,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Feather
          name={icon}
          size={16}
          color={destructive ? colors.destructive : colors.foreground}
        />
      </View>
      <Text variant="title" style={{ flex: 1 }} color={destructive ? colors.destructive : colors.foreground}>
        {label}
      </Text>
      {badge ? (
        <View
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 6,
            marginRight: 8,
          }}
        >
          <Text variant="tiny" color="#FFFFFF" weight="bold">
            {badge}
          </Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

function Separator() {
  const colors = useThemeColors();
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 60 }} />;
}
