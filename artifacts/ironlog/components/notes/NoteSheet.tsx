import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BodyPartChips } from "@/components/notes/BodyPartChips";
import { CategoryChips } from "@/components/notes/CategoryChips";
import { NoteCard } from "@/components/notes/NoteCard";
import { SeveritySlider } from "@/components/notes/SeveritySlider";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { CATEGORY_LABEL, DEFAULT_CHIPS } from "@/constants/noteChips";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type {
  BodyPart,
  NoteCategory,
  SessionNote,
  WorkoutSession,
} from "@/types";
import { bucketCenterValue, frequentChips } from "@/utils/notes";

const ACCESSORY_ID = "note-sheet-accessory";

interface NoteSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Sesión a la que pertenece la nota (siempre required). */
  sessionId: string;
  /** Set asociado (opcional). Si está, exerciseId se denormaliza desde el set. */
  setId?: string;
  /** Ejercicio asociado (opcional). */
  exerciseId?: string;
  /** Categoría pre-seleccionada al abrir. Si null, user elige. */
  initialCategory?: NoteCategory | null;
  /** Si está editando una nota existente, pasarla acá. */
  editingNote?: SessionNote;
  /** Header context: ej. "Press banca · Set 2" */
  contextLabel?: string;
  /** Notas existentes para este set/exercise/sesión. Si > 0, el sheet abre
   *  en modo "lista" mostrando las existentes con tap-to-edit. Botón
   *  "Agregar nueva" pasa al modo crear (cf. FX-2). */
  existingNotes?: SessionNote[];
}

const SEVERITY_CATEGORIES: NoteCategory[] = [
  "pain",
  "effort",
  "energy",
];

export function NoteSheet({
  visible,
  onClose,
  sessionId,
  setId,
  exerciseId,
  initialCategory = null,
  editingNote,
  contextLabel,
  existingNotes,
}: NoteSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { addNote, updateNote, deleteNote, notes, sessions } = useIronLog();

  // Modo del sheet: "list" (vista de notas existentes), "edit" (modificar
  // una nota), "create" (nueva nota). Determinado al abrir el sheet.
  const [mode, setMode] = useState<"list" | "edit" | "create">("create");
  const [internalEditingNote, setInternalEditingNote] = useState<
    SessionNote | undefined
  >(undefined);

  const [category, setCategory] = useState<NoteCategory | null>(initialCategory);
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [severity, setSeverity] = useState<number>(5);
  const [text, setText] = useState<string>("");

  // Sync con props/edit cuando se abre.
  useEffect(() => {
    if (!visible) return;
    if (editingNote) {
      // Forzado a editar una nota específica (caller sabe qué editar).
      setMode("edit");
      setInternalEditingNote(editingNote);
      setCategory(editingNote.category);
      setBodyPart(editingNote.bodyPart ?? null);
      setSeverity(editingNote.severity ?? 5);
      setText(editingNote.text);
    } else if (existingNotes && existingNotes.length > 0) {
      // Set ya tiene notas → mostrar lista primero (cf. FX-2).
      setMode("list");
      setInternalEditingNote(undefined);
      setCategory(initialCategory);
      setBodyPart(null);
      setSeverity(5);
      setText("");
    } else {
      setMode("create");
      setInternalEditingNote(undefined);
      setCategory(initialCategory);
      setBodyPart(null);
      setSeverity(5);
      setText("");
    }
  }, [visible, editingNote, initialCategory, existingNotes]);

  const enterEditMode = (note: SessionNote) => {
    setMode("edit");
    setInternalEditingNote(note);
    setCategory(note.category);
    setBodyPart(note.bodyPart ?? null);
    setSeverity(note.severity ?? 5);
    setText(note.text);
  };

  const enterCreateMode = () => {
    setMode("create");
    setInternalEditingNote(undefined);
    setCategory(initialCategory);
    setBodyPart(null);
    setSeverity(5);
    setText("");
  };

  const backToList = () => {
    if (existingNotes && existingNotes.length > 0) {
      setMode("list");
      setInternalEditingNote(undefined);
    } else {
      onClose();
    }
  };

  const activeEditingNote = mode === "edit" ? internalEditingNote : undefined;

  const showSeverity = category != null && SEVERITY_CATEGORIES.includes(category);
  const showBodyPart = category === "pain";

  const chipSuggestions = useMemo(() => {
    if (!category) return [] as string[];
    return frequentChips(notes, sessions, category);
  }, [notes, sessions, category]);

  const haptic = () => {
    if (Platform.OS === "web") return;
    Haptics.selectionAsync();
  };

  const handleSave = () => {
    if (!category) return;
    if (!text.trim() && severity == null && !bodyPart && !showSeverity) return;

    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (activeEditingNote) {
      updateNote(activeEditingNote.id, {
        category,
        bodyPart: showBodyPart ? bodyPart ?? undefined : undefined,
        severity: showSeverity ? severity : undefined,
        text: text.trim(),
      });
    } else {
      addNote({
        sessionId,
        setId,
        exerciseId,
        category,
        bodyPart: showBodyPart ? bodyPart ?? undefined : undefined,
        severity: showSeverity ? severity : undefined,
        text: text.trim(),
        source: text.trim() ? "text" : "chip",
      });
    }
    backToList();
  };

  const handleDelete = () => {
    if (!activeEditingNote) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteNote(activeEditingNote.id);
    backToList();
  };

  const handleChipTap = (label: string) => {
    haptic();
    setText(label);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable onPress={() => Keyboard.dismiss()}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom, 12) + 6,
              borderTopWidth: 1,
              borderColor: colors.border,
              maxHeight: "92%",
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: "center", paddingVertical: 6 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.borderStrong,
                  opacity: 0.5,
                }}
              />
            </View>

            {/* Header */}
            <View style={{ paddingHorizontal: 22, paddingTop: 4, paddingBottom: 10 }}>
              <Text variant="tiny" color={colors.muted}>
                {mode === "list"
                  ? "NOTAS DE ESTE SET"
                  : mode === "edit"
                    ? "EDITAR NOTA"
                    : "AGREGAR NOTA"}
              </Text>
              <Row gap={6} ai="baseline" style={{ marginTop: 4 }}>
                <Text variant="title">
                  {mode === "list"
                    ? `${existingNotes?.length ?? 0} ${
                        (existingNotes?.length ?? 0) === 1 ? "nota" : "notas"
                      }`
                    : category
                      ? CATEGORY_LABEL[category]
                      : "Nueva nota"}
                </Text>
                {contextLabel ? (
                  <Text variant="caption" muted>
                    · {contextLabel}
                  </Text>
                ) : null}
              </Row>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* MODO LISTA — muestra notas existentes con tap-to-edit (cf. FX-2). */}
            {mode === "list" ? (
              <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 14, gap: 10 }}>
                <Col gap={8}>
                  {existingNotes?.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onPress={() => enterEditMode(note)}
                    />
                  ))}
                </Col>
                <Pressable
                  onPress={() => {
                    haptic();
                    enterCreateMode();
                  }}
                  style={({ pressed }) => ({
                    marginTop: 6,
                    height: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 6,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Feather name="plus" size={14} color={colors.muted} />
                  <Text variant="label" color={colors.muted}>
                    Agregar otra nota
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => ({
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text variant="label" color={colors.muted}>
                    Cerrar
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
              <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 14, gap: 16 }}>
              {/* Categoría */}
              <View style={{ gap: 8 }}>
                <Text variant="tiny" color={colors.muted}>
                  CATEGORÍA
                </Text>
                <CategoryChips value={category} onChange={setCategory} />
              </View>

              {/* Body part */}
              {showBodyPart ? (
                <View style={{ gap: 8 }}>
                  <Text variant="tiny" color={colors.muted}>
                    ZONA
                  </Text>
                  <BodyPartChips value={bodyPart} onChange={setBodyPart} />
                </View>
              ) : null}

              {/* Severity */}
              {showSeverity ? (
                <View style={{ gap: 8 }}>
                  <Text variant="tiny" color={colors.muted}>
                    {category === "pain"
                      ? "INTENSIDAD"
                      : category === "effort"
                        ? "ESFUERZO"
                        : "ENERGÍA"}
                  </Text>
                  <SeveritySlider
                    value={severity}
                    onChange={setSeverity}
                    bucketLabels={
                      category === "pain"
                        ? ["leve", "molesta", "fuerte"]
                        : category === "effort"
                          ? ["fácil", "medio", "duro"]
                          : ["baja", "media", "alta"]
                    }
                  />
                </View>
              ) : null}

              {/* Chips frecuentes */}
              {category && chipSuggestions.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <Text variant="tiny" color={colors.muted}>
                    SUGERENCIAS
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {chipSuggestions.map((chip) => (
                      <Pressable
                        key={chip}
                        onPress={() => handleChipTap(chip)}
                        style={({ pressed }) => ({
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          borderRadius: 999,
                          backgroundColor: colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text variant="label" color={colors.ink}>
                          {chip}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Texto */}
              {category ? (
                <View style={{ gap: 8 }}>
                  <Text variant="tiny" color={colors.muted}>
                    TEXTO (OPCIONAL)
                  </Text>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder="Algo que quieras recordar..."
                    placeholderTextColor={colors.mutedSoft}
                    multiline
                    inputAccessoryViewID={Platform.OS === "ios" ? ACCESSORY_ID : undefined}
                    style={{
                      minHeight: 60,
                      maxHeight: 100,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceAlt,
                      paddingHorizontal: 12,
                      paddingTop: 10,
                      paddingBottom: 10,
                      fontSize: 14,
                      color: colors.ink,
                      textAlignVertical: "top",
                    }}
                  />
                </View>
              ) : null}
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* Footer */}
            <Row
              gap={10}
              style={{ paddingHorizontal: 22, paddingTop: 14 }}
            >
              {editingNote ? (
                <Pressable
                  onPress={handleDelete}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    height: 44,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 6,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Feather name="trash-2" size={14} color={colors.danger} />
                  <Text variant="label" color={colors.danger}>
                    Eliminar
                  </Text>
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={onClose}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  height: 44,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text variant="label" color={colors.muted}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!category}
                style={({ pressed }) => ({
                  paddingHorizontal: 18,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: colors.ink,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: !category ? 0.4 : pressed ? 0.85 : 1,
                })}
              >
                <Text variant="label" weight="semibold" color={colors.bg}>
                  Guardar
                </Text>
              </Pressable>
            </Row>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={ACCESSORY_ID}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Pressable
              onPress={() => Keyboard.dismiss()}
              hitSlop={8}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.ink,
                opacity: pressed ? 0.85 : 1,
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
              })}
            >
              <MaterialCommunityIcons name="keyboard-close" size={18} color={colors.bg} />
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </Modal>
  );
}

export { DEFAULT_CHIPS };
