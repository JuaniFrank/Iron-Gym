import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface CelebrationOverlayProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  icon?: keyof typeof Feather.glyphMap;
  onClose: () => void;
}

export function CelebrationOverlay({
  visible,
  title,
  subtitle,
  icon = "award",
  onClose,
}: CelebrationOverlayProps) {
  const colors = useThemeColors();

  const scale = useSharedValue(0.5);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      scale.value = withSpring(1, { damping: 7, stiffness: 90 });
      opacity.value = withTiming(1, { duration: 200 });
      rotate.value = withSequence(
        withTiming(-10, { duration: 100, easing: Easing.out(Easing.ease) }),
        withRepeat(
          withSequence(
            withTiming(10, { duration: 200 }),
            withTiming(-10, { duration: 200 }),
          ),
          3,
          false,
        ),
        withTiming(0, { duration: 100 }),
      );
    } else {
      scale.value = 0.5;
      opacity.value = 0;
      rotate.value = 0;
    }
  }, [visible, scale, opacity, rotate]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withDelay(100, withSpring(visible ? 1 : 0.9)) }],
    opacity: opacity.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.85)",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <Animated.View
          style={[
            cardStyle,
            {
              backgroundColor: colors.card,
              borderRadius: 28,
              padding: 32,
              alignItems: "center",
              maxWidth: 360,
              width: "100%",
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        >
          <Animated.View style={iconStyle}>
            <LinearGradient
              colors={["#FF6B35", "#FF8B5C", "#FFB088"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <Feather name={icon} size={48} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          <Text variant="h2" style={{ textAlign: "center", marginBottom: 8 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" muted style={{ textAlign: "center", marginBottom: 24 }}>
              {subtitle}
            </Text>
          ) : (
            <View style={{ height: 8 }} />
          )}

          <Button label="Genial" onPress={onClose} fullWidth size="lg" />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
