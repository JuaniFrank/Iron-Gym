import { useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { Dimensions, ScrollView, View } from "react-native";

import { LineChart } from "@/components/charts/LineChart";
import { NoteCard } from "@/components/notes/NoteCard";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { EXERCISE_TYPE_LABELS, MUSCLE_GROUP_LABELS } from "@/constants/exercises";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { formatWeight } from "@/utils/calculations";
import { formatDateShort, formatRelativeDate } from "@/utils/date";

export default function ExerciseDetailScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ id: string }>();
  const { sessions, getExerciseById, profile, getNotesForExercise } = useIronLog();
  const ex = getExerciseById(params.id);
  const exerciseNotes = ex
    ? getNotesForExercise(ex.id)
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
    : [];
  const screenWidth = Dimensions.get("window").width - 76;

  const data = useMemo(() => {
    if (!ex) return [];
    const points: { x: number; y: number }[] = [];
    for (const s of sessions.filter((x) => x.endedAt)) {
      const sets = s.sets.filter((set) => set.exerciseId === ex.id && !set.isWarmup);
      if (sets.length === 0) continue;
      const maxWeight = Math.max(...sets.map((set) => set.weight));
      points.push({ x: s.endedAt!, y: maxWeight });
    }
    return points.sort((a, b) => a.x - b.x);
  }, [sessions, ex]);

  if (!ex) {
    return (
      <Screen noPadding>
        <Header title="Ejercicio" back />
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <EmptyState icon="alert-circle" title="No encontrado" />
        </View>
      </Screen>
    );
  }

  const allSets = sessions
    .filter((s) => s.endedAt)
    .flatMap((s) => s.sets.filter((set) => set.exerciseId === ex.id && !set.isWarmup));
  const maxWeight = allSets.reduce((m, s) => Math.max(m, s.weight), 0);
  const totalVolume = allSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const totalReps = allSets.reduce((s, x) => s + x.reps, 0);

  const recentSessions = sessions
    .filter((s) => s.endedAt && s.sets.some((set) => set.exerciseId === ex.id))
    .slice(-5)
    .reverse();

  // 6-month delta for header.
  const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const earlierMax = data
    .filter((d) => d.x < sixMonthsAgo)
    .reduce((m, d) => Math.max(m, d.y), 0);
  const latestMax = data.length > 0 ? data[data.length - 1]!.y : 0;
  const sixMonthDelta = earlierMax > 0 ? latestMax - earlierMax : 0;

  return (
    <Screen noPadding>
      <Header title="" back compact />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Col gap={4} style={{ marginBottom: 14, paddingHorizontal: 4 }}>
          <Text variant="tiny" color={colors.muted}>
            {EXERCISE_TYPE_LABELS[ex.type].toUpperCase()} ·{" "}
            {MUSCLE_GROUP_LABELS[ex.primaryMuscle].toUpperCase()}
          </Text>
          <Text variant="h1">{ex.name}</Text>
        </Col>
        <Text variant="body" muted style={{ marginBottom: 18, paddingHorizontal: 4 }}>
          {ex.description}
        </Text>

        <Row gap={8} style={{ marginBottom: 14 }}>
          <Card padding={14} style={{ flex: 1 }}>
            <Text variant="tiny" color={colors.muted}>
              RÉCORD
            </Text>
            <Text variant="monoLg" style={{ marginTop: 6 }}>
              {maxWeight > 0
                ? `${maxWeight}`
                : "—"}
              {maxWeight > 0 ? (
                <Text variant="caption" muted>
                  {" "}kg
                </Text>
              ) : null}
            </Text>
          </Card>
          <Card padding={14} style={{ flex: 1 }}>
            <Text variant="tiny" color={colors.muted}>
              VOLUMEN
            </Text>
            <Text variant="monoLg" style={{ marginTop: 6 }}>
              {(totalVolume / 1000).toFixed(1)}
              <Text variant="caption" muted>
                {" "}t
              </Text>
            </Text>
          </Card>
          <Card padding={14} style={{ flex: 1 }}>
            <Text variant="tiny" color={colors.muted}>
              REPS
            </Text>
            <Text variant="monoLg" style={{ marginTop: 6 }}>
              {totalReps.toLocaleString()}
            </Text>
          </Card>
        </Row>

        <Card style={{ marginBottom: 14 }}>
          <Row jc="space-between" style={{ marginBottom: 8 }}>
            <Text variant="h3">Progreso de peso máximo</Text>
            {sixMonthDelta > 0 ? (
              <Text variant="tiny" color={colors.ok}>
                +{sixMonthDelta.toFixed(1)}kg / 6 meses
              </Text>
            ) : null}
          </Row>
          {data.length > 1 ? (
            <LineChart
              data={data.map((d, i) => ({ x: i, y: d.y }))}
              width={screenWidth}
              height={110}
            />
          ) : (
            <Text variant="body" muted style={{ textAlign: "center", paddingVertical: 24 }}>
              Necesitas al menos 2 sesiones para ver el gráfico
            </Text>
          )}
        </Card>

        <Card>
          <Text variant="h3" style={{ marginBottom: 14 }}>
            Historial reciente
          </Text>
          {recentSessions.length === 0 ? (
            <Text variant="body" muted style={{ textAlign: "center", paddingVertical: 12 }}>
              Sin sesiones registradas
            </Text>
          ) : (
            <Col gap={0}>
              {recentSessions.map((s, i) => {
                const sets = s.sets.filter((x) => x.exerciseId === ex.id && !x.isWarmup);
                const max = sets.reduce((m, x) => Math.max(m, x.weight), 0);
                return (
                  <React.Fragment key={s.id}>
                    {i > 0 ? <Divider /> : null}
                    <Row jc="space-between" style={{ paddingVertical: 10 }}>
                      <Col gap={2}>
                        <Text variant="label" weight="semibold">
                          {formatDateShort(s.endedAt!)}
                        </Text>
                        <Text variant="caption" muted>
                          {sets.length} sets · {formatRelativeDate(s.endedAt!)}
                        </Text>
                      </Col>
                      <Text variant="mono" color={colors.ink} style={{ fontSize: 15, fontWeight: "600" }}>
                        {formatWeight(max, profile.units)}
                      </Text>
                    </Row>
                  </React.Fragment>
                );
              })}
            </Col>
          )}
        </Card>

        {exerciseNotes.length > 0 ? (
          <Card style={{ marginTop: 16 }}>
            <Text variant="caption" color={colors.muted} style={{ marginBottom: 10 }}>
              NOTAS HISTÓRICAS · {exerciseNotes.length}
            </Text>
            <Col gap={6}>
              {exerciseNotes.slice(0, 20).map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  showDate
                  relativeDate
                />
              ))}
            </Col>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
