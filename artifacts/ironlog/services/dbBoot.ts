/**
 * Pure helpers for the DB boot pipeline (no react-native / expo imports so
 * they run in node tests).
 *
 * On web, expo-sqlite keeps its OPFS database behind an exclusive
 * `createSyncAccessHandle` lock. A second tab/window (or the installed PWA
 * plus a browser tab) fails to open the DB with `NoModificationAllowedError`
 * until the first one closes. The lock can also linger briefly after a
 * reload, so we retry a few times before giving up.
 */

export type BootErrorKind = "locked" | "other";

// "Invalid VFS state" is what an unpatched expo-sqlite worker throws on every call
// after a failed (locked) init; treat it as the same class so we never show a
// generic error for what is really a lock.
const LOCK_PATTERN =
  /NoModificationAllowedError|createSyncAccessHandle|Access Handle|Invalid VFS state/i;

export function classifyBootError(err: unknown): BootErrorKind {
  if (err == null) return "other";
  const name = typeof err === "object" ? String((err as { name?: unknown }).name ?? "") : "";
  const message =
    typeof err === "string"
      ? err
      : typeof err === "object"
        ? String((err as { message?: unknown }).message ?? "")
        : "";
  return LOCK_PATTERN.test(name) || LOCK_PATTERN.test(message) ? "locked" : "other";
}

export function describeBootError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return "Error desconocido al iniciar la base de datos.";
}

/** ~2.4s total with the defaults. */
export const DEFAULT_RETRY_DELAYS_MS = [300, 600, 700, 800];

export interface BootRetryOptions {
  /** Retry lock errors (web only). Other errors are never retried. */
  retryLocked: boolean;
  delaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Run `boot`, retrying with the given backoff only while it fails with an
 * OPFS lock error. Rethrows the last error once retries are exhausted.
 * `boot` must be safe to re-run (initDb leaves no singleton on failure and
 * migrations/seed are idempotent).
 */
export async function bootWithRetry(
  boot: () => Promise<void>,
  { retryLocked, delaysMs = DEFAULT_RETRY_DELAYS_MS, sleep = defaultSleep }: BootRetryOptions,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await boot();
      return;
    } catch (err) {
      const canRetry =
        retryLocked && classifyBootError(err) === "locked" && attempt < delaysMs.length;
      if (!canRetry) throw err;
      await sleep(delaysMs[attempt]);
    }
  }
}
