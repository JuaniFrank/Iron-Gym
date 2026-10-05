import { errorMessages } from "@/services/dbBoot";

const MAX_PART_LENGTH = 160;

/**
 * User-facing error detail for alerts: the full cause chain (drizzle wraps the
 * driver error that actually explains the failure), with each part truncated
 * because drizzle messages embed the whole SQL statement.
 */
export function errorDetail(err: unknown): string {
  const parts = errorMessages(err).map((m) =>
    m.length > MAX_PART_LENGTH ? `${m.slice(0, MAX_PART_LENGTH)}…` : m,
  );
  return parts.length > 0 ? parts.join(" ← ") : "Error desconocido";
}
