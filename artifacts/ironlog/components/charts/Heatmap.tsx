import React from "react";
import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { useThemeColors } from "@/contexts/ThemeContext";
import { dateKey } from "@/utils/date";

interface HeatmapProps {
  trainedDates: number[]; // timestamps
  weeks?: number;
  cellSize?: number;
  cellGap?: number;
}

export function Heatmap({
  trainedDates,
  weeks = 18,
  cellSize = 14,
  cellGap = 3,
}: HeatmapProps) {
  const colors = useThemeColors();

  const counts: Record<string, number> = {};
  for (const ts of trainedDates) {
    const k = dateKey(ts);
    counts[k] = (counts[k] ?? 0) + 1;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDow = (today.getDay() + 6) % 7; // 0=Mon
  const totalDays = weeks * 7;
  const start = new Date(today);
  start.setDate(today.getDate() - (totalDays - 1));
  const startDow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - startDow);

  const days: { date: Date; key: string; count: number }[] = [];
  const cursor = new Date(start);
  const totalCells = (weeks + 1) * 7 - (6 - todayDow);
  for (let i = 0; i < totalCells; i++) {
    const k = dateKey(cursor.getTime());
    days.push({ date: new Date(cursor), key: k, count: counts[k] ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalWeeks = Math.ceil(days.length / 7);
  const widthPx = totalWeeks * (cellSize + cellGap);
  const heightPx = 7 * (cellSize + cellGap);

  // 4-step lime intensity. Inactive cells render as surfaceAlt.
  const SHADES = [colors.surfaceAlt, colors.accentSoft, colors.accent, colors.accentEdge];
  const intensity = (count: number) => {
    if (count <= 0) return SHADES[0];
    if (count === 1) return SHADES[1];
    if (count === 2) return SHADES[2];
    return SHADES[3];
  };

  return (
    <View>
      <Svg width={widthPx} height={heightPx}>
        {days.map((day, i) => {
          const week = Math.floor(i / 7);
          const dow = i % 7;
          const x = week * (cellSize + cellGap);
          const y = dow * (cellSize + cellGap);
          if (day.date.getTime() > Date.now()) return null;
          return (
            <Rect
              key={`c-${i}`}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx={3}
              fill={intensity(day.count)}
            />
          );
        })}
      </Svg>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 4,
          marginTop: 8,
        }}
      >
        <View style={{ width: 6, height: 1, backgroundColor: colors.muted, marginRight: 2 }} />
        {SHADES.map((s, i) => (
          <View
            key={i}
            style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s }}
          />
        ))}
        <View style={{ width: 6, height: 1, backgroundColor: colors.muted, marginLeft: 2 }} />
      </View>
    </View>
  );
}
