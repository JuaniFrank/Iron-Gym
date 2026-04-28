import React from "react";
import { View } from "react-native";

import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { MUSCLE_GROUP_LABELS } from "@/constants/exercises";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { MuscleGroup, VolumeTarget } from "@/types";
import { volumeZone, type VolumeZone } from "@/utils/volume";

interface MuscleVolumeBarProps {
  muscle: MuscleGroup;
  sets: number;
  target: VolumeTarget;
}

export function MuscleVolumeBar({ muscle, sets, target }: MuscleVolumeBarProps) {
  const colors = useThemeColors();

  const zone = volumeZone(sets, target);
  const fillColor = zoneColor(zone, colors);
  const zoneLabel = ZONE_LABELS[zone];

  // Scale: bar represents 0 → max(MRV, sets) so excess is visible without overflow.
  const scaleMax = Math.max(target.mrv, sets, 1);
  const fillPct = clamp01(sets / scaleMax);
  const mevPct = clamp01(target.mev / scaleMax);
  const mavPct = clamp01(target.mav / scaleMax);
  const mrvPct = clamp01(target.mrv / scaleMax);

  return (
    <Col gap={6} style={{ paddingVertical: 8 }}>
      <Row jc="space-between" ai="baseline">
        <Text variant="label" weight="semibold">
          {MUSCLE_GROUP_LABELS[muscle]}
        </Text>
        <Row gap={6} ai="baseline">
          <Text variant="mono" color={colors.ink} style={{ fontSize: 13, fontWeight: "600" }}>
            {formatSets(sets)}
            <Text variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
              {" "}/ {target.mav}
            </Text>
          </Text>
        </Row>
      </Row>

      {/* Track + fill + markers */}
      <View
        style={{
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.surfaceAlt,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Soft accent band between MEV and MAV — the "good zone" */}
        <View
          style={{
            position: "absolute",
            left: `${mevPct * 100}%`,
            width: `${(mavPct - mevPct) * 100}%`,
            top: 0,
            bottom: 0,
            backgroundColor: colors.accentSoft,
            opacity: 0.6,
          }}
        />

        {/* Filled portion */}
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${fillPct * 100}%`,
            backgroundColor: fillColor,
            borderRadius: 5,
          }}
        />

        {/* Markers */}
        {target.mev > 0 ? (
          <Marker leftPct={mevPct * 100} color={colors.borderStrong} />
        ) : null}
        <Marker leftPct={mavPct * 100} color={colors.borderStrong} />
        <Marker leftPct={mrvPct * 100} color={colors.danger} />
      </View>

      <Text variant="tiny" color={zoneLabelColor(zone, colors)}>
        {zoneLabel}
      </Text>
    </Col>
  );
}

function Marker({ leftPct, color }: { leftPct: number; color: string }) {
  return (
    <View
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: color,
        opacity: 0.5,
      }}
    />
  );
}

const ZONE_LABELS: Record<VolumeZone, string> = {
  below: "BAJO MÍNIMO EFECTIVO",
  effective: "ZONA EFECTIVA",
  overload: "SOBRECARGA",
  excess: "EXCESO · POSIBLE FATIGA",
};

function zoneColor(
  zone: VolumeZone,
  colors: ReturnType<typeof useThemeColors>,
): string {
  switch (zone) {
    case "below":
      return colors.borderStrong;
    case "effective":
      return colors.ok;
    case "overload":
      return colors.warning;
    case "excess":
      return colors.danger;
  }
}

function zoneLabelColor(
  zone: VolumeZone,
  colors: ReturnType<typeof useThemeColors>,
): string {
  switch (zone) {
    case "below":
      return colors.muted;
    case "effective":
      return colors.ok;
    case "overload":
      return colors.warning;
    case "excess":
      return colors.danger;
  }
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function formatSets(n: number): string {
  // Half-set granularity matches our 0.5 weighting for secondary muscles.
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}
