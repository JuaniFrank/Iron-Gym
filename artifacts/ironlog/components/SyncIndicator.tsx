// Floating sync status pill (top-right, above every screen) plus a debug panel
// opened on tap: current activity, last run, error chain, recent log and a
// "Sincronizar ahora" button. Rendered nothing when sync is inactive or the
// user is signed out. All formatting lives in services/sync/statusView.ts.

import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { SyncStatus } from "@/services/sync/engine";
import { useSyncEngine, useSyncStatus } from "@/services/sync/SyncProvider";
import {
  describeActivity,
  errorText,
  formatDuration,
  formatRelative,
  pillView,
  type PillTone,
} from "@/services/sync/statusView";

/** Re-render periodically so "hace X min" keeps up while nothing else changes. */
const RELATIVE_REFRESH_MS = 30_000;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), RELATIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  // Every status change re-renders the consumer; read the clock then too.
  return Math.max(now, Date.now());
}

function useToneColor(): Record<PillTone, string> {
  const colors = useThemeColors();
  return { ok: colors.ok, syncing: colors.warning, error: colors.danger };
}

const STATE_TEXT: Record<SyncStatus["state"], string> = {
  idle: "Al día",
  syncing: "Sincronizando",
  error: "Error",
  account_mismatch: "Cuenta distinta",
};

export function SyncIndicator() {
  const { user } = useAuth();
  const engine = useSyncEngine();
  const status = useSyncStatus();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const toneColor = useToneColor();
  const now = useNow();
  const [open, setOpen] = useState(false);

  if (!engine || !user) return null;

  const view = pillView(status, now);
  const tint = toneColor[view.tone];

  return (
    <>
      {/* box-none: only the pill itself takes touches. */}
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Estado de sync: ${view.label}`}
          hitSlop={8}
          style={{
            position: "absolute",
            top: insets.top + 4,
            right: 12,
            maxWidth: "75%",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: tint,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }} />
          <Text variant="tiny" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
            {view.label}
          </Text>
        </Pressable>
      </View>

      <SyncPanel
        visible={open}
        onClose={() => setOpen(false)}
        status={status}
        now={now}
        tint={tint}
        onSyncNow={() => void engine.syncNow()}
      />
    </>
  );
}

function SyncPanel({
  visible,
  onClose,
  status,
  now,
  tint,
  onSyncNow,
}: {
  visible: boolean;
  onClose: () => void;
  status: SyncStatus;
  now: number;
  tint: string;
  onSyncNow: () => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const syncing = status.state === "syncing";
  const run = status.lastRun;
  const startedAt = run ? new Date(run.startedAt).toLocaleTimeString() : null;

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
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
      >
        <Pressable onPress={() => undefined}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: colors.border,
              paddingTop: 16,
              paddingHorizontal: 22,
              paddingBottom: Math.max(insets.bottom, 12) + 6,
              maxHeight: "85%",
            }}
          >
            <Text variant="tiny" color={colors.muted}>
              SINCRONIZACIÓN
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tint }} />
              <Text variant="title">{STATE_TEXT[status.state]}</Text>
            </View>

            <ScrollView style={{ marginTop: 12 }} contentContainerStyle={{ gap: 12 }}>
              {syncing && status.activity ? (
                <Field label="Ahora" value={describeActivity(status.activity)} />
              ) : null}

              {status.lastSyncedAt !== undefined ? (
                <Field
                  label="Última sincronización"
                  value={formatRelative(status.lastSyncedAt, now)}
                />
              ) : null}

              {run && startedAt ? (
                <Field
                  label="Última corrida"
                  value={`${startedAt} · ${formatDuration(run.durationMs)} · ${run.pulled} recibidos · ${run.pushed} enviados`}
                />
              ) : null}

              {status.state === "account_mismatch" ? (
                <Text variant="body" color={colors.danger}>
                  Este dispositivo ya se sincronizó con otra cuenta. Para no mezclar datos, no se
                  sube ni se baja nada hasta volver a la cuenta original.
                </Text>
              ) : null}

              {status.state === "error" && status.lastError !== undefined ? (
                <Field label="Error" value={errorText(status.lastError)} color={colors.danger} />
              ) : null}

              <View>
                <Text variant="tiny" color={colors.muted}>
                  REGISTRO
                </Text>
                {status.log.length === 0 ? (
                  <Text variant="caption" muted style={{ marginTop: 4 }}>
                    Sin eventos todavía.
                  </Text>
                ) : (
                  status.log.map((entry, i) => (
                    <Text
                      key={`${entry.at}-${i}`}
                      variant="caption"
                      color={entry.level === "error" ? colors.danger : colors.inkSoft}
                      style={{ marginTop: 4 }}
                    >
                      {new Date(entry.at).toLocaleTimeString()}  {entry.message}
                    </Text>
                  ))
                )}
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Button
                label="Sincronizar ahora"
                onPress={onSyncNow}
                disabled={syncing}
                style={{ flex: 1 }}
              />
              <Button label="Cerrar" variant="outline" onPress={onClose} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  const colors = useThemeColors();
  return (
    <View>
      <Text variant="tiny" color={colors.muted}>
        {label.toUpperCase()}
      </Text>
      <Text variant="body" color={color} selectable style={{ marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}
