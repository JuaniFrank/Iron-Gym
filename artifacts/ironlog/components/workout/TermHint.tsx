import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { Modal, Platform, Pressable, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

export type TermKey = "SET" | "PREVIO" | "KG" | "REPS" | "RPE";

interface TermInfo {
  label: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}

const TERMS: Record<TermKey, TermInfo> = {
  SET: {
    label: "SET",
    title: "Serie",
    description:
      "Un bloque de repeticiones que hacés sin descanso. Las marcadas como warmup son de calentamiento y no suman al volumen total.",
    icon: "layers",
  },
  PREVIO: {
    label: "PREVIO",
    title: "Sesión anterior",
    description:
      "Lo que hiciste la última vez en esta misma serie (peso × reps). Te sirve de referencia para igualar o superar.",
    icon: "rotate-ccw",
  },
  KG: {
    label: "KG",
    title: "Kilogramos",
    description:
      "Peso total movido en la serie, contando barra y discos. Si entrenás con mancuernas, es el peso de cada una.",
    icon: "anchor",
  },
  REPS: {
    label: "REPS",
    title: "Repeticiones",
    description:
      "Cantidad de veces que ejecutaste el movimiento completo en la serie.",
    icon: "repeat",
  },
  RPE: {
    label: "RPE",
    title: "Esfuerzo percibido",
    description:
      "Rate of Perceived Exertion. Escala 1-10 de qué tan dura sentiste la serie. RPE 10 = al fallo; 9 = quedaba 1 rep; 8 = quedaban 2; 7 = quedaban 3. Sirve para autoregular el peso.",
    icon: "activity",
  },
};

interface TermHintProps {
  term: TermKey;
  align?: "left" | "center" | "right";
  width?: number;
  flex?: number;
  style?: ViewStyle;
}

export function TermHint({
  term,
  align = "center",
  width,
  flex,
  style,
}: TermHintProps) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const info = TERMS[term];

  const handleOpen = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setOpen(true);
  };

  return (
    <>
      <Pressable
        onLongPress={handleOpen}
        onPress={handleOpen}
        delayLongPress={250}
        hitSlop={8}
        style={({ pressed }) => [
          {
            width,
            flex,
            paddingVertical: 2,
            opacity: pressed ? 0.5 : 1,
          },
          style,
        ]}
      >
        <Text variant="tiny" color={colors.muted} style={{ textAlign: align }}>
          {info.label}
        </Text>
      </Pressable>

      <TermHintModal
        visible={open}
        info={info}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function TermHintModal({
  visible,
  info,
  onClose,
}: {
  visible: boolean;
  info: TermInfo;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const scale = useSharedValue(0.94);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 140 });
    } else {
      scale.value = 0.94;
      opacity.value = 0;
    }
  }, [visible, scale, opacity]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <Pressable onPress={() => undefined}>
          <Animated.View
            style={[
              cardStyle,
              {
                backgroundColor: colors.card,
                borderRadius: 22,
                paddingHorizontal: 22,
                paddingTop: 22,
                paddingBottom: 18,
                width: 300,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={{
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 5,
                backgroundColor: colors.accentSoft,
                borderRadius: 999,
                marginBottom: 14,
              }}
            >
              <Feather
                name={info.icon}
                size={11}
                color={colors.accentEdge}
              />
              <Text variant="tiny" color={colors.accentEdge}>
                {info.label}
              </Text>
            </View>

            <Text variant="h3" style={{ marginBottom: 6 }}>
              {info.title}
            </Text>
            <Text variant="body" muted style={{ marginBottom: 16 }}>
              {info.description}
            </Text>

            <Button label="Entendido" onPress={onClose} fullWidth size="md" />
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
