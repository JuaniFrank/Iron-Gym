// Mounts the sync engine and its triggers for the signed-in user.
//
// Active only when Firebase is configured (and a Firestore instance exists).
// "After local writes" uses expo-sqlite's `addDatabaseChangeListener` on the
// `_outbox` table: the capture triggers write `_outbox` on every syncable
// change (trigger-made changes fire SQLite's update hook too), and the DB is
// opened with `enableChangeListener: true` (lib/db/src/client/sqlite.ts). The
// listener is implemented natively and in the web worker (`update_hook` ->
// `onDatabaseChange` message), so it works on iOS and web alike.

import { addDatabaseChangeListener } from "expo-sqlite";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { AppState, Platform } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/services/db";
import { firestore, isFirebaseConfigured } from "@/services/firebase";

import { createSyncEngine, type SyncEngine, type SyncStatus } from "./engine";
import { createFirestoreRemote } from "./firestoreRemote";
import { startSyncTriggers } from "./triggers";

const IDLE: SyncStatus = { state: "idle" };
const NOOP_UNSUBSCRIBE = () => undefined;

const SyncContext = createContext<SyncEngine | null>(null);

function subscribeForeground(cb: () => void): () => void {
  if (Platform.OS === "web") {
    if (typeof document === "undefined") return NOOP_UNSUBSCRIBE;
    const onChange = () => {
      if (document.visibilityState === "visible") cb();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") cb();
  });
  return () => sub.remove();
}

function subscribeLocalWrites(cb: () => void): () => void {
  const sub = addDatabaseChangeListener((event) => {
    if (event.tableName === "_outbox") cb();
  });
  return () => sub.remove();
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const enabled = isFirebaseConfigured && Boolean(firestore);

  const uidRef = useRef<string | null>(uid);
  uidRef.current = uid;

  const engineRef = useRef<SyncEngine | null>(null);
  if (enabled && engineRef.current === null) {
    engineRef.current = createSyncEngine({
      db,
      remote: createFirestoreRemote(firestore),
      getUid: () => uidRef.current,
    });
  }
  const engine = engineRef.current;

  useEffect(() => {
    if (!engine || !uid) return;
    return startSyncTriggers({
      syncNow: () => engine.syncNow(),
      subscribeForeground,
      subscribeLocalWrites,
    });
  }, [engine, uid]);

  return <SyncContext.Provider value={engine}>{children}</SyncContext.Provider>;
}

/** Current sync status; a constant idle status when sync is not active. */
export function useSyncStatus(): SyncStatus {
  const engine = useContext(SyncContext);
  return useSyncExternalStore(
    engine ? engine.subscribe : () => NOOP_UNSUBSCRIBE,
    engine ? engine.getStatus : () => IDLE,
  );
}
