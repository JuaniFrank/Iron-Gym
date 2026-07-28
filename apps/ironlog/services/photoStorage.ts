import { Directory, File, Paths } from "expo-file-system";

/**
 * Progress-photo file storage helpers.
 *
 * Cf. db-integration.md DDB-17 + DDB-21:
 *
 * - **Stable location**: source URIs from `expo-image-picker` may live in the
 *   OS cache (deleted unpredictably). We copy each picked image into
 *   `documentDirectory + "progress_photos/{id}.{ext}"` so the URI we persist
 *   in `progress_photos.uri` survives across app launches.
 * - **DB is source of truth**: deletes go DB-first; the FS cleanup is
 *   best-effort. A missing file at delete time MUST NOT block the row
 *   write — a swallowed `try/catch` covers the "already gone" case.
 *
 * Uses the modern `expo-file-system` API (`File` / `Directory` / `Paths`).
 */

const PHOTO_DIR_NAME = "progress_photos";

function photoDir(): Directory {
  return new Directory(Paths.document, PHOTO_DIR_NAME);
}

/**
 * Copy `srcUri` into the persistent progress-photo directory using the
 * provided id as the filename stem (extension preserved from the source).
 * Returns the new stable URI to persist in the DB row.
 */
export async function copyPhotoToStable(
  srcUri: string,
  id: string,
): Promise<string> {
  const dir = photoDir();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  const ext = (() => {
    const dot = srcUri.lastIndexOf(".");
    if (dot === -1) return "jpg";
    const tail = srcUri.slice(dot + 1).toLowerCase();
    // Strip query strings or fragments that some pickers append.
    const cleaned = tail.split(/[?#]/, 1)[0];
    return cleaned.length > 0 && cleaned.length <= 5 ? cleaned : "jpg";
  })();
  const dst = new File(dir, `${id}.${ext}`);
  const src = new File(srcUri);
  src.copy(dst);
  return dst.uri;
}

/**
 * Best-effort delete of a stored progress photo. Swallows errors — the DB
 * row's soft delete already records the user's intent; an FS hiccup must
 * not block the mutator.
 */
export async function deletePhotoFile(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // best-effort; DDB-21 — DB row already updated, FS cleanup is subordinate.
  }
}
