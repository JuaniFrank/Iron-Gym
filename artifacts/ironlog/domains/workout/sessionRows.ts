/**
 * Pure row layout of one exercise card in the active workout.
 *
 * Rows are the largest of what was planned (or the routine target when there is
 * no plan), what was already logged and what has an autosaved draft, computed
 * independently for warm-up and work sets, plus any extra work rows the user
 * added with "Añadir set". Drafts matter because the extra rows themselves are
 * local state: after a restart only a draft remembers that a row existed.
 */

export interface ExerciseRow {
  isWarmup: boolean;
  /** 1-based position within its kind (warm-up or work). */
  index: number;
}

export interface ComputeExerciseRowsArgs {
  /** Number of planned warm-up sets, or `null` when the exercise has no plan. */
  plannedWarmup: number | null;
  /** Number of planned work sets, or `null` when the exercise has no plan. */
  plannedWork: number | null;
  /** Routine targets, used when there is no plan. */
  targetSets: number;
  warmupSets: number;
  completedWarmup: number;
  completedWork: number;
  /** Extra empty work rows added by the user. */
  extraWork: number;
  /** Highest 1-based set index with a draft, per kind (see `draftSlotCounts`). */
  draftWarmupCount?: number;
  draftWorkCount?: number;
}

export interface ExerciseRows {
  rows: ExerciseRow[];
  workRows: number;
  /** Every work row is completed (warm-ups are optional and never block). */
  allWorkSetsDone: boolean;
}

export function computeExerciseRows(args: ComputeExerciseRowsArgs): ExerciseRows {
  const effectiveWarmup = args.plannedWarmup ?? args.warmupSets;
  const effectiveWork = args.plannedWork ?? args.targetSets;
  const warmupRows = Math.max(
    effectiveWarmup,
    args.completedWarmup,
    args.draftWarmupCount ?? 0,
  );
  const workRows = Math.max(
    effectiveWork + args.extraWork,
    args.completedWork,
    args.draftWorkCount ?? 0,
  );

  const rows: ExerciseRow[] = [];
  for (let i = 0; i < warmupRows; i++) rows.push({ isWarmup: true, index: i + 1 });
  for (let i = 0; i < workRows; i++) rows.push({ isWarmup: false, index: i + 1 });

  return {
    rows,
    workRows,
    allWorkSetsDone: args.completedWork > 0 && args.completedWork >= workRows,
  };
}

/**
 * Highest draft set index per kind for one exercise. Set indexes are 1-based
 * (the row's `index`), so the max index is also the number of rows the drafts
 * need. `undefined` drafts (still loading) count as none.
 *
 * Parses `buildDraftKey` keys (`exercise::setIndex::isWarmup`).
 */
export function draftSlotCounts(
  drafts: ReadonlyMap<string, unknown> | undefined,
  exerciseId: string,
): { warmup: number; work: number } {
  const counts = { warmup: 0, work: 0 };
  if (!drafts) return counts;
  const prefix = `${exerciseId}::`;
  for (const key of drafts.keys()) {
    if (!key.startsWith(prefix)) continue;
    const [index, warmupFlag] = key.slice(prefix.length).split("::");
    const n = Number(index);
    if (!Number.isInteger(n) || n < 1) continue;
    const kind = warmupFlag === "1" ? "warmup" : "work";
    counts[kind] = Math.max(counts[kind], n);
  }
  return counts;
}

/**
 * New `extraWork` for "Añadir set": exactly one more work row than what is
 * shown now. `extraWork` is only a floor on top of the plan (rows are the
 * max of plan + extra, completed sets and drafts), so incrementing it blindly
 * would add nothing - or stack - when rows come from drafts restored after a
 * restart.
 */
export function nextExtraWork(args: ComputeExerciseRowsArgs): number {
  const effectiveWork = args.plannedWork ?? args.targetSets;
  return computeExerciseRows(args).workRows + 1 - effectiveWork;
}

/**
 * The exercise cards seed their inputs once on mount, so they must not render
 * while any of their sources is still loading. `undefined` means "not loaded
 * yet"; `null` (no plan / no routine) is a resolved, empty answer.
 */
export function isActiveWorkoutDataLoaded(args: {
  plan: unknown;
  drafts: unknown;
  routine: unknown;
  sessionsLoaded: boolean;
}): boolean {
  return (
    args.plan !== undefined &&
    args.drafts !== undefined &&
    args.routine !== undefined &&
    args.sessionsLoaded
  );
}

/**
 * React key of a set row: the slot it represents (exercise + kind + index),
 * never its position in the list, so rows that shift (a warm-up appearing, a
 * row added) can not hand their local input state to a different slot.
 */
export function rowKey(exerciseId: string, row: ExerciseRow): string {
  return `${exerciseId}-${row.isWarmup ? "warmup" : "work"}-${row.index}`;
}
