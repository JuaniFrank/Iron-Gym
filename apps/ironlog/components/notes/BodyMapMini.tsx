import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Platform, Pressable, View as RNView } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

import { Text } from "@/components/ui/Text";
import { Row } from "@/components/ui/Stack";
import { BODY_PART_SHORT_LABEL } from "@/constants/bodyParts";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { BodyPart } from "@/types";

interface BodyMapMiniProps {
  /** Zonas seleccionadas. Multi-select. */
  selected: Set<BodyPart>;
  /** Toggle de una zona. */
  onTogglePart: (part: BodyPart) => void;
  /** Severity por zona, para colorear (opcional). */
  severityByPart?: Partial<Record<BodyPart, number>>;
  /** Alto del SVG en px. Default 280. */
  height?: number;
}

type ViewMode = "front" | "back";

/**
 * Silueta SVG abstracta unisex (cf. D-14). Vista frontal + posterior con tabs.
 * 17 zonas tappables que mappean al enum BodyPart de D-13.
 *
 * Geometría: viewBox 100×220. Humanoide cabezón estilizado para que las
 * zonas sean fácilmente tappables.
 *
 * Implementación: react-native-svg soporta `onPress` directamente en
 * Circle/Rect/Ellipse/Path, no se puede envolver en Pressable nativo.
 */
export function BodyMapMini({
  selected,
  onTogglePart,
  severityByPart = {},
  height = 280,
}: BodyMapMiniProps) {
  const colors = useThemeColors();
  const [view, setView] = useState<ViewMode>("front");

  const partColor = (part: BodyPart): string => {
    if (selected.has(part)) return colors.accent;
    const sev = severityByPart[part];
    if (sev != null) {
      if (sev >= 7) return colors.danger;
      if (sev >= 4) return colors.warning;
      return colors.accentEdge;
    }
    return colors.surfaceAlt;
  };

  const partStroke = (part: BodyPart): string => {
    if (selected.has(part)) return colors.accentEdge;
    return colors.border;
  };

  const handleTap = (part: BodyPart) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onTogglePart(part);
  };

  const tappable = (part: BodyPart) => ({
    fill: partColor(part),
    stroke: partStroke(part),
    strokeWidth: 1,
    onPress: () => handleTap(part),
  });

  const decorativeStroke = "#999";

  return (
    <RNView>
      <Row gap={8} jc="center" style={{ marginBottom: 12 }}>
        <ViewTab label="Frontal" active={view === "front"} onPress={() => setView("front")} />
        <ViewTab label="Posterior" active={view === "back"} onPress={() => setView("back")} />
      </Row>

      <RNView style={{ alignItems: "center" }}>
        <Svg width={height * (100 / 220)} height={height} viewBox="0 0 100 220">
          {/* cabeza decorativa */}
          <Circle cx={50} cy={15} r={10} fill="none" stroke={decorativeStroke} strokeWidth={0.6} />

          {/* cuello */}
          <Rect x={45} y={25} width={10} height={7} rx={3} {...tappable("neck")} />

          {/* torso (frontal o posterior) */}
          {view === "front" ? (
            <>
              <Rect x={32} y={32} width={36} height={28} rx={6} {...tappable("chest")} />
              <Rect x={36} y={62} width={28} height={28} rx={6} {...tappable("abs")} />
            </>
          ) : (
            <>
              <Rect x={32} y={32} width={36} height={28} rx={6} {...tappable("upper_back")} />
              <Rect x={36} y={62} width={28} height={28} rx={6} {...tappable("lower_back")} />
            </>
          )}

          {/* hombros */}
          <Circle cx={25} cy={36} r={6} {...tappable("shoulder_right")} />
          <Circle cx={75} cy={36} r={6} {...tappable("shoulder_left")} />

          {/* brazos decorativos */}
          <Path d="M 25 42 L 18 75" stroke={decorativeStroke} strokeWidth={0.6} fill="none" />
          <Path d="M 75 42 L 82 75" stroke={decorativeStroke} strokeWidth={0.6} fill="none" />

          {/* codos */}
          <Circle cx={18} cy={75} r={5} {...tappable("elbow_right")} />
          <Circle cx={82} cy={75} r={5} {...tappable("elbow_left")} />

          {/* antebrazos decorativos */}
          <Path d="M 18 80 L 13 105" stroke={decorativeStroke} strokeWidth={0.6} fill="none" />
          <Path d="M 82 80 L 87 105" stroke={decorativeStroke} strokeWidth={0.6} fill="none" />

          {/* muñecas */}
          <Circle cx={13} cy={105} r={4} {...tappable("wrist_right")} />
          <Circle cx={87} cy={105} r={4} {...tappable("wrist_left")} />

          {/* caderas */}
          <Ellipse cx={40} cy={108} rx={8} ry={6} {...tappable("hip_right")} />
          <Ellipse cx={60} cy={108} rx={8} ry={6} {...tappable("hip_left")} />

          {/* piernas decorativas */}
          <Path d="M 40 114 L 38 165" stroke={decorativeStroke} strokeWidth={0.6} fill="none" />
          <Path d="M 60 114 L 62 165" stroke={decorativeStroke} strokeWidth={0.6} fill="none" />

          {/* rodillas */}
          <Circle cx={38} cy={165} r={6} {...tappable("knee_right")} />
          <Circle cx={62} cy={165} r={6} {...tappable("knee_left")} />

          {/* canillas decorativas */}
          <Path d="M 38 171 L 36 205" stroke={decorativeStroke} strokeWidth={0.6} fill="none" />
          <Path d="M 62 171 L 64 205" stroke={decorativeStroke} strokeWidth={0.6} fill="none" />

          {/* tobillos */}
          <Circle cx={36} cy={208} r={4} {...tappable("ankle_right")} />
          <Circle cx={64} cy={208} r={4} {...tappable("ankle_left")} />
        </Svg>
      </RNView>

      {selected.size > 0 ? (
        <RNView style={{ marginTop: 12, alignItems: "center" }}>
          <Text variant="caption" color={colors.muted}>
            {Array.from(selected)
              .map((p) => BODY_PART_SHORT_LABEL[p])
              .join(" · ")}
          </Text>
        </RNView>
      ) : (
        <RNView style={{ marginTop: 12, alignItems: "center" }}>
          <Text variant="caption" color={colors.muted}>
            Tap en las zonas que sentís
          </Text>
        </RNView>
      )}
    </RNView>
  );
}

function ViewTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? colors.ink : colors.surfaceAlt,
        borderWidth: 1,
        borderColor: active ? colors.ink : colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        variant="label"
        weight={active ? "semibold" : "medium"}
        color={active ? colors.bg : colors.ink}
      >
        {label}
      </Text>
    </Pressable>
  );
}
