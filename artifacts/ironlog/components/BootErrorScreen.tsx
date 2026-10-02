import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { describeBootError, type BootErrorKind } from "@/services/dbBoot";

/**
 * Shown by the root layout when the database fails to boot. Rendered outside
 * ThemeProvider/fonts on purpose (boot may not have completed), so it uses
 * plain RN primitives and fixed colors.
 */
export function BootErrorScreen({
  kind,
  error,
  onRetry,
}: {
  kind: BootErrorKind;
  error: unknown;
  onRetry: () => void;
}) {
  const locked = kind === "locked";
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#0B0B0F",
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginBottom: 12 }}>
        {locked ? "IronLog ya está abierta" : "No se pudo iniciar IronLog"}
      </Text>
      <Text
        style={{
          color: "#C7C7CC",
          fontSize: 15,
          textAlign: "center",
          maxWidth: 420,
          marginBottom: 24,
        }}
      >
        {locked
          ? "IronLog ya está abierta en otra pestaña o ventana. Cerrala y tocá Reintentar."
          : describeBootError(error)}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => ({
          backgroundColor: "#FF5A1F",
          paddingVertical: 12,
          paddingHorizontal: 28,
          borderRadius: 12,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

/**
 * Shown while the DB boots (including the web lock-retry backoff) so the user
 * never sees a blank page. Same constraints as BootErrorScreen: no theme/fonts.
 */
export function BootLoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0B0B0F",
      }}
    >
      <ActivityIndicator color="#FF5A1F" />
      <Text style={{ color: "#C7C7CC", fontSize: 14, marginTop: 12 }}>Iniciando IronLog…</Text>
    </View>
  );
}
