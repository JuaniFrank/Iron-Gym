import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

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
  showAxisLabels?: boolean;
  yLabelFormatter?: (v: number) => string;
}

export function LineChart({
  data,
  width,
  height = 180,
  color,
  strokeWidth = 2.5,
  showDots = true,
  showAxisLabels = true,
  yLabelFormatter = (v) => v.toFixed(0),
}: LineChartProps) {
  const colors = useThemeColors();
  const stroke = color ?? colors.primary;

  const padLeft = showAxisLabels ? 36 : 8;
  const padRight = 8;
  const padTop = 16;
  const padBottom = showAxisLabels ? 24 : 8;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  if (data.length === 0) {
    return (
      <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        <Svg width={width} height={height}>
          <SvgText
            x={width / 2}
            y={height / 2}
            fontSize={12}
            fill={colors.mutedForeground}
            textAnchor="middle"
            fontFamily="Inter_500Medium"
          >
            Sin datos
          </SvgText>
        </Svg>
      </View>
    );
  }

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const yRange = Math.max(maxY - minY, 1);
  const yMin = minY - yRange * 0.1;
  const yMax = maxY + yRange * 0.1;
  const xRange = Math.max(maxX - minX, 1);

  const xPos = (x: number) => padLeft + ((x - minX) / xRange) * chartW;
  const yPos = (y: number) => padTop + chartH - ((y - yMin) / Math.max(yMax - yMin, 1)) * chartH;

  let path = "";
  data.forEach((d, i) => {
    const cmd = i === 0 ? "M" : "L";
    path += `${cmd}${xPos(d.x).toFixed(2)},${yPos(d.y).toFixed(2)} `;
  });

  // Area fill path
  let areaPath = path;
  if (data.length > 1) {
    const last = data[data.length - 1]!;
    const first = data[0]!;
    areaPath += `L${xPos(last.x).toFixed(2)},${(padTop + chartH).toFixed(2)} `;
    areaPath += `L${xPos(first.x).toFixed(2)},${(padTop + chartH).toFixed(2)} Z`;
  }

  // Y-axis labels (3 ticks)
  const yTicks = 3;
  const tickValues: number[] = [];
  for (let i = 0; i <= yTicks; i++) {
    tickValues.push(yMin + ((yMax - yMin) * i) / yTicks);
  }

  return (
    <Svg width={width} height={height}>
      {showAxisLabels &&
        tickValues.map((v, i) => (
          <React.Fragment key={`tick-${i}`}>
            <Line
              x1={padLeft}
              x2={width - padRight}
              y1={yPos(v)}
              y2={yPos(v)}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="3,3"
              opacity={0.4}
            />
            <SvgText
              x={padLeft - 6}
              y={yPos(v) + 3}
              fontSize={9}
              fill={colors.mutedForeground}
              textAnchor="end"
              fontFamily="Inter_500Medium"
            >
              {yLabelFormatter(v)}
            </SvgText>
          </React.Fragment>
        ))}

      {data.length > 1 && (
        <Path d={areaPath} fill={stroke} fillOpacity={0.08} stroke="none" />
      )}

      <Path d={path} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {showDots &&
        data.map((d, i) => (
          <Circle
            key={`dot-${i}`}
            cx={xPos(d.x)}
            cy={yPos(d.y)}
            r={3.5}
            fill={colors.background}
            stroke={stroke}
            strokeWidth={2}
          />
        ))}
    </Svg>
  );
}
