import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, View } from "react-native";

import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { BODY_PART_LABEL } from "@/constants/bodyParts";
import { CATEGORY_ICON, CATEGORY_LABEL } from "@/constants/noteChips";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { SessionNote } from "@/types";
import { severityToLabel } from "@/utils/notes";

interface NoteCardProps {
  note: SessionNote;
  onPress?: () => void;
  /** Si true, muestra fecha. Default false (cuando se muestran agrupadas por sesión). */
  showDate?: boolean;
  /** Si true, muestra "X días" en lugar de fecha completa (timeline). */
  relativeDate?: boolean;
}

export function NoteCard({
  note,
  onPress,
  showDate = false,
  relativeDate = false,
}: NoteCardProps) {
  const colors = useThemeColors();
  const isPain = note.category === "pain";
  const tone = note.resolved ? colors.muted : colors.ink;
  const accent = isPain && !note.resolved ? colors.danger : colors.accentEdge;

  const sevLabel = severityToLabel(note.category, note.severity);
  const bodyLabel = note.bodyPart ? BODY_PART_LABEL[note.bodyPart] : null;

  const inner = (
    <Row gap={10} ai="flex-start">
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          backgroundColor: note.resolved ? colors.surfaceAlt : colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather
          name={CATEGORY_ICON[note.category]}
          size={14}
          color={note.resolved ? colors.muted : accent}
        />
      </View>
      <Col flex={1} gap={2}>
        <Row gap={6} ai="center">
          <Text variant="label" weight="semibold" color={tone}>
            {bodyLabel ?? CATEGORY_LABEL[note.category]}
          </Text>
          {sevLabel ? (
            <Text variant="caption" color={colors.muted}>
              · {sevLabel}
            </Text>
          ) : null}
          {note.resolved ? (
            <Text variant="tiny" color={colors.muted}>
              · resuelto
            </Text>
          ) : null}
        </Row>
        {note.text && note.text.trim().length > 0 ? (
          <Text variant="caption" color={colors.muted} numberOfLines={2}>
            {note.text}
          </Text>
        ) : null}
        {showDate ? (
          <Text variant="tiny" color={colors.muted}>
            {relativeDate ? formatRelative(note.createdAt) : formatAbs(note.createdAt)}
          </Text>
        ) : null}
      </Col>
    </Row>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceAlt : "transparent",
        })}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {inner}
    </View>
  );
}

function formatAbs(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatRelative(ts: number): string {
  const diffMs = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days < 1) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  return `hace ${Math.floor(days / 30)} m`;
}
