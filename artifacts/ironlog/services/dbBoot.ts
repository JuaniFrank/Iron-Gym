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

/**
 * - `locked`: another tab/window holds the OPFS lock (web only).
 * - `aborted`: a boot transaction failed and its ROLLBACK failed too, which
 *   hides the original error (SQLite had already rolled back on its own, e.g.
 *   after a lock or I/O error mid-transaction). Boot is idempotent, so retry.
 */
export type BootErrorKind = "locked" | "aborted" | "other";

// "Invalid VFS state" is what an unpatched expo-sqlite worker throws on every call
// after a failed (locked) init; treat it as the same class so we never show a
// generic error for what is really a lock.
const LOCK_PATTERN =
  /NoModificationAllowedError|createSyncAccessHandle|Access Handle|Invalid VFS state/i;

const ABORTED_PATTERN = /Failed to run the query 'ROLLBACK'/;

/** The error followed by its `cause` chain (drizzle wraps driver errors). */
function errorChain(err: unknown): unknown[] {
  const chain: unknown[] = [];
  let current: unknown = err;
  while (current != null && chain.length < 10 && !chain.includes(current)) {
    chain.push(current);
    current = typeof current === "object" ? (current as { cause?: unknown }).cause : undefined;
  }
  return chain;
}

function nameOf(err: unknown): string {
  return typeof err === "object" && err ? String((err as { name?: unknown }).name ?? "") : "";
}

function messageOf(err: unknown): string {
  if (typeof err === "string") return err;
  return typeof err === "object" && err ? String((err as { message?: unknown }).message ?? "") : "";
}

export function classifyBootError(err: unknown): BootErrorKind {
  const chain = errorChain(err);
  if (chain.some((e) => LOCK_PATTERN.test(nameOf(e)) || LOCK_PATTERN.test(messageOf(e)))) {
    return "locked";
  }
  if (chain.some((e) => ABORTED_PATTERN.test(messageOf(e)))) return "aborted";
  return "other";
}

/** The error messages of the `cause` chain, outermost first, joined with " ← ". */
/** Non-empty messages of the error and its `cause` chain, outermost first. */
export function errorMessages(err: unknown): string[] {
  return errorChain(err).map(messageOf).filter(Boolean);
}

export function describeErrorChain(err: unknown, fallback = "Error desconocido"): string {
  const messages = errorMessages(err);
  return messages.length > 0 ? messages.join(" ← ") : fallback;
}

export function describeBootError(err: unknown): string {
  return describeErrorChain(err, "Error desconocido al iniciar la base de datos.");
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
 * OPFS lock error (web) or an aborted transaction (any platform). Rethrows the last error once retries are exhausted.
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
      const kind = classifyBootError(err);
      const retryable = kind === "aborted" || (retryLocked && kind === "locked");
      const canRetry = retryable && attempt < delaysMs.length;
      if (!canRetry) throw err;
      await sleep(delaysMs[attempt]);
    }
  }
}
