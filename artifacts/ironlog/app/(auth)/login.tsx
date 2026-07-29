import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

// ─── Logo barbell ─────────────────────────────────────────────────────────────

function BarbellIcon({ size = 32, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Rect x={5} y={15.5} width={4} height={5} rx={1.5} fill={color} />
      <Rect x={27} y={15.5} width={4} height={5} rx={1.5} fill={color} />
      <Rect x={9} y={13.5} width={3} height={9} rx={1.5} fill={color} />
      <Rect x={24} y={13.5} width={3} height={9} rx={1.5} fill={color} />
      <Rect x={12} y={16.5} width={12} height={3} rx={1.5} fill={color} />
    </Svg>
  );
}

// ─── Background grid ──────────────────────────────────────────────────────────

function GridOverlay() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" opacity={0.04}>
      <Defs>
        <Pattern id="grid" x={0} y={0} width={32} height={32} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={32} y2={0} stroke="#C9F24D" strokeWidth={0.6} />
          <Line x1={0} y1={0} x2={0} y2={32} stroke="#C9F24D" strokeWidth={0.6} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#grid)" />
    </Svg>
  );
}

// ─── Google logo ───────────────────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Rect x={0} y={0} width={24} height={24} rx={12} fill="#EA4335" />
      <Rect x={24} y={0} width={24} height={24} rx={12} fill="#4285F4" />
      <Rect x={0} y={24} width={24} height={24} rx={12} fill="#FBBC05" />
      <Rect x={24} y={24} width={24} height={24} rx={12} fill="#34A853" />
      <Circle cx={24} cy={24} r={13} fill="white" />
      <Rect x={24} y={20} width={12} height={8} rx={2} fill="#4285F4" />
    </Svg>
  );
}

// ─── Auth input field ─────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "email-address" | "default";
  autoCapitalize?: "none" | "words";
  icon: React.ReactNode;
  rightSlot?: React.ReactNode;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = "default",
  autoCapitalize = "none",
  icon,
  rightSlot,
}: FieldProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text variant="tiny" color={colors.muted}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 52,
          paddingHorizontal: 14,
          gap: 10,
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: focused ? colors.accentEdge : colors.border,
          shadowColor: colors.accent,
          shadowOpacity: focused ? 0.18 : 0,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        {icon}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedSoft}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            fontSize: 15,
            fontFamily: "Inter_500Medium",
            color: colors.ink,
            letterSpacing: -0.1,
          }}
        />
        {rightSlot}
      </View>
    </View>
  );
}

// ─── Tab switcher ─────────────────────────────────────────────────────────────

type Tab = "login" | "register";

function TabSwitcher({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 4,
        gap: 4,
      }}
    >
      {(["login", "register"] as Tab[]).map((t) => {
        const active = value === t;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            style={{
              flex: 1,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              backgroundColor: active ? colors.accent : "transparent",
            }}
          >
            <Text
              variant="label"
              weight="semibold"
              color={active ? colors.accentInk : colors.muted}
            >
              {t === "login" ? "Acceder" : "Registrarse"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Social button ────────────────────────────────────────────────────────────

function SocialBtn({ label, logo }: { label: string; logo: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <Pressable
      style={({ pressed }) => ({
        flex: 1,
        height: 48,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        gap: 8,
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.975 : 1 }],
      })}
    >
      {logo}
      <Text variant="label" weight="semibold">
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Or divider ───────────────────────────────────────────────────────────────

function OrDivider() {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text variant="tiny" color={colors.mutedSoft}>
        O CONTINUAR CON
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

// ─── Entrance animation helpers ───────────────────────────────────────────────

const ANIM_COUNT = 6;

function useEntranceAnims() {
  // Single ref holds all animated values — no hooks in loops
  const values = useRef(
    Array.from({ length: ANIM_COUNT }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(16),
    }))
  );

  useEffect(() => {
    const animations = values.current.map(({ opacity, translateY }, i) =>
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 340,
          delay: i * 65,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 340,
          delay: i * 65,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(65, animations).start();
  }, []);

  return (i: number) => ({
    opacity: values.current[i].opacity,
    transform: [{ translateY: values.current[i].translateY }],
  });
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const anim = useEntranceAnims();

  // Scan-line animation
  const scanY = useRef(new Animated.Value(0)).current;
  const scanOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scanY, { toValue: 1, duration: 4000, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(scanOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(scanOpacity, { toValue: 0.5, duration: 3600, useNativeDriver: true }),
            Animated.timing(scanOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(scanY, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanY, scanOpacity]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle="light-content" />

      {/* Background layers */}
      <GridOverlay />

      {/* Top ambient glow */}
      <LinearGradient
        colors={["rgba(201,242,77,0.14)", "rgba(201,242,77,0.04)", "transparent"]}
        style={styles.glowTop}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Bottom ambient glow */}
      <LinearGradient
        colors={["transparent", "rgba(201,242,77,0.06)", "rgba(201,242,77,0.12)"]}
        style={styles.glowBottom}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Top accent line */}
      <LinearGradient
        colors={["transparent", colors.accent, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topAccentLine}
      />

      {/* Scan line */}
      <Animated.View
        style={[
          styles.scanLine,
          {
            opacity: scanOpacity,
            transform: [
              {
                translateY: scanY.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-2, 900],
                }),
              },
            ],
          },
        ]}
        pointerEvents="none"
      />

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo ── */}
          <Animated.View style={[styles.logoBlock, anim(0)]}>
            <View
              style={[
                styles.logoWrap,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  shadowColor: colors.accent,
                },
              ]}
            >
              <BarbellIcon size={32} color={colors.accent} />
            </View>
            <Text variant="h2" style={{ letterSpacing: -0.8 }}>
              IronLog
            </Text>
            <Text variant="tiny" color={colors.muted} style={{ marginTop: 2 }}>
              PERFORMANCE TRACKER
            </Text>
          </Animated.View>

          {/* ── Tab switcher ── */}
          <Animated.View style={[anim(1), { marginBottom: 22 }]}>
            <TabSwitcher value={tab} onChange={setTab} />
          </Animated.View>

          {/* ── Form fields ── */}
          <View style={{ gap: 14 }}>
            {tab === "register" && (
              <Animated.View style={anim(2)}>
                <Field
                  label="NOMBRE COMPLETO"
                  value={name}
                  onChangeText={setName}
                  placeholder="Tu nombre"
                  autoCapitalize="words"
                  icon={<Feather name="user" size={16} color={colors.muted} />}
                />
              </Animated.View>
            )}

            <Animated.View style={anim(3)}>
              <Field
                label="CORREO ELECTRÓNICO"
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                keyboardType="email-address"
                icon={<Feather name="mail" size={16} color={colors.muted} />}
              />
            </Animated.View>

            <Animated.View style={anim(4)}>
              <Field
                label="CONTRASEÑA"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPw}
                icon={<Feather name="lock" size={16} color={colors.muted} />}
                rightSlot={
                  <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                    <Feather
                      name={showPw ? "eye" : "eye-off"}
                      size={16}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                }
              />
            </Animated.View>

            {tab === "login" && (
              <Animated.View style={[anim(4), { alignItems: "flex-end" }]}>
                <TouchableOpacity hitSlop={8}>
                  <Text variant="caption" color={colors.accent} weight="semibold">
                    ¿Olvidaste tu contraseña?
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          {/* ── CTA ── */}
          <Animated.View style={[anim(5), { marginTop: 24 }]}>
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: colors.accent,
                  borderColor: colors.accentEdge,
                  shadowColor: colors.accent,
                  opacity: pressed ? 0.88 : 1,
                  transform: [{ scale: pressed ? 0.978 : 1 }],
                },
              ]}
            >
              <Text variant="label" weight="bold" color={colors.accentInk}>
                {tab === "login" ? "Entrar al sistema" : "Crear cuenta"}
              </Text>
              <Feather name="arrow-right" size={15} color={colors.accentInk} />
            </Pressable>
          </Animated.View>

          {/* ── Divider ── */}
          <Animated.View style={[anim(5), { marginTop: 20 }]}>
            <OrDivider />
          </Animated.View>

          {/* ── Social buttons ── */}
          <Animated.View style={[anim(5), styles.socialRow]}>
            <SocialBtn label="Google" logo={<GoogleLogo />} />
            <SocialBtn
              label="Apple"
              logo={<Feather name="smartphone" size={16} color={colors.ink} />}
            />
          </Animated.View>

          {/* ── Footer toggle ── */}
          <Animated.View style={[anim(5), styles.footer]}>
            <Text variant="caption" color={colors.muted}>
              {tab === "login" ? "¿No tenés cuenta? " : "¿Ya tenés cuenta? "}
              <Text
                variant="caption"
                color={colors.accent}
                weight="semibold"
                onPress={() => setTab(tab === "login" ? "register" : "login")}
              >
                {tab === "login" ? "Registrate" : "Accedé"}
              </Text>
            </Text>
          </Animated.View>

          {/* ── Skip (remove when auth is implemented) ── */}
          <Animated.View style={[anim(5), { alignItems: "center", marginTop: 8 }]}>
            <TouchableOpacity onPress={() => router.replace("/(tabs)")} hitSlop={8}>
              <Text variant="tiny" color={colors.mutedSoft}>
                OMITIR POR AHORA
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── System fingerprint ── */}
          <Animated.View style={[anim(5), { alignItems: "center", marginTop: 12 }]}>
            <Text variant="tiny" color={colors.mutedSoft} style={{ opacity: 0.6 }}>
              SYS_AUTH v2.1 · TLS 1.3 · E2E
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 28,
  },
  logoBlock: {
    alignItems: "center",
    gap: 8,
    marginBottom: 28,
    paddingTop: 12,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    marginBottom: 4,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    zIndex: 5,
    backgroundColor: "rgba(201,242,77,0.5)",
    // Horizontal fade via shadow (LinearGradient not possible on Animated.View directly)
    shadowColor: "#C9F24D",
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  topAccentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.75,
    zIndex: 10,
  },
  glowTop: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 320,
    zIndex: 1,
  },
  glowBottom: {
    position: "absolute",
    bottom: 0,
    left: "20%",
    right: "20%",
    height: 280,
    zIndex: 1,
  },
  cta: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  footer: {
    alignItems: "center",
    marginTop: 28,
  },
});
