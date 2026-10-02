# IronLog — DB Integration

> Guía operativa para implementar la migración a SQLite + Drizzle. Doc destinado a una agente IA que retoma la implementación entre sesiones. NO es referencia documental ni archivo histórico — todo lo que está acá es input para escribir código. Si una sección deja de aportar para implementar, se elimina.

---

## 1. Stack y decisiones cerradas

| ID | Decisión | Razón |
| --- | --- | --- |
| DDB-1 | SQLite + Drizzle como storage local | Local-first, queries tipadas, migrations versionadas. |
| DDB-2 | Driver: `expo-sqlite` | Compat Expo Go, `useLiveQuery` integrado, FTS5 disponible. |
| DDB-3 | Schemas SQLite y Postgres separados, tipos compartidos | Drizzle no es dialect-agnostic; `lib/db/src/schema/{sqlite,postgres}/` paralelos, tipos vía `$inferSelect/$inferInsert` desde `schema/shared/`. |
| DDB-4 | UUIDs generados en cliente, algoritmo `uuid` v7 | Local-first sin esperar al server; v7 timestamp-prefixed → index locality + cursor pagination. |
| DDB-5 | `updatedAt` + `deletedAt` en todas las tablas | Pilar de sync diferencial; soft delete obligatorio. |
| DDB-6 | Tipos canónicos del dominio salen de Drizzle | `types/index.ts` queda solo para tipos no-DB (UI helpers, unions). |
| DDB-7 | `drizzle-kit` para migrations, aplicadas al boot | Sin rollback (Drizzle no soporta `down`); solo additivas. |
| DDB-8 | Schema versioning explícito en tabla `_meta` | `schema_version` para detectar mismatches client↔DB. |
| DDB-9 | Routines / RoutineDays / RoutineExercises: 3 tablas normalizadas | Mutators ya granulares; self-FK explícita; cascade nativo; query inversa trivial. |
| DDB-10 | Orden con `position INTEGER` + `UNIQUE(parent_id, position)` | Integridad de orden a nivel motor; insert con `MAX(position)+1`; reorder con swap transaccional vía position temporal. |
| DDB-11 | `SessionPlan.exercises` como JSON column con Zod en mutator | Mutators son blob-level (overwrite total); volumen mínimo; analytics JS-side suficiente. |
| DDB-12 | PRs en tabla `pr_records` con FK + snapshots | Datos inmutables; queries indexadas; UNIQUE de idempotencia; snapshots `exerciseName`/`previousValue` sobreviven renames. |
| DDB-13 | `completed_sets` en tabla aparte (no JSON anidado) | `MAX GROUP BY` directo; queries del dominio sin parse. |
| DDB-14 | Seed unificado en DB con `is_preset` | Integridad referencial real; FKs apuntan a la misma tabla; sync filtra por `is_preset = 0`. |
| DDB-15 | Seed run gateado por `seed_version` en `_meta` | Cero overhead post-primera-instalación; updates al bumpear constante; disciplina visible en code review. |
| DDB-16 | Presets read-only en UI | "Duplicar como custom" cuando se necesite editar. Configuración del user (equipo, increments) va en tablas satélite, NO toca presets. |
| DDB-17 | ProgressPhoto: copia a `documentDirectory` + cleanup eager | URIs de cache se pierden; `documentDirectory` es persistente; cleanup best-effort no bloquea delete del row. |
| DDB-18 | Sin cifrado app-level de DB en v1 | Sandbox del OS (iOS Data Protection / Android FBE). Si se necesita en el futuro, investigar desde cero. |
| DDB-19 | Fallo de `migrate()` al boot: crash fail-fast | DB del user es sagrada; nada destruye data sin consentimiento. Error visible en Metro/Sentry. |
| DDB-20 | Achievements: check fn en JS + helper `loadAchievementState` | Cold path (1 vez por sesión); 13 checks simples y testeados; excepción `computeStreak` va en SQL. |
| DDB-21 | DB es source of truth, filesystem es subordinado | Aplica a `progress_photos`. Cleanup de archivos best-effort, falla no bloquea delete. |
| DDB-22 | Backup auth: código de recuperación BIP39 (futuro) | Cuando se sume backend, server jamás ve data en claro. No afecta v1. |

### DDB-9 + DDB-10 · Routines (detalle)

3 tablas con `position INTEGER NOT NULL` + `UNIQUE(parent_id, position)`. Insert normal:

```ts
const max = await tx.select({ p: max(routineExercises.position) })
  .from(routineExercises)
  .where(eq(routineExercises.routineDayId, dayId))
  .get();
const position = (max?.p ?? -1) + 1;
```

Reorder con swap transaccional (position temporal -1 evita violar UNIQUE):

```ts
db.transaction((t) => {
  t.update(routineExercises).set({ position: -1 }).where(eq(routineExercises.id, idA)).run();
  t.update(routineExercises).set({ position: posA }).where(eq(routineExercises.id, idB)).run();
  t.update(routineExercises).set({ position: posB }).where(eq(routineExercises.id, idA)).run();
});
```

> IMPORTANTE: el callback de `db.transaction` DEBE ser síncrono (sin `async`/`await`),
> usando `.run()/.all()/.get()`. La sesión drizzle de expo-sqlite es síncrona y hace
> COMMIT apenas el callback retorna; con un callback `async` el COMMIT ocurre en el primer
> `await` y el resto corre fuera de la transacción, sin rollback.

Self-FK `superset_with` referencia `routine_exercises.id` del mismo día.

### DDB-11 · SessionPlan (detalle)

Validación Zod en el mutator (input boundary). Drizzle `mode: "json"` solo serializa, NO valida.

```ts
const PlannedExercisesSchema = z.array(PlannedExerciseSchema);

export async function upsertSessionPlan(input: SessionPlanInput) {
  const validated = PlannedExercisesSchema.parse(input.exercises);
  await db.insert(sessionPlans)
    .values({ ...input, exercises: validated, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: sessionPlans.dateKey,
      set: { exercises: validated, updatedAt: Date.now() },
    });
}
```

### DDB-12 · PR records (detalle)

Snapshots redundantes preservan integridad histórica. UNIQUE hace `finishWorkout` idempotente.

```ts
export const prRecords = sqliteTable("pr_records", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull()
    .references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id").notNull().references(() => exercises.id),
  exerciseName: text("exercise_name").notNull(),       // snapshot
  type: text("type").notNull(),                         // 'weight' | 'volume' | 'reps'
  value: real("value").notNull(),
  previousValue: real("previous_value"),                // snapshot
  achievedAt: integer("achieved_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
}, (t) => [
  index("pr_by_exercise").on(t.exerciseId, t.type, t.value),
  index("pr_by_session").on(t.sessionId),
  unique().on(t.sessionId, t.exerciseId, t.type),
]);
```

`workoutSessions.prsAchieved` no existe. La pantalla `summary.tsx` consulta `SELECT * FROM pr_records WHERE session_id = ?`.

### DDB-14 + DDB-15 · Seed pattern (detalle)

```ts
// constants/seed.ts
export const SEED_VERSION = 1;  // bump al cambiar EXERCISES/FOOD_DATABASE/PRESET_ROUTINES

// lib/db/src/seed.ts
export async function runSeedIfNeeded(db: DB) {
  const stored = await db.select().from(meta)
    .where(eq(meta.key, 'seed_version')).get();
  const storedVersion = stored ? parseInt(stored.value, 10) : 0;
  if (storedVersion >= SEED_VERSION) return;

  db.transaction((tx) => {
    for (const ex of EXERCISES) {
      tx.insert(exercises).values({ ...ex, isPreset: true, updatedAt: Date.now() })
        .onConflictDoUpdate({
          target: exercises.id,
          set: { ...ex, updatedAt: Date.now() },
        })
        .run();
    }
    // idem foods, routines (con cascade a routine_days y routine_exercises)
    tx.insert(meta).values({ key: 'seed_version', value: String(SEED_VERSION) })
      .onConflictDoUpdate({ target: meta.key, set: { value: String(SEED_VERSION) } })
      .run();
  });
}
```

### DDB-17 · ProgressPhoto helpers (detalle)

```ts
// services/photoStorage.ts
const PHOTO_DIR = FileSystem.documentDirectory + "progress_photos/";

export async function copyPhotoToStable(srcUri: string, id: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  const ext = srcUri.split('.').pop() ?? 'jpg';
  const dst = `${PHOTO_DIR}${id}.${ext}`;
  await FileSystem.copyAsync({ from: srcUri, to: dst });
  return dst;
}

export async function deletePhotoFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // best-effort; DB ya está consistente
  }
}
```

### DDB-19 · bootDatabase (detalle)

```ts
async function bootDatabase() {
  try {
    await migrate(db, migrations);
    await runSeedIfNeeded(db);
  } catch (err) {
    console.error('[ironlog] DB boot failed:', err);
    throw err; // fail-fast — Expo muestra el error rojo
  }
}
```

Nada de fallback a DB fresca. Nada de fallback a AsyncStorage.

### DDB-20 · Achievements (detalle)

13 check fn en `constants/achievements.ts` siguen en JS sin cambios. `computeStreak(db)` se reescribe a SQL.

```ts
// domains/achievements/queries.ts
export async function loadAchievementState(db: DB): Promise<AppStateForAchievements> {
  const [sessions, bodyWeights, prs, streak] = await Promise.all([
    db.select().from(workoutSessions).where(isNotNull(workoutSessions.endedAt)),
    db.select().from(bodyWeightEntries).where(isNull(bodyWeightEntries.deletedAt)),
    db.select().from(prRecords).where(isNull(prRecords.deletedAt)),
    computeStreak(db),
  ]);
  return { sessions, bodyWeights, streak, prs };
}

// dentro de finishWorkout (mutator)
const state = await loadAchievementState(db);
const alreadyUnlocked = new Set(
  (await db.select().from(achievementsUnlocked)).map(a => a.id)
);
const newlyUnlocked = ACHIEVEMENTS
  .filter(a => !alreadyUnlocked.has(a.id) && a.check(state))
  .map(a => ({ id: a.id, unlockedAt: Date.now() }));

if (newlyUnlocked.length) {
  await db.insert(achievementsUnlocked).values(newlyUnlocked);
}
```

---

## 2. Schema final (Drizzle SQLite)

Una entrada por tabla. Todas con `updatedAt` (NOT NULL) y `deletedAt` (nullable) salvo `_meta`, `key_value`, `scheduled_routines`, `session_plans` y `achievements_unlocked` donde aplica criterio distinto.

### `_meta`

```ts
export const meta = sqliteTable("_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
// Filas: schema_version, seed_version, seeded_at
```

### `exercises`

```ts
export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  primaryMuscle: text("primary_muscle").notNull(),
  secondaryMuscles: text("secondary_muscles", { mode: "json" })
    .$type<string[]>().notNull().default([]),
  type: text("type").notNull(),     // barbell | dumbbell | machine | cable | bodyweight
  isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
}, (t) => ({
  byName: index("exercises_by_name").on(t.name),
}));
```

### `routines`

```ts
export const routines = sqliteTable("routines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  goal: text("goal"),               // strength | hypertrophy | cutting | beginner
  isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
```

### `routine_days`

```ts
export const routineDays = sqliteTable("routine_days", {
  id: text("id").primaryKey(),
  routineId: text("routine_id").notNull()
    .references(() => routines.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
}, (t) => ({
  uniqPos: unique().on(t.routineId, t.position),
}));
```

### `routine_exercises`

```ts
export const routineExercises = sqliteTable("routine_exercises", {
  id: text("id").primaryKey(),
  routineDayId: text("routine_day_id").notNull()
    .references(() => routineDays.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id").notNull()
    .references(() => exercises.id),
  position: integer("position").notNull(),
  targetSets: integer("target_sets").notNull(),
  targetReps: integer("target_reps").notNull(),
  warmupSets: integer("warmup_sets").notNull().default(0),
  supersetWith: text("superset_with"),  // self-FK por id, nullable
  restSeconds: integer("rest_seconds").notNull(),
  notes: text("notes"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
}, (t) => ({
  uniqPos: unique().on(t.routineDayId, t.position),
}));
```

### `workout_sessions`

```ts
export const workoutSessions = sqliteTable("workout_sessions", {
  id: text("id").primaryKey(),
  routineId: text("routine_id").references(() => routines.id),
  routineDayId: text("routine_day_id").references(() => routineDays.id),
  routineName: text("routine_name").notNull(),     // snapshot
  dayName: text("day_name").notNull(),              // snapshot
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  exerciseOrder: text("exercise_order", { mode: "json" })
    .$type<string[]>().notNull(),
  skippedExerciseIds: text("skipped_exercise_ids", { mode: "json" })
    .$type<string[]>().notNull().default([]),
  totalVolumeKg: integer("total_volume_kg").notNull().default(0),
  notes: text("notes"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
```

### `completed_sets`

```ts
export const completedSets = sqliteTable("completed_sets", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull()
    .references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id").notNull()
    .references(() => exercises.id),
  weight: real("weight").notNull(),
  reps: integer("reps").notNull(),
  rpe: real("rpe"),
  isWarmup: integer("is_warmup", { mode: "boolean" }).notNull(),
  setIndex: integer("set_index").notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
}, (t) => ({
  byExWeight: index("sets_by_ex_weight").on(t.exerciseId, t.weight),
  bySession: index("sets_by_session").on(t.sessionId),
}));
```

### `pr_records`

Cf. DDB-12 detalle. Schema arriba.

### `body_weights`

```ts
export const bodyWeights = sqliteTable("body_weights", {
  id: text("id").primaryKey(),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  weightKg: real("weight_kg").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
```

### `body_measurements`

```ts
export const bodyMeasurements = sqliteTable("body_measurements", {
  id: text("id").primaryKey(),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  waist: real("waist"),
  chest: real("chest"),
  hips: real("hips"),
  leftArm: real("left_arm"),
  rightArm: real("right_arm"),
  leftThigh: real("left_thigh"),
  rightThigh: real("right_thigh"),
  neck: real("neck"),
  shoulders: real("shoulders"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
```

### `progress_photos`

```ts
export const progressPhotos = sqliteTable("progress_photos", {
  id: text("id").primaryKey(),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  uri: text("uri").notNull(),       // path en documentDirectory + "progress_photos/{id}.{ext}"
  weightKg: real("weight_kg"),
  notes: text("notes"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
```

### `food_items`

```ts
export const foodItems = sqliteTable("food_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand"),
  caloriesPer100g: real("calories_per_100g").notNull(),
  proteinPer100g: real("protein_per_100g").notNull(),
  carbsPer100g: real("carbs_per_100g").notNull(),
  fatPer100g: real("fat_per_100g").notNull(),
  defaultServingG: real("default_serving_g"),
  isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
```

### `food_entries`

```ts
export const foodEntries = sqliteTable("food_entries", {
  id: text("id").primaryKey(),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  mealType: text("meal_type").notNull(),
  foodItemId: text("food_item_id").notNull()
    .references(() => foodItems.id),
  grams: real("grams").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
```

### `fitness_goals`

```ts
export const fitnessGoals = sqliteTable("fitness_goals", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  targetDate: integer("target_date", { mode: "timestamp_ms" }).notNull(),
  exerciseId: text("exercise_id").references(() => exercises.id),
  targetWeight: real("target_weight"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
```

### `scheduled_routines`

```ts
export const scheduledRoutines = sqliteTable("scheduled_routines", {
  dayOfWeek: integer("day_of_week").primaryKey(),     // 1..7
  routineId: text("routine_id").notNull()
    .references(() => routines.id),
  routineDayId: text("routine_day_id").notNull()
    .references(() => routineDays.id),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
```

### `schedule_overrides`

```ts
export const scheduleOverrides = sqliteTable("schedule_overrides", {
  dateKey: text("date_key").primaryKey(),             // "YYYY-MM-DD"
  routineId: text("routine_id").references(() => routines.id),
  routineDayId: text("routine_day_id").references(() => routineDays.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
```

### `session_plans`

```ts
export const sessionPlans = sqliteTable("session_plans", {
  dateKey: text("date_key").primaryKey(),
  routineId: text("routine_id").notNull()
    .references(() => routines.id),
  routineDayId: text("routine_day_id").notNull()
    .references(() => routineDays.id),
  exercises: text("exercises", { mode: "json" })
    .$type<PlannedExercise[]>().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
```

### `achievements_unlocked`

```ts
export const achievementsUnlocked = sqliteTable("achievements_unlocked", {
  id: text("id").primaryKey(),                        // = achievement.id
  unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" }).notNull(),
});
```

### `session_notes`

```ts
export const sessionNotes = sqliteTable("session_notes", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull()
    .references(() => workoutSessions.id, { onDelete: "cascade" }),
  setId: text("set_id")
    .references(() => completedSets.id, { onDelete: "set null" }),
  exerciseId: text("exercise_id").references(() => exercises.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  category: text("category").notNull(),
  bodyPart: text("body_part"),
  severity: integer("severity"),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  text: text("text").notNull(),
  source: text("source").notNull(),
  audioUri: text("audio_uri"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
}, (t) => ({
  bySession: index("notes_by_session").on(t.sessionId),
  byExercise: index("notes_by_exercise").on(t.exerciseId),
  byCreated: index("notes_by_created").on(t.createdAt),
  // Partial recomendado: WHERE category='pain' AND resolved=0 AND deleted_at IS NULL
  painActive: index("notes_pain_active").on(t.bodyPart, t.severity, t.createdAt),
}));
```

### `feature_discoveries`

```ts
export const featureDiscoveries = sqliteTable("feature_discoveries", {
  featureId: text("feature_id").primaryKey(),
  status: text("status").notNull(),     // unseen | shown | activated | dismissed | snoozed
  shownAt: integer("shown_at", { mode: "timestamp_ms" }),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  snoozeUntil: integer("snooze_until", { mode: "timestamp_ms" }),
});
```

### `user_profile` (singleton, `id = "self"`)

```ts
export const userProfile = sqliteTable("user_profile", {
  id: text("id").primaryKey(),         // siempre "self"
  name: text("name").notNull(),
  age: integer("age").notNull(),
  weightKg: real("weight_kg").notNull(),
  heightCm: real("height_cm").notNull(),
  sex: text("sex").notNull(),           // male | female
  activityLevel: text("activity_level").notNull(),
  goal: text("goal").notNull(),
  units: text("units").notNull(),       // metric | imperial
  theme: text("theme").notNull(),       // system | light | dark
  caloriesGoal: integer("calories_goal"),
  proteinGoalG: integer("protein_goal_g"),
  carbsGoalG: integer("carbs_goal_g"),
  fatGoalG: integer("fat_goal_g"),
  volumeTargets: text("volume_targets", { mode: "json" })
    .$type<Partial<Record<MuscleGroup, VolumeTarget>>>(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
```

### `key_value` (catch-all)

```ts
export const keyValue = sqliteTable("key_value", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
// Filas: default_rest_seconds, active_workout_id
```

---

## 3. Bootstrap

### `lib/db/src/client/sqlite.ts`

```ts
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import * as schema from "../schema/sqlite";

const sqlite = SQLite.openDatabaseSync("ironlog.db");
export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
```

### `lib/db/src/migrations.ts`

```ts
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "./drizzle/migrations.json";
import { db } from "./client/sqlite";

export async function runMigrations() {
  await migrate(db, migrations);
}
```

### `lib/db/src/seed.ts`

Cf. DDB-14 + DDB-15 detalle. `runSeedIfNeeded(db)` con `seed_version` gating + transacción + upsert.

### `utils/id.ts`

```ts
import { v7 as uuidv7 } from 'uuid';
export function uid(): string {
  return uuidv7();
}
```

Dependencia: `uuid` (^11.x) en `artifacts/ironlog`.

### `app/_layout.tsx`

```tsx
async function bootDatabase() {
  try {
    await runMigrations();
    await runSeedIfNeeded(db);
  } catch (err) {
    console.error('[ironlog] DB boot failed:', err);
    throw err;        // fail-fast, DDB-19
  }
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => { bootDatabase().then(() => setDbReady(true)); }, []);

  if (!fontsLoaded || !dbReady) return null;  // splash

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <KeyboardProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <QueryClientProvider client={queryClient}>
              <ThemeProvider>
                <StackNavigator />
              </ThemeProvider>
            </QueryClientProvider>
          </GestureHandlerRootView>
        </KeyboardProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
```

`IronLogProvider` no existe. Sin hidratación de AsyncStorage. Sin escritura del blob.

---

## 4. Inventario de mutators

Funciones puras en `domains/<area>/mutators.ts`. Validación Zod en input boundary. IDs con `uid()`. `updatedAt: Date.now()` en cada write.

### `domains/routines/mutators.ts`

```ts
createRoutine(name: string, description?: string): Promise<Routine>
updateRoutine(id: string, patch: Partial<Routine>): Promise<void>
deleteRoutine(id: string): Promise<void>                    // soft + cascade soft
cloneRoutine(id: string): Promise<Routine | null>           // tx: routines + days + exercises
addRoutineDay(routineId: string, name: string): Promise<RoutineDay>     // position = MAX+1
updateRoutineDay(routineId: string, dayId: string, patch: Partial<RoutineDay>): Promise<void>
deleteRoutineDay(routineId: string, dayId: string): Promise<void>       // soft + cascade
addExerciseToDay(routineId: string, dayId: string, exerciseId: string): Promise<RoutineExercise>
  // defaults: targetSets=3, targetReps=10, warmupSets=0, restSeconds=90; position=MAX+1
updateRoutineExercise(routineId: string, dayId: string, exId: string, patch: Partial<RoutineExercise>): Promise<void>
removeRoutineExercise(routineId: string, dayId: string, exId: string): Promise<void>     // soft
toggleSuperset(routineId: string, dayId: string, exId: string, withId: string | null): Promise<void>   // tx update ×2
```

### `domains/exercises/mutators.ts`

```ts
createCustomExercise(input: Omit<Exercise, "id" | "isPreset">): Promise<Exercise>
  // insert con isPreset=false
```

### `domains/workout/mutators.ts`

```ts
startWorkout(routineId: string, dayId: string): Promise<WorkoutSession>
  // tx: insert workout_sessions + key_value.active_workout_id; resolve routineName/dayName

startEmptyWorkout(name?: string): Promise<WorkoutSession>

logSet(sessionId: string, set: Omit<CompletedSet, "id" | "completedAt">): Promise<void>
  // insert completed_sets; recalcular total_volume_kg

removeSet(sessionId: string, setId: string): Promise<void>
  // delete físico (no soft); recalcular total_volume_kg

finishWorkout(sessionId: string, notes?: string): Promise<{
  session: WorkoutSession;
  prs: PRRecord[];
  newAchievements: AchievementUnlock[];
}>
  // tx: update endedAt + totalVolume + notes;
  //     detect PRs (compare contra MAX histórico, exclude current session) → insert pr_records;
  //     loadAchievementState → filter ACHIEVEMENTS no desbloqueados que pasen check → insert

cancelWorkout(sessionId: string): Promise<void>
  // delete físico session + cascade sets + clear key_value.active_workout_id

addExerciseToActiveWorkout(sessionId: string, exerciseId: string): Promise<void>
reorderSessionExercises(sessionId: string, fromIndex: number, toIndex: number): Promise<void>
replaceSessionExercise(sessionId: string, fromExId: string, toExId: string): Promise<void>
setSessionExerciseSkipped(sessionId: string, exId: string, skipped: boolean): Promise<void>
removeSessionExercise(sessionId: string, exId: string): Promise<void>
setDefaultRest(seconds: number): Promise<void>             // upsert key_value
```

### `domains/body/mutators.ts`

```ts
logBodyWeight(weightKg: number, date?: number): Promise<void>
deleteBodyWeight(id: string): Promise<void>                                // soft
logMeasurement(entry: Omit<BodyMeasurementEntry, "id">): Promise<void>
deleteMeasurement(id: string): Promise<void>                               // soft
addProgressPhoto(input: { uri: string; weightKg?: number; notes?: string }): Promise<void>
  // copyPhotoToStable → insert progress_photos
deleteProgressPhoto(id: string): Promise<void>
  // soft + deletePhotoFile (best-effort)
```

### `domains/nutrition/mutators.ts`

```ts
logFood(entry: Omit<FoodEntry, "id">): Promise<void>
removeFoodEntry(id: string): Promise<void>                                 // delete físico
createCustomFood(input: Omit<FoodItem, "id" | "isPreset">): Promise<FoodItem>
```

### `domains/goals/mutators.ts`

```ts
addGoal(goal: Omit<FitnessGoal, "id" | "createdAt" | "completed">): Promise<void>
toggleGoal(id: string): Promise<void>
deleteGoal(id: string): Promise<void>                                      // soft
```

### `domains/schedule/mutators.ts`

```ts
scheduleRoutine(entry: ScheduledRoutine): Promise<void>                    // upsert por dayOfWeek
unscheduleDay(dayOfWeek: number): Promise<void>                            // delete físico
setOverrideForDate(timestamp: number, plan: ScheduleOverridePlan | null): Promise<void>
clearOverrideForDate(timestamp: number): Promise<void>                     // delete físico
swapDates(timestampA: number, timestampB: number): Promise<void>           // tx: swap overrides + sessionPlans
upsertSessionPlan(plan: Omit<SessionPlan, "updatedAt">): Promise<void>     // Zod validate exercises
deleteSessionPlan(dateKey: string): Promise<void>                          // delete físico
```

### `domains/notes/mutators.ts`

```ts
addNote(input: Omit<SessionNote, "id" | "createdAt">): Promise<SessionNote>
  // si setId presente, denormalizar exerciseId desde el set
updateNote(id: string, patch: Partial<SessionNote>): Promise<void>
deleteNote(id: string): Promise<void>                                      // soft
resolveNote(id: string): Promise<void>                                     // resolved=1, resolvedAt=now
unresolveNote(id: string): Promise<void>
clearAllNotes(): Promise<void>                                             // delete físico (con confirmation UI)
```

### `domains/discovery/mutators.ts`

```ts
setDiscoveryStatus(featureId: string, status: FeatureDiscoveryStatus, extra?: Partial<FeatureDiscovery>): Promise<void>
snoozeDiscovery(featureId: string, durationMs?: number): Promise<void>
resetAllDiscoveries(): Promise<void>                                       // delete físico
```

### `domains/profile/mutators.ts`

```ts
updateProfile(patch: Partial<UserProfile>): Promise<void>                  // update where id="self"
```

### `domains/admin/mutators.ts`

```ts
resetAll(): Promise<void>                                                  // delete físico TODO + reset key_value (con confirmation UI)
```

---

## 5. Inventario de queries (hooks reactivos con useLiveQuery)

```ts
// domains/workout/queries.ts
useActiveSession(): WorkoutSession | null
useSessionById(id: string): WorkoutSession | null
useFinishedSessions(opts?: { limit?: number }): WorkoutSession[]
useTodaySessions(): WorkoutSession[]
useSetsForSession(sessionId: string): CompletedSet[]
useSetsForExercise(exerciseId: string): CompletedSet[]
useLastSetsForExercise(exerciseId: string, beforeSessionId?: string): CompletedSet[]
useMaxWeightForExercise(exerciseId: string, excludeSessionId?: string): number
useStreak(): number
usePRsForSession(sessionId: string): PRRecord[]

// domains/exercises/queries.ts
useAllExercises(): Exercise[]
useExerciseById(id: string): Exercise | null
useExercisesByMuscle(muscle: MuscleGroup): Exercise[]

// domains/routines/queries.ts
useAllRoutines(): Routine[]                  // hidratado con days + exercises
useRoutineById(id: string): Routine | null

// domains/body/queries.ts
useBodyWeights(): BodyWeightEntry[]
useMeasurements(): BodyMeasurementEntry[]
useProgressPhotos(): ProgressPhoto[]

// domains/nutrition/queries.ts
useAllFoods(): FoodItem[]
useFoodById(id: string): FoodItem | null
useFoodEntriesByDate(dateKey: string): FoodEntry[]
useDailyMacros(dateKey: string): { cal: number; protein: number; carbs: number; fat: number }

// domains/goals/queries.ts
useGoals(): FitnessGoal[]

// domains/schedule/queries.ts
useSchedule(): ScheduledRoutine[]
useScheduleOverride(dateKey: string): ScheduleOverride | null
useSessionPlan(dateKey: string): SessionPlan | null
usePlanForDate(timestamp: number): ResolvedPlan          // computed: override > weekly > rest
useNextTrainingDay(daysAhead?: number, startOffsetDays?: number): NextTrainingDay | null

// domains/notes/queries.ts
useAllNotes(): SessionNote[]
useNoteById(id: string): SessionNote | null
useNotesForSession(sessionId: string): SessionNote[]
useNotesForSet(setId: string): SessionNote[]
useNotesForExercise(exerciseId: string): SessionNote[]
useActivePainNotes(): SessionNote[]                       // category=pain AND resolved=0 AND deletedAt IS NULL

// domains/discovery/queries.ts
useDiscoveryState(featureId: string): FeatureDiscoveryState
useEligibleDiscoveries(): FeatureDiscoveryDef[]

// domains/profile/queries.ts
useProfile(): UserProfile
useDefaultRestSeconds(): number

// domains/achievements/queries.ts
useAchievementsUnlocked(): AchievementUnlock[]
```

---

## 6. Pantallas a portar

24 archivos. Orden de menor a mayor complejidad — `workout/active.tsx` al final.

| # | Archivo | Slices | Mutators |
| --- | --- | --- | --- |
| 1 | `app/achievements.tsx` | achievements | — |
| 2 | `app/(tabs)/more.tsx` | profile, achievements, goals | — |
| 3 | `app/goals.tsx` | goals | addGoal, toggleGoal, deleteGoal |
| 4 | `app/profile.tsx` | profile | updateProfile |
| 5 | `app/settings.tsx` | profile, defaultRestSeconds, notes | updateProfile, setDefaultRest, setDiscoveryStatus, resetAllDiscoveries, clearAllNotes, resetAll |
| 6 | `app/(tabs)/nutrition.tsx` | profile, foodEntries, allFoods | removeFoodEntry |
| 7 | `app/food-add.tsx` | allFoods, profile | logFood |
| 8 | `app/food-new.tsx` | — | createCustomFood |
| 9 | `app/(tabs)/progress.tsx` | sessions, bodyWeights, profile, allExercises | — |
| 10 | `app/(tabs)/index.tsx` (home) | profile, sessions, foodEntries, activeWorkoutId, allFoods, allRoutines, notes | setDiscoveryStatus |
| 11 | `app/exercises.tsx` | allExercises, allRoutines, sessions | createCustomExercise, addExerciseToDay, replaceSessionExercise, addExerciseToActiveWorkout |
| 12 | `app/exercise-detail.tsx` | sessions, exerciseById, profile, notesForExercise | — |
| 13 | `app/body.tsx` | bodyWeights, measurements, photos, profile | logBodyWeight, deleteBodyWeight, logMeasurement, deleteMeasurement, addProgressPhoto, deleteProgressPhoto |
| 14 | `app/planning.tsx` | schedule, allRoutines, sessions, scheduleOverrides | scheduleRoutine, unscheduleDay, setOverrideForDate, clearOverrideForDate, swapDates |
| 15 | `app/workout/plan.tsx` | sessions, routineById, sessionPlan, lastSetsForExercise, exerciseById, activeWorkoutId | upsertSessionPlan, deleteSessionPlan, startWorkout |
| 16 | `app/workout/recap.tsx` | sessions, notes | addNote |
| 17 | `app/workout/preflight.tsx` | — | startWorkout, addNote |
| 18 | `app/workout/summary.tsx` | sessions, exerciseById, profile, notesForSession, prsForSession | setDiscoveryStatus |
| 19 | `app/(tabs)/workout.tsx` | allRoutines, activeWorkoutId | startEmptyWorkout, cloneRoutine |
| 20 | `app/routine/[id].tsx` | routineById | updateRoutine, deleteRoutine, addRoutineDay, updateRoutineDay, deleteRoutineDay, removeRoutineExercise, updateRoutineExercise, toggleSuperset |
| 21 | `components/notes/QuickNoteMenu.tsx` | notes, sessions | addNote |
| 22 | `components/notes/NoteSheet.tsx` | notes, sessions | addNote, updateNote, deleteNote |
| 23 | `components/home/DaySwapSheet.tsx` | schedule, allRoutines, scheduleOverrides | scheduleRoutine, setOverrideForDate, clearOverrideForDate |
| 24 | `app/workout/active.tsx` | sessions, activeWorkoutId, defaultRestSeconds, notes | startWorkout, logSet, removeSet, finishWorkout, cancelWorkout, addExerciseToActiveWorkout, reorderSessionExercises, replaceSessionExercise, setSessionExerciseSkipped, removeSessionExercise + queries hidratadas |

Por pantalla: crear hooks que cubran lo que lee → reemplazar `useIronLog()` por hooks granulares + imports de mutators → verificar manual.

---

## 7. Plan de implementación

Cada step termina con la app verde. Si rompe, no avanza.

### Step 0 · Preparativos

1. `pnpm --filter @workspace/ironlog add expo-sqlite uuid`.
2. `lib/db/src/`:
   - `schema/sqlite/` (vacío).
   - `schema/postgres/` (mover lo poco que hay).
   - `schema/shared/` (tipos compartidos).
   - `client/sqlite.ts`, `client/postgres.ts` (separar el `index.ts` actual).
   - `migrations/sqlite/` (drizzle-kit lo poblará).
3. `drizzle.config.sqlite.ts` con `dialect: "sqlite"`.
4. Scripts en `lib/db/package.json`: `drizzle:generate:sqlite`, `drizzle:generate:postgres`.
5. Reemplazar `utils/id.ts` por `uuid` v7.

**Done cuando**: `pnpm --filter @workspace/db run drizzle:generate:sqlite` produce SQL vacío sin errores.

### Step 1 · Schema mínimo (validar pipeline end-to-end)

1. Definir solo `_meta`, `workout_sessions`, `completed_sets` en `schema/sqlite/`.
2. Generar migration inicial.
3. Implementar `client/sqlite.ts`, `migrations.ts`.
4. Agregar `bootDatabase()` al `_layout.tsx` (sin tocar el context todavía).
5. Smoke: insert manual + lectura desde el debugger.

**Done cuando**: archivo SQLite en `Documents/`, insert/select manual funciona.

### Step 2 · Schema completo

1. Definir las 18 tablas restantes en `schema/sqlite/` con FKs e índices.
2. Generar migration.
3. `bootDatabase()` la aplica.

**Done cuando**: DB fresca tiene todas las tablas con FKs e índices verificados.

### Step 3 · Seed data

1. `constants/seed.ts` exporta `SEED_VERSION = 1`.
2. `lib/db/src/seed.ts` implementa `runSeedIfNeeded(db)` con tx + upsert + gating por `_meta.seed_version`.
3. EXERCISES, FOOD_DATABASE, PRESET_ROUTINES insertados con `is_preset=true`.
4. `bootDatabase()` llama `runSeedIfNeeded` post `migrate()`.

**Done cuando**: DB fresca devuelve 165 exercises, 47 foods, 4 routines preset. Bumpear `SEED_VERSION` aplica cambios al próximo boot.

### Step 4 · Lecturas reactivas (useLiveQuery)

Migrar las 24 pantallas/componentes (orden en §6) a hooks granulares en `domains/<area>/queries.ts`. Las mutations siguen llamándose del context viejo (todavía no migradas).

**Done cuando**: ningún componente lee state del `IronLogContext`. Solo llama mutators del context.

### Step 5 · Mutators tipados

1. Por dominio: crear `domains/<area>/mutators.ts` con Zod + funciones puras + transacciones (cf. §4).
2. Reemplazar llamadas en pantallas: `const { logSet } = useIronLog()` → `import { logSet } from "@/domains/workout/mutators"`.
3. Helpers de fotos en `services/photoStorage.ts`.
4. `loadAchievementState` + `computeStreak` en `domains/achievements/queries.ts`.

Orden: simple → complejo, igual que §6.

**Done cuando**: ninguna pantalla llama mutations del context. El context queda vacío.

### Step 6 · Eliminar IronLogContext

1. Borrar `contexts/IronLogContext.tsx` y `IronLogProvider`.
2. Quitar `<IronLogProvider>` de `_layout.tsx`.
3. Borrar `useEffect` de hidratación + escritura del blob.
4. `grep -r useIronLog` → cero resultados.

**Done cuando**: `useIronLog` no existe. Typecheck verde.

### Step 7 · Tests

Vitest + better-sqlite3 (`:memory:` con `migrate()` aplicado).

Críticos:
- `logSet` (insert + recalcular totalVolume).
- `finishWorkout` (PRs, achievements, idempotencia con UNIQUE).
- `cloneRoutine` (tx con días + ejercicios + nuevos IDs).
- `swapDates` (overrides + sessionPlans).
- `replaceSessionExercise` (exerciseOrder + sets).
- `useMaxWeightForExercise` con `excludeSessionId`.
- `addProgressPhoto` + `deleteProgressPhoto` (FS mock).

**Done cuando**: cobertura > 70% en `domains/`.

### Step 8 · Cleanup deps

1. Eliminar `@react-native-async-storage/async-storage` de deps si ya no se usa en runtime.
2. Si quedó algo en código que importe el viejo blob → eliminar.

**Done cuando**: app sin AsyncStorage como dep.

### Step 9 · Verificaciones finales

- Typecheck limpio.
- Test transversal manual: instalación fresca → onboarding → flujos básicos OK.
- No regresiones en notes/recap/preflight (sprint anterior).
- Performance: log set → render < 32ms.
- Performance: boot a interactivo < 1.5s con 100 sesiones.

---

## 8. Convenciones del proyecto

- **Validación Zod va en el mutator (input boundary), nunca confiando en `mode: "json"` de Drizzle** — `mode: "json"` solo serializa/deserializa, NO valida.
- **Position UNIQUE**: insert con `MAX(position)+1`; reorder con position temporal (`-1`) en transacción para no violar UNIQUE durante el swap.
- **Snapshot fields en datos inmutables** — `pr_records.exerciseName` y `previousValue`, `workout_sessions.routineName`/`dayName`. Sobreviven renames y soft deletes del recurso original.
- **Soft delete con `deletedAt` en todas las tablas** que lo declaran. Las queries filtran `WHERE deleted_at IS NULL` salvo cuando explícitamente se quiere ver el histórico.
- **DB es source of truth, filesystem es subordinado** — `progress_photos.uri` apunta a `documentDirectory`, cleanup de archivos best-effort (try/catch + `idempotent: true`). Falla del FS no bloquea soft delete del row.
- **IDs siempre con `uid()`** que retorna `uuid` v7 (timestamp-prefixed → index locality).
- **`SEED_VERSION` constante en `constants/seed.ts`**: bumpear al modificar EXERCISES / FOOD_DATABASE / PRESET_ROUTINES. Code review lo expone. Olvidarse no rompe nada (presets viejos siguen), solo no entrega los nuevos.
- **Achievements check fn quedan en JS** (cold path); `loadAchievementState(db)` arma snapshot con queries paralelas; `computeStreak(db)` es la única excepción reescrita a SQL.
- **`migrate()` que falla → crash fail-fast** (`console.error` + `throw`). No fallback a DB fresca, no fallback a AsyncStorage. La DB del user es sagrada.
- **No importar `db` desde un componente React directo** — siempre vía `domains/<area>/{queries,mutators}`.
- **`useLiveQuery` sin `useMemo`** en query builders dependientes de props causa subscriptions nuevas en cada render. Memoizar.
- **Mutators no llaman a otros mutators del mismo dominio** — genera transacciones anidadas. Factorizar lógica común en helpers puros.
- **Mutators son transaccionales cuando tocan más de 1 tabla** (`startWorkout`, `finishWorkout`, `cloneRoutine`, `swapDates`, `cancelWorkout`).
- **Presets read-only en UI** (DDB-16). Configuración del user (equipo del gym, increments por máquina, etc.) va en TABLAS SATÉLITE que referencian presets vía FK, NO en `exercises`/`food_items`/`routines`.
- **Casos donde DELETE físico es correcto en v1**: `completed_sets.removeSet`, `food_entries.removeFoodEntry`, `scheduled_routines.unscheduleDay`, `schedule_overrides.clearOverrideForDate`, `session_plans.deleteSessionPlan`, `feature_discoveries.resetAllDiscoveries`, `clearAllNotes`, `resetAll`, `cancelWorkout`. Anotar para revisar cuando llegue sync.

---

## 9. Tracker

- [x] Step 0 · Preparativos (deps, estructura, drizzle config, `utils/id.ts`)
- [x] Step 1 · Schema mínimo (validar pipeline)
- [x] Step 2 · Schema completo (22 tablas con FKs e índices)
- [x] Step 3 · Seed data con `seed_version` gating
- [x] Step 4 · Lecturas reactivas (24 pantallas/componentes)
- [x] Step 5 · Mutators tipados (~50 mutations)
- [x] Step 6 · Eliminar IronLogContext
- [x] Step 7 · Tests (Vitest + better-sqlite3)
- [x] Step 8 · Cleanup deps (AsyncStorage + `@stardazed/streams-text-encoding`)
- [x] Step 9 · Verificaciones finales (typecheck OK, 33 tests OK, schema diff no-op)
