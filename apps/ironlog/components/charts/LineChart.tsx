import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

export interface LinePoint {
  x: number;
  y: number;
  label?: string;
}

interface LineChartProps {
  data: LinePoint[];
  width: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showDots?: boolean;
  /** Highlight the last point (drawn with accent fill, ink ring). */
  highlightLast?: boolean;
}

export function LineChart({
  data,
  width,
  height = 110,
  color,
  strokeWidth = 2,
  showDots = true,
  highlightLast = true,
}: LineChartProps) {
  const colors = useThemeColors();
  const stroke = color ?? colors.ink;

  const padX = 2;
  const padTop = 8;
  const padBottom = 8;

  if (data.length === 0) {
    return (
      <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        <Text variant="caption" muted>
          Sin datos
        </Text>
      </View>
    );
  }

  const ys = data.map((d) => d.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = Math.max(maxY - minY, 0.0001);
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const px = (i: number) => padX + (i / Math.max(data.length - 1, 1)) * innerW;
  const py = (v: number) => padTop + innerH - ((v - minY) / range) * innerH;

  // Cubic-spline-ish path matching the design canvas curves.
  let path = "";
  data.forEach((d, i) => {
    const x = px(i);
    const y = py(d.y);
    if (i === 0) {
      path += `M ${x} ${y}`;
    } else {
      const prevX = px(i - 1);
      const prevY = py(data[i - 1]!.y);
      const cx = (prevX + x) / 2;
      path += ` C ${cx} ${prevY}, ${cx} ${y}, ${x} ${y}`;
    }
  });

  const area =
    path +
    ` L ${px(data.length - 1)} ${padTop + innerH} L ${px(0)} ${padTop + innerH} Z`;

  const gradId = `lc-grad-${Math.round(width)}-${Math.round(height)}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#${gradId})`} />
      <Path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {showDots &&
        data.map((d, i) => {
          const isLast = i === data.length - 1 && highlightLast;
          return (
            <Circle
              key={`dot-${i}`}
              cx={px(i)}
              cy={py(d.y)}
              r={isLast ? 4 : 2.5}
              fill={isLast ? colors.accent : stroke}
              stroke={isLast ? stroke : "none"}
              strokeWidth={isLast ? 1.5 : 0}
            />
          );
        })}
    </Svg>
  );
}
