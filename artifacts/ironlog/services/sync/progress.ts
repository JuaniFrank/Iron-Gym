// Plain-data progress events emitted by the pull / push engines. They carry no
// behaviour: omitting `onProgress` leaves the engines exactly as they were.

export type SyncProgressEvent =
  /** A table's remote changes were fetched. */
  | { phase: "pull-fetch"; table: string; fetched: number }
  /**
   * One batch of a table was committed. `done` rows of `total` were processed
   * (including ones that lost last-write-wins); `applied` of them were applied.
   */
  | { phase: "pull-apply"; table: string; done: number; total: number; applied: number }
  /**
   * One push round finished. `done` entries were acknowledged so far out of the
   * `total` that were queued when the push started; `tables` counts pushed
   * entries per table so far.
   */
  | { phase: "push"; done: number; total?: number; tables?: Record<string, number> };

export type SyncProgressListener = (event: SyncProgressEvent) => void;
