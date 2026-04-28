import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CelebrationOverlay } from "@/components/celebration/CelebrationOverlay";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { BigStat } from "@/components/ui/Stat";
import { Text } from "@/components/ui/Text";
import { ACHIEVEMENTS } from "@/constants/achievements";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { formatDuration } from "@/utils/date";

export default function WorkoutSummaryScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    sessionId: string;
    prs?: string;
    achievements?: string;
  }>();
  const { sessions, getExerciseById } = useIronLog();
  const session = sessions.find((s) => s.id === params.sessionId);

  const [celebrate, setCelebrate] = useState<{
    title: string;
    subtitle?: string;
    icon: any;
  } | null>(null);
  const [shownIds, setShownIds] = useState<string[]>([]);

  const newAchievements = (params.achievements ?? "").split(",").filter(Boolean);
  const newPrs = parseInt(params.prs ?? "0", 10);

  useEffect(() => {
    if (newPrs > 0 && !shownIds.includes("__pr")) {
      setCelebrate({
        title: `¡${newPrs} ${newPrs === 1 ? "récord nuevo" : "récords nuevos"}!`,
        subtitle: "Acabas de batir tus marcas anteriores.",
        icon: "trending-up",
      });
      setShownIds((s) => [...s, "__pr"]);
      return;
    }
    const next = newAchievements.find((id) => !shownIds.includes(id));
    if (next) {
      const ach = ACHIEVEMENTS.find((a) => a.id === next);
      if (ach) {
        setCelebrate({ title: ach.title, subtitle: ach.description, icon: ach.icon });
        setShownIds((s) => [...s, next]);
      }
    }
  }, [shownIds, newPrs, newAchievements]);

  if (!session) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title="Sesión no encontrada" />
      </Screen>
    );
  }

  const duration = (session.endedAt ?? Date.now()) - session.startedAt;
  const workSets = session.sets.filter((s) => !s.isWarmup);
  const totalReps = workSets.reduce((s, x) => s + x.reps, 0);
  const exercisesCount = new Set(session.sets.map((s) => s.exerciseId)).size;
  const startDate = new Date(session.startedAt);
  const dayName = startDate
    .toLocaleDateString("es-ES", { weekday: "long" })
    .toUpperCase();
  const time = startDate.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const exerciseIds = Array.from(new Set(session.sets.map((s) => s.exerciseId)));

  return (
    <Screen scroll noPadding>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 8 }}>
        <IconButton icon="x" onPress={() => router.replace("/")} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 120 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View
          style={{
            backgroundColor: colors.ink,
            borderRadius: 24,
            padding: 24,
            position: "relative",
            overflow: "hidden",
            marginBottom: 14,
          }}
        >
          <View
            style={{
              position: "absolute",
              right: -60,
              top: -60,
              width: 240,
              height: 240,
              borderRadius: 999,
              backgroundColor: colors.accent,
              opacity: 0.18,
            }}
          />
          <Row gap={10} style={{ marginBottom: 18 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="check" size={14} color={colors.accentInk} />
            </View>
            <Text variant="tiny" color={colors.accent}>
              SESIÓN COMPLETADA
            </Text>
          </Row>
          <Text variant="hero" color={colors.bg}>
            <Text variant="hero" color={colors.bg} italic style={{ fontWeight: "300" }}>
              {session.dayName}
            </Text>
            {"\n"}terminado.
          </Text>
          <Text variant="tiny" color="rgba(242,240,232,0.5)" style={{ marginTop: 16 }}>
            {time} · {formatDuration(duration).toUpperCase()} · {dayName}
          </Text>
        </View>

        {/* Stat grids */}
        <Row gap={8} style={{ marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <BigStat icon="clock" label="DURACIÓN" value={formatDuration(duration)} />
          </View>
          <View style={{ flex: 1 }}>
            <BigStat
              icon="bar-chart-2"
              label="VOLUMEN"
              value={Math.round(session.totalVolumeKg).toLocaleString()}
              sub="kg"
            />
          </View>
        </Row>
        <Row gap={8} style={{ marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <BigStat icon="layers" label="SETS" value={String(session.sets.length)} />
          </View>
          <View style={{ flex: 1 }}>
            <BigStat icon="repeat" label="REPS" value={String(totalReps)} />
          </View>
          <View style={{ flex: 1 }}>
            <BigStat icon="activity" label="EJERC." value={String(exercisesCount)} />
          </View>
        </Row>

        {/* PRs */}
        {session.prsAchieved.length > 0 ? (
          <Card variant="accent" style={{ marginBottom: 14 }}>
            <Row gap={10} style={{ marginBottom: 12 }}>
              <Feather name="trending-up" size={16} color={colors.accentEdge} />
              <Text variant="h3" color={colors.accentEdge}>
                {session.prsAchieved.length} récord
                {session.prsAchieved.length === 1 ? "" : "s"} personal
                {session.prsAchieved.length === 1 ? "" : "es"}
              </Text>
            </Row>
            {session.prsAchieved.map((pr, i) => (
              <React.Fragment key={pr.exerciseId}>
                {i > 0 ? (
                  <Divider color={colors.accentEdge} style={{ opacity: 0.3 }} />
                ) : null}
                <Row jc="space-between" style={{ paddingVertical: 10 }}>
                  <Text variant="label" weight="semibold">
                    {pr.exerciseName}
                  </Text>
                  <Row gap={8}>
                    <Text variant="mono" color={colors.ink} style={{ fontWeight: "600" }}>
                      {pr.value}
                      <Text variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
                        kg
                      </Text>
                    </Text>
                    {pr.previousValue ? (
                      <Text variant="tiny" color={colors.accentEdge}>
                        +{(pr.value - pr.previousValue).toFixed(1)}kg
                      </Text>
                    ) : null}
                  </Row>
                </Row>
              </React.Fragment>
            ))}
          </Card>
        ) : null}

        <Text
          variant="tiny"
          color={colors.muted}
          style={{ paddingHorizontal: 4, paddingVertical: 10 }}
        >
          RESUMEN POR EJERCICIO
        </Text>
        <Col gap={6}>
          {exerciseIds.map((exId) => {
            const ex = getExerciseById(exId);
            const sets = session.sets.filter((s) => s.exerciseId === exId && !s.isWarmup);
            const maxW = sets.reduce((m, s) => Math.max(m, s.weight), 0);
            const totalR = sets.reduce((s, x) => s + x.reps, 0);
            return (
              <Card key={exId} padding={0}>
                <Row jc="space-between" style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                  <Col gap={2}>
                    <Text variant="label" weight="semibold">
                      {ex?.name ?? "Ejercicio"}
                    </Text>
                    <Text variant="caption" muted>
                      {sets.length} sets · {totalR} reps
                    </Text>
                  </Col>
                  <Text variant="mono" color={colors.ink} style={{ fontSize: 14, fontWeight: "600" }}>
                    {maxW.toFixed(1)}
                    <Text variant="mono" color={colors.muted} style={{ fontSize: 10 }}>
                      kg
                    </Text>
                  </Text>
                </Row>
              </Card>
            );
          })}
        </Col>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: Math.max(insets.bottom, 16) + 6,
          left: 16,
          right: 16,
        }}
      >
        <Button
          label="Volver al inicio"
          icon="home"
          size="lg"
          fullWidth
          onPress={() => router.replace("/")}
        />
      </View>

      <CelebrationOverlay
        visible={!!celebrate}
        title={celebrate?.title ?? ""}
        subtitle={celebrate?.subtitle}
        icon={celebrate?.icon ?? "award"}
        onClose={() => setCelebrate(null)}
      />
    </Screen>
  );
}
