// Pure presentation helpers for the sync indicator (no React / native imports).

import { describeErrorChain } from "@/services/dbBoot";

import type { SyncActivity, SyncStatus } from "./engine";

export type PillTone = "ok" | "syncing" | "error";
export type PillView = { tone: PillTone; label: string };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Spanish relative time: "recién", "hace 2 min", "hace 1 h", "hace 3 d". */
export function formatRelative(at: number, now: number): string {
  const diff = now - at;
  if (diff < MIN) return "recién";
  if (diff < HOUR) return `hace ${Math.floor(diff / MIN)} min`;
  if (diff < DAY) return `hace ${Math.floor(diff / HOUR)} h`;
  return `hace ${Math.floor(diff / DAY)} d`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 10_000) return `${Math.round(ms / 100) / 10} s`;
  if (ms < MIN) return `${Math.round(ms / 1000)} s`;
  const seconds = Math.round((ms % MIN) / 1000);
  return `${Math.floor(ms / MIN)} min ${seconds} s`;
}

/** The error and its `cause` chain as one line (outermost first). */
export function errorText(err: unknown): string {
  return describeErrorChain(err, "Error desconocido");
}

const PHASE_LABEL: Record<SyncActivity["phase"], string> = {
  backfill: "Backfill",
  "pull-fetch": "Pull",
  "pull-apply": "Pull",
  push: "Push",
};

/** "Pull exercises 25/60": whichever parts the activity carries. */
export function describeActivity(a: SyncActivity): string {
  const progress =
    a.done !== undefined && a.total !== undefined
      ? `${a.done}/${a.total}`
      : a.done !== undefined
        ? String(a.done)
        : undefined;
  return [PHASE_LABEL[a.phase], a.table, progress].filter(Boolean).join(" ");
}

export function pillView(status: SyncStatus, now: number): PillView {
  switch (status.state) {
    case "syncing":
      return {
        tone: "syncing",
        label: status.activity ? `Sync · ${describeActivity(status.activity)}` : "Sync",
      };
    case "error":
      return { tone: "error", label: "Error de sync" };
    case "account_mismatch":
      return { tone: "error", label: "Cuenta distinta" };
    default:
      return {
        tone: "ok",
        label:
          status.lastSyncedAt === undefined
            ? "Sincronizado"
            : `Sincronizado · ${formatRelative(status.lastSyncedAt, now)}`,
      };
  }
}
