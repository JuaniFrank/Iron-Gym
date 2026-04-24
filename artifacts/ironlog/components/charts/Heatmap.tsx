import React from "react";
import { View } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

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

  const trainedSet = new Set(trainedDates.map(dateKey));
  const counts: Record<string, number> = {};
  for (const ts of trainedDates) {
    const k = dateKey(ts);
    counts[k] = (counts[k] ?? 0) + 1;
  }

  // Compute the cells from `weeks` weeks ago to today, week-aligned
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDow = (today.getDay() + 6) % 7; // 0=Mon
  const totalDays = weeks * 7;
  const start = new Date(today);
  start.setDate(today.getDate() - (totalDays - 1));
  // Align start to Monday: shift back to Monday of that week
  const startDow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - startDow);

  const days: { date: Date; key: string; trained: boolean; count: number }[] = [];
  const cursor = new Date(start);
  // Make sure we end at end of week of today
  const totalCells = (weeks + 1) * 7 - (6 - todayDow);
  for (let i = 0; i < totalCells; i++) {
    const k = dateKey(cursor.getTime());
    days.push({
      date: new Date(cursor),
      key: k,
      trained: trainedSet.has(k),
      count: counts[k] ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalWeeks = Math.ceil(days.length / 7);
  const labelWidth = 18;
  const monthLabelHeight = 14;
  const widthPx = labelWidth + totalWeeks * (cellSize + cellGap);
  const heightPx = monthLabelHeight + 7 * (cellSize + cellGap);

  // Compute month labels - show month abbreviation when month changes for week
  const monthLabels: { week: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < totalWeeks; w++) {
    const d = days[w * 7]?.date;
    if (!d) continue;
    if (d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth();
      monthLabels.push({
        week: w,
        label: d.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
      });
    }
  }

  const dayLabels = ["L", "M", "X", "J", "V", "S", "D"];

  const intensity = (count: number) => {
    if (count === 0) return colors.secondary;
    if (count >= 3) return colors.primary;
    if (count === 2) return colors.primary + "CC";
    return colors.primary + "88";
  };

  return (
    <View style={{ width: widthPx, alignSelf: "center" }}>
      <Svg width={widthPx} height={heightPx}>
        {monthLabels.map((m) => (
          <SvgText
            key={`m-${m.week}`}
            x={labelWidth + m.week * (cellSize + cellGap)}
            y={monthLabelHeight - 4}
            fontSize={9}
            fill={colors.mutedForeground}
            fontFamily="Inter_500Medium"
          >
            {m.label}
          </SvgText>
        ))}
        {dayLabels.map((d, i) =>
          i % 2 === 0 ? (
            <SvgText
              key={`dl-${i}`}
              x={0}
              y={monthLabelHeight + i * (cellSize + cellGap) + cellSize - 2}
              fontSize={9}
              fill={colors.mutedForeground}
              fontFamily="Inter_500Medium"
            >
              {d}
            </SvgText>
          ) : null,
        )}
        {days.map((day, i) => {
          const week = Math.floor(i / 7);
          const dow = i % 7;
          const x = labelWidth + week * (cellSize + cellGap);
          const y = monthLabelHeight + dow * (cellSize + cellGap);
          // Hide future days (after today)
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
    </View>
  );
}
