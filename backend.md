# IronLog — Arquitectura de datos, estado y backend

> Roadmap de arquitectura para escalar la app de un único `IronLogContext` con AsyncStorage a un sistema **local-first**, reactivo, con backend opcional y sync.
>
> Doc vivo. Cada decisión marcada con un ADR (Architecture Decision Record) corto; cada fase con su criterio de salida.

---

## Índice

1. [Diagnóstico del estado actual](#1-diagnóstico-del-estado-actual)
2. [Principios local-first](#2-principios-local-first)
3. [Stack propuesto](#3-stack-propuesto-tldr)
4. [Arquitectura por capas](#4-arquitectura-por-capas)
5. [Drizzle: schema compartido SQLite ↔ Postgres](#5-drizzle-schema-compartido-sqlite--postgres)
6. [Reactividad con useLiveQuery](#6-reactividad-con-uselivequery)
7. [Mutators y comandos](#7-mutators-y-comandos)
8. [UI state efímero (Zustand)](#8-ui-state-efímero-zustand)
9. [Estructura de carpetas propuesta](#9-estructura-de-carpetas-propuesta)
10. [Migraciones de schema](#10-migraciones-de-schema)
11. [Backend: cuando, qué y cómo](#11-backend-cuando-qué-y-cómo)
12. [Estrategias de sync](#12-estrategias-de-sync)
13. [Plan de migración por fases](#13-plan-de-migración-por-fases)
14. [Testing](#14-testing)
15. [Observabilidad](#15-observabilidad)
16. [Advertencias y trade-offs](#16-advertencias-y-trade-offs)
17. [ADRs (decisiones documentadas)](#17-adrs-decisiones-documentadas)
18. [Glosario](#18-glosario)

---

## 1. Diagnóstico del estado actual

### Cómo funciona hoy

- **Estado único**: `IronLogContext` mantiene 14+ entidades distintas (`sessions`, `routines`, `customExercises`, `customFoods`, `bodyWeights`, `measurements`, `photos`, `foodEntries`, `goals`, `schedule`, `scheduleOverrides`, `sessionPlans`, `achievements`, `profile`, `activeWorkoutId`, `defaultRestSeconds`).
- **Persistencia**: AsyncStorage como un único blob JSON bajo la clave `ironlog:v1`.
- **Mutaciones**: ~30 funciones expuestas por el context, cada una hace `update((prev) => ({ ...prev, X: ... }))` y reescribe el blob completo en cada cambio (vía `useEffect` que serializa todo el estado).
- **Lecturas**: cada componente que usa `useIronLog()` recibe el objeto entero. Cualquier mutación re-renderiza todos los consumers.
- **Filtrado/agregación**: hecho en cada render con `array.filter().map().reduce()` (ej. en `progress.tsx` o `(tabs)/index.tsx`).
- **Backend**: cero. Sin auth, sin red, sin sync, sin backup.

### Por qué deja de escalar

Listo en orden de impacto creciente:

1. **Re-render ciego.** Loguear un set re-renderiza la home, nutrición, progress, planning — todo lo que toque el context. Hoy se nota poco; con 50+ pantallas y 1000+ sesiones será un freeze tangible.
2. **Persistencia O(N) en cada mutación.** Cada `setState` dispara un `JSON.stringify` del estado entero. A los 6 meses con 200 sesiones × 30 sets × 5 entries de comida diarias, el blob pasa de los MB y se vuelve lento de leer al startup (boot lag).
3. **Sin queries.** No hay índices, no hay joins. Cada lista filtrada es un scan completo en JS.
4. **Sin migrations**. Si renombrás un campo o cambiás la forma de un objeto, los datos viejos del usuario se rompen silenciosamente. Hoy lo "resolvemos" con `{ ...DEFAULT_STATE, ...parsed }` que es frágil.
5. **Una sola fuente de verdad implícita.** No hay separación entre datos persistentes (sesiones), cache de remoto (no aplica todavía) y estado de UI (sheets abiertos, drafts). Todo vive en el mismo lugar.
6. **Sin backup ni sync.** El día que el usuario cambie de teléfono pierde todo. Cuando salga la web companion no hay donde leer.
7. **Difícil de testear.** No se puede probar `finishWorkout` sin montar React.
8. **Acoplamiento entre dominios.** Cambiar la lógica de schedule te obliga a leer 800 líneas de un archivo que también maneja nutrición y body weight.

### Lo que sí es bueno y querés preservar

- El monorepo ya tiene `@workspace/db` con Drizzle + Postgres.
- Los tipos están centralizados en `types/index.ts`.
- Los datos ya son DB-friendly (`dateKey: YYYY-MM-DD` en `ScheduleOverride`, `SessionPlan`, etc.).
- `drizzle-zod` está como dep — la conversión schema → tipos → validación es trivial.

---

## 2. Principios local-first

Antes de elegir librerías, fijemos el norte. Citando a Martin Kleppmann y al equipo de Ink & Switch (los papers que parieron el término):

1. **Velocidad inmediata.** Lecturas y escrituras nunca esperan red. Toda interacción es instantánea contra el storage local.
2. **El device es la fuente de verdad.** El servidor es backup + canal de sync, no autoridad.
3. **Funciona offline indefinidamente.** Sin red por una semana, todo sigue funcionando como el primer día.
4. **Sync eventualmente.** Cuando vuelve la red, las escrituras locales pendientes se aplican al servidor; cambios remotos llegan al device.
5. **El usuario es dueño de sus datos.** Backup local, exportable, restaurable sin servidor.
6. **Consistencia sobre disponibilidad parcial.** Un conflicto se resuelve con una política clara (LWW, CRDT, merge manual) — nunca quedan datos en limbo.

Esto se traduce a IronLog así:

- En el gym sin señal → la app responde instantáneo.
- Loguear un set no espera nada.
- Si un día perdés el celular, una semana después comprás otro y restaurás.
- Si abrís la app en iPad y iPhone, terminan en el mismo estado sin que pienses en eso.

**La consecuencia técnica es clara**: el "store" del cliente es una **base de datos local real**, no un objeto JS en memoria.

---

## 3. Stack propuesto (TL;DR)

| Capa | Hoy | Propuesta |
|---|---|---|
| Storage local | AsyncStorage (JSON blob) | **`expo-sqlite` + Drizzle** |
| Schema/types | `types/index.ts` a mano | **Drizzle schema → tipos generados + drizzle-zod** |
| Reads reactivos | `useIronLog()` (re-render global) | **`useLiveQuery` de Drizzle** (subscriptions por tabla) |
| Mutaciones | Funciones del context | **Mutators tipados por dominio** (puros, testeables) |
| UI state efímero | `useState` local + context | **Zustand** stores chicas por feature |
| Validación de boundaries | Tipos TS | **Zod** (entrada de API, deeplinks, AsyncStorage de migración) |
| Cache de remoto (cuando exista) | n/a | **TanStack Query** (ya en catalog) |
| Backend | n/a | **Postgres (Vercel/Neon) + Drizzle + Hono o tRPC** |
| Auth | n/a | **Código de recuperación anónimo** v1 → Clerk/Better Auth si crece |
| Sync (cuando exista) | n/a | **Op-log custom** v1 → **PowerSync/ElectricSQL** si dolor crece |
| Migraciones | `{ ...DEFAULT, ...parsed }` rezando | **drizzle-kit** + `migrate()` al boot |
| Testing | nada | **Vitest** + SQLite in-memory |

Todo lo "Propuesta" está en versiones estables a 2026 y muchas piezas ya las tenés en el monorepo.

---

## 4. Arquitectura por capas

```
┌──────────────────────────────────────────────────────────────┐
│                  Pantallas (app/, components/)               │
│   Componentes React. Solo hooks de queries/mutators.         │
│   Sin lógica de negocio ni acceso directo a storage.         │
└──────────────────────────────────────────────────────────────┘
                            ▲
                            │ useLiveQuery / mutators / Zustand
                            │
┌──────────────────────────────────────────────────────────────┐
│                  Domain layer (domains/)                     │
│   Mutators tipados, queries reusables, reglas de negocio.    │
│   Acepta una `Database` por inyección — sin React adentro.   │
└──────────────────────────────────────────────────────────────┘
                            ▲
                            │ db.query / db.insert / transactions
                            │
┌──────────────────────────────────────────────────────────────┐
│                  Storage layer (lib/db/)                     │
│   expo-sqlite + Drizzle ORM. Schema único. Migrations.       │
│   Reactivo vía useLiveQuery (subscriptions por tabla).       │
└──────────────────────────────────────────────────────────────┘
                            ▲
                            │ (sync engine — opcional, fase 2+)
                            │
┌──────────────────────────────────────────────────────────────┐
│                  Sync engine (lib/sync/)                     │
│   Op-log local → push al backend; pull deltas → apply local. │
└──────────────────────────────────────────────────────────────┘
                            ▲
                            │ HTTP / WebSocket
                            │
┌──────────────────────────────────────────────────────────────┐
│                  Backend (artifacts/api-server)              │
│   Hono o tRPC + Drizzle (Postgres). Auth anónimo.            │
└──────────────────────────────────────────────────────────────┘
```

### Reglas de oro

- **Las pantallas no acceden al storage directo.** Solo a domain layer.
- **El domain layer no importa React.** Se testea con Vitest sin DOM.
- **Una mutación = una transacción.** El user no puede ver el estado a medio aplicar.
- **El sync no afecta la API local.** Las pantallas no saben si una sesión vino del server o se creó local.

---

## 5. Drizzle: schema compartido SQLite ↔ Postgres

El monorepo ya tiene `lib/db` apuntando a Postgres. Lo ampliamos con un módulo paralelo para SQLite que **comparte tipos y nombres de columnas** con Postgres, asegurando que el wire-format sea simétrico.

### Estructura

```
lib/db/
  src/
    schema/
      sqlite/         # tablas para expo-sqlite (local)
        sessions.ts
        sets.ts
        ...
      postgres/       # tablas para Postgres (server)
        sessions.ts
        sets.ts
        ...
      shared/         # tipos derivados, zod schemas
        index.ts
    client/
      sqlite.ts       # crea drizzle instance contra expo-sqlite
      postgres.ts     # crea drizzle instance contra Pool
    migrations/
      sqlite/
      postgres/
```

> Drizzle no soporta dialect-agnostic schemas a 2026. Tener archivos paralelos es la práctica recomendada — los tipos generados (`$inferSelect`, `$inferInsert`) son los que realmente se comparten.

### Ejemplo: `sessions` table

**SQLite** (`lib/db/src/schema/sqlite/sessions.ts`):

```ts
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";

export const workoutSessions = sqliteTable("workout_sessions", {
  id: text("id").primaryKey(),
  routineId: text("routine_id"),
  routineDayId: text("routine_day_id"),
  routineName: text("routine_name").notNull(),
  dayName: text("day_name").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  totalVolumeKg: integer("total_volume_kg").notNull().default(0),
  notes: text("notes"),
  // Op-log metadata for sync (lo retomamos en sección 12)
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }), // soft delete
});

export const insertWorkoutSessionSchema = createInsertSchema(workoutSessions);
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = typeof workoutSessions.$inferInsert;
```

**Postgres** (mirror, en `schema/postgres/sessions.ts`):

```ts
import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const workoutSessions = pgTable("workout_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),  // ← server-side multi-tenant
  routineId: text("routine_id"),
  routineDayId: text("routine_day_id"),
  routineName: text("routine_name").notNull(),
  dayName: text("day_name").notNull(),
  startedAt: timestamp("started_at", { mode: "date" }).notNull(),
  endedAt: timestamp("ended_at", { mode: "date" }),
  totalVolumeKg: integer("total_volume_kg").notNull().default(0),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
});
```

Notar:
- Columnas idénticas excepto `userId` (server-only) y los `mode`s de timestamp.
- Misma `id: text` (no autoincrement) — generamos UUIDs en cliente. Es **esencial** para local-first: el cliente no puede esperar al server para asignar id.
- `updatedAt` y `deletedAt` son los pilares del sync diferencial.

### Tablas a definir (basadas en `types/index.ts` actual)

- `exercises` (preset + custom)
- `routines`
- `routine_days`
- `routine_exercises`
- `workout_sessions`
- `completed_sets`
- `pr_records` (puede salir de `sessions.prsAchieved` JSON o tabla aparte; recomiendo aparte para queries)
- `body_weights`
- `body_measurements`
- `progress_photos`
- `food_items`
- `food_entries`
- `recipes` (cuando 4.10)
- `fitness_goals`
- `scheduled_routines` (plan semanal)
- `schedule_overrides` (per-date)
- `session_plans` (per-date pre-planeo)
- `achievements_unlocked`
- `user_profile` (1 fila, KV o singleton table)
- `key_value` (catch-all para defaults: `defaultRestSeconds`, etc.)
- `volume_targets` (override de targets MEV/MAV/MRV)
- `outbox` (op-log para sync — fase 2)

### Tipos generados → reemplazan `types/index.ts` a mano

```ts
// lib/db/src/schema/shared/index.ts
export type { WorkoutSession, InsertWorkoutSession } from "../sqlite/sessions";
export type { CompletedSet } from "../sqlite/sets";
// ...
```

Y en la app:
```ts
import type { WorkoutSession } from "@workspace/db";
```

`types/index.ts` queda solo para tipos no-DB (tipos de UI, helpers, unions).

### Sets → tabla aparte (no JSON anidado)

Hoy `WorkoutSession.sets: CompletedSet[]` es un array embebido. En SQLite lo separamos:

```ts
export const completedSets = sqliteTable("completed_sets", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => workoutSessions.id),
  exerciseId: text("exercise_id").notNull(),
  weight: real("weight").notNull(),
  reps: integer("reps").notNull(),
  rpe: real("rpe"),
  isWarmup: integer("is_warmup", { mode: "boolean" }).notNull(),
  setIndex: integer("set_index").notNull(),
  note: text("note"),                                // 4.3 del ROADMAP
  completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
```

Ventajas:
- Queries directas: "todos los sets > 100 kg de bench" en una sola SELECT.
- Escala bien: 50000 sets son 50000 filas, no un blob inflado.
- PR detection se vuelve un `MAX(weight) GROUP BY exercise_id`.

---

## 6. Reactividad con `useLiveQuery`

Drizzle tiene un hook nativo para `expo-sqlite` que se subscribe a las tablas referenciadas en una query y re-renderiza solo cuando cambian.

```ts
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "@/lib/db/client";
import { workoutSessions } from "@workspace/db/schema/sqlite";
import { isNotNull, desc } from "drizzle-orm";

export function useFinishedSessions() {
  return useLiveQuery(
    db
      .select()
      .from(workoutSessions)
      .where(isNotNull(workoutSessions.endedAt))
      .orderBy(desc(workoutSessions.endedAt)),
  );
}
```

Uso en componente:

```tsx
export function ProgressScreen() {
  const { data: finished } = useFinishedSessions();
  // re-renderiza únicamente cuando muta workout_sessions.
  // Si el usuario edita su perfil o loguea comida, este componente no parpadea.
}
```

### Comparativa con el modelo actual

| Mutación | `useIronLog()` (hoy) | `useLiveQuery` (propuesto) |
|---|---|---|
| Loguear un set | Re-render de home + workout + progress + nutrition + body | Re-render solo de los componentes que lean `completed_sets` |
| Cambiar nombre del perfil | Re-render de TODO | Re-render solo de los que lean `user_profile` |
| Loguear food entry | Re-render de TODO | Re-render solo de nutrition |

Diferencia gigante a 50+ pantallas.

### Patrón de hooks por dominio

Convención: cada feature exporta sus hooks pegados a la entidad.

```ts
// domains/workout/queries.ts
export function useActiveSession() { ... }
export function useSessionById(id: string) { ... }
export function useFinishedSessions(opts?: { limit?: number }) { ... }
export function useTodaySessions() { ... }
export function useSetsForExercise(exerciseId: string) { ... }
export function useExercisePRs(exerciseId: string) { ... }
```

Las pantallas componen estos hooks. La capa de hooks es la API pública del dominio.

---

## 7. Mutators y comandos

Una mutación cumple 3 responsabilidades:

1. **Validar** la entrada (Zod schema).
2. **Aplicar** la transacción contra la DB local.
3. **Encolar** la op en el outbox para sync (cuando exista).

### Forma de un mutator

```ts
// domains/workout/mutators.ts
import { z } from "zod";
import { db } from "@/lib/db/client";
import { completedSets } from "@workspace/db/schema/sqlite";
import { uid } from "@/utils/id";
import { enqueueOp } from "@/lib/sync/outbox";

const LogSetInput = z.object({
  sessionId: z.string(),
  exerciseId: z.string(),
  weight: z.number().nonnegative(),
  reps: z.number().int().positive(),
  rpe: z.number().min(1).max(10).optional(),
  isWarmup: z.boolean(),
  setIndex: z.number().int().nonnegative(),
});

export async function logSet(input: z.infer<typeof LogSetInput>) {
  const parsed = LogSetInput.parse(input);
  const id = uid();
  const now = Date.now();

  await db.transaction(async (tx) => {
    await tx.insert(completedSets).values({
      id,
      ...parsed,
      completedAt: now,
      updatedAt: now,
    });

    // Outbox para sync (fase 2). Si todavía no hay sync, enqueueOp es no-op.
    await enqueueOp(tx, { kind: "insert", table: "completed_sets", id });
  });

  return id;
}
```

### Por qué este patrón gana

- **Testeable sin React.** Vitest + SQLite in-memory + assert.
- **Reusable** desde cualquier capa: pantalla, deeplink handler, background task.
- **Atómico.** Si el insert falla, el outbox no se ensucia.
- **Tipado de punta a punta.** Zod valida runtime, TS valida compile-time, Drizzle valida la columna.

### Migración suave desde el context actual

El `IronLogContext` puede seguir existiendo como **fachada delgada** que llama mutators internamente, durante la transición:

```ts
// versión transicional del context
const logSet = useCallback((sessionId, set) => {
  return mutators.workout.logSet({ sessionId, ...set });
}, []);
```

Las pantallas siguen funcionando, mientras movemos lecturas pantalla por pantalla a `useLiveQuery`. Después borrás el context.

---

## 8. UI state efímero (Zustand)

No todo el estado merece ir a la DB. Cosas como:

- ¿Está abierto el `DaySwapSheet`?
- ¿Cuál es el ejercicio cuyo action sheet está abierto?
- Drafts de inputs antes de loggear.
- Estado de un wizard multi-paso.
- Filtros activos en `progress.tsx`.

Esto es **estado efímero**: no persiste, no sync, no DB.

### Hoy

Vive en `useState` local o en el context global mezclado con datos persistentes (ej. `activeWorkoutId` está en el context cuando podría ser efímero).

### Propuesta

[Zustand](https://github.com/pmndrs/zustand) — una librería de ~500 LOC, sin Provider, basada en hooks. La uso así:

```ts
// domains/workout/ui.ts
import { create } from "zustand";

interface WorkoutUIStore {
  actionSheetExerciseId: string | null;
  swapSheetOpen: boolean;
  openActionSheet: (exId: string) => void;
  closeActionSheet: () => void;
  openSwapSheet: () => void;
  closeSwapSheet: () => void;
}

export const useWorkoutUI = create<WorkoutUIStore>((set) => ({
  actionSheetExerciseId: null,
  swapSheetOpen: false,
  openActionSheet: (exId) => set({ actionSheetExerciseId: exId }),
  closeActionSheet: () => set({ actionSheetExerciseId: null }),
  openSwapSheet: () => set({ swapSheetOpen: true }),
  closeSwapSheet: () => set({ swapSheetOpen: false }),
}));
```

Uso:
```tsx
const open = useWorkoutUI((s) => s.openActionSheet);
const id = useWorkoutUI((s) => s.actionSheetExerciseId);
```

Subscription granular: el componente solo re-renderiza cuando el slice elegido cambia.

### Cuándo Zustand vs DB

| Tipo de dato | Zustand | DB |
|---|---|---|
| Sheet abierto / modal flag | ✓ | ✗ |
| Filtro activo | ✓ | ✗ (a menos que el user quiera persistirlo) |
| Texto de un input mientras tipea | ✓ | ✗ |
| Set logueado | ✗ | ✓ |
| Profile del usuario | ✗ | ✓ |
| `activeWorkoutId` (sesión en curso) | ✗ — debe persistir entre cierre y apertura | ✓ |

Regla: **¿si la app se cierra forzosamente, querés recuperar este dato? → DB.**

---

## 9. Estructura de carpetas propuesta

Reorganizar de "por capa técnica" a "por dominio + capa".

```
artifacts/ironlog/
  app/                       # rutas expo-router (sin lógica de negocio)
    (tabs)/
    workout/
    ...
  components/
    ui/                      # design system (Button, Card, Text...)
    workout/                 # componentes de workout (SetRow, RestTimer...)
    nutrition/
    body/
    ...
  domains/                   # NUEVO — lógica + queries + mutators por dominio
    workout/
      queries.ts             # useActiveSession, useFinishedSessions, etc.
      mutators.ts            # logSet, finishWorkout, replaceSessionExercise
      computed.ts            # buildVolumeByMuscle, detectPlateaus
      ui.ts                  # zustand store efímero (sheets, modals)
      types.ts               # tipos derivados, NO los de Drizzle
    nutrition/
    body/
    schedule/
    routines/
    plans/
    achievements/
    profile/
  lib/
    db/
      client.ts              # drizzle instance contra expo-sqlite
      migrations.ts          # runner que aplica las migrations al boot
      seed.ts                # seed inicial (presets de ejercicios, comidas)
    sync/
      outbox.ts              # encoder de ops + cola
      client.ts              # push/pull contra el backend (cuando exista)
    haptics.ts
    logger.ts
  contexts/
    ThemeContext.tsx         # queda — UI puro
    # IronLogContext.tsx ← se elimina al final de la migración
  utils/
    id.ts
    date.ts
    calculations.ts
    volume.ts
  constants/
    exercises.ts             # solo seed data
    foods.ts
    presetRoutines.ts
    achievements.ts
    volumeTargets.ts
    colors.ts
```

### Reglas que esto fuerza

- `app/` no importa de `lib/db` ni de Drizzle. Solo de `domains/`.
- `domains/` no importa de `app/` ni de `components/`.
- `components/ui/` no importa nada de `domains/`.
- `lib/db/` no importa de React.

Esto se valida con `eslint-plugin-import` + reglas de `no-restricted-imports`.

---

## 10. Migraciones de schema

### Hoy

```ts
const parsed = JSON.parse(raw) as Partial<PersistedState>;
setState({ ...DEFAULT_STATE, ...parsed, profile: { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) } });
```

Es una "migración mágica" — funciona para agregar campos opcionales pero falla silencioso para renames, defaults complejos o invariantes.

### Propuesta

`drizzle-kit` genera migrations SQL al cambiar el schema. En el cliente, las aplicamos al boot:

```ts
// lib/db/migrations.ts
import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "../../drizzle/migrations.json";

export async function runMigrations(db: Database) {
  await migrate(db, migrations);
}
```

```ts
// app/_layout.tsx (al inicio)
useEffect(() => {
  runMigrations(db).catch(reportToSentry);
}, []);
```

`drizzle-kit` versiona cada cambio:
```
drizzle/
  migrations/
    0000_initial_schema.sql
    0001_add_session_plans.sql
    0002_add_skipped_exercise_ids.sql
    ...
```

### Migración inicial: importar AsyncStorage existente

Para no romper a usuarios que ya tienen datos:

1. Al primer boot post-update, leer la clave `ironlog:v1`.
2. Mapear cada array al schema SQLite.
3. Insertar en transacción.
4. Marcar `ironlog:v1` como migrado (`ironlog:v1:migrated = true`).
5. (Opcional, después de N días) borrar el blob viejo.

Pseudocódigo:

```ts
async function migrateFromLegacyStorage(db: Database) {
  const flag = await AsyncStorage.getItem("ironlog:v1:migrated");
  if (flag === "true") return;
  const raw = await AsyncStorage.getItem("ironlog:v1");
  if (!raw) {
    await AsyncStorage.setItem("ironlog:v1:migrated", "true");
    return;
  }
  const legacy = JSON.parse(raw) as LegacyState;
  await db.transaction(async (tx) => {
    for (const s of legacy.sessions ?? []) {
      await tx.insert(workoutSessions).values(mapLegacySession(s));
      for (const set of s.sets) {
        await tx.insert(completedSets).values(mapLegacySet(set, s.id));
      }
    }
    // ... resto de las entidades
  });
  await AsyncStorage.setItem("ironlog:v1:migrated", "true");
}
```

### Rollback no existe en SQLite (fácil)

Drizzle no soporta `down` migrations. Convivís con eso así:
- Cada migration **solo agrega**: nuevas columnas como nullable, nuevas tablas.
- Para "remove column" → en realidad: nueva tabla sin la columna, INSERT SELECT, drop, rename.
- Versioning del schema (campo en tabla `_meta`) por si querés bloquear apps viejas.

---

## 11. Backend: cuando, qué y cómo

### Cuándo construirlo

Tres triggers concretos:

1. **Backup en la nube** se vuelve necesario (usuarios que pierden el celular y se pierde su data) — feature 6.2 del ROADMAP.
2. **Multi-device** (iPhone + iPad + Mac) — feature 6.3.
3. **Web companion** para editar rutinas con teclado grande — feature 6.4.

Hasta que uno de esos sea fuerte, **no construyas backend**. La app local-first ya es valor diferencial.

### Stack

Cuando llegue el momento, este es el stack que recomiendo, anclado a lo que ya tenés en el monorepo:

- **Hosting / runtime**: Vercel (ya hay skills para deploy).
- **DB**: Vercel Postgres (Neon under the hood) — gratis hasta cierto umbral, cero ops.
- **ORM**: el `@workspace/db` con Drizzle ya configurado para Postgres.
- **API**:
  - **Hono** (ligero, edge-friendly) si querés simple REST/RPC.
  - **tRPC** si querés tipos end-to-end y consumís solo desde TS.
  - Mi recomendación: **Hono + Zod** — más portable, no te ata a TS en el cliente.
- **Validación**: Zod — ya en catalog.
- **Auth**: ver subseccción.
- **Logging**: pino (ya en api-server) + Sentry para errores.
- **Cron**: Vercel Cron Jobs para limpieza de outbox viejas, cleanup de backups expirados.

### API: forma de los endpoints

Para sync local-first, dos endpoints son el corazón:

```
POST /v1/sync/push
Body: { ops: Op[], lastKnownClock: number }
Response: { applied: OpId[], conflicts: Conflict[], serverClock: number }

GET /v1/sync/pull?since=<clock>
Response: { ops: Op[], serverClock: number }
```

Más endpoints utilitarios:

```
POST /v1/auth/recovery/issue       → emite un código de recuperación
POST /v1/auth/recovery/redeem      → cambia código por token
POST /v1/backup/snapshot           → blob cifrado (alternativa a sync)
GET  /v1/backup/restore?code=...   → trae blob
GET  /v1/health
```

Todo cerrado bajo un token Bearer obtenido del flujo de recovery.

### Auth — empezar simple

#### V1: código de recuperación anónimo (sin email)

Inspirado en Signal y apps como Standard Notes:
1. Al primer activar backup, el cliente genera localmente un secret de 32 bytes random.
2. Lo codifica en BIP39 (12 palabras) o en un código de 12 caracteres alfanuméricos.
3. El cliente deriva una clave AES-256 vía PBKDF2.
4. El blob cifrado va al backend con el hash del código como id.
5. En otro device: usuario tipea las 12 palabras → mismo hash → recupera el blob → desencripta local.

**Server nunca ve la data en claro. No hay PII.**

UX: pantalla de "Activá backup" muestra el código una vez con un "Copiá esto". Onus en el usuario.

#### V2: cuando crezcas, sumá Clerk o Better Auth

El recovery code anónimo es excelente para retention temprana ("pruebo sin compromiso") pero a la larga la gente quiere "iniciar sesión con Apple". Ambas soluciones se integran con Vercel y mantienen el modelo de tokens Bearer.

### Multi-tenancy

En todas las tablas Postgres: `userId TEXT NOT NULL` + index. Filtros en cada query del server. Cliente solo ve lo suyo.

---

## 12. Estrategias de sync

Tres opciones reales, en orden de complejidad. Picá según el dolor.

### Opción A — Snapshot backup (la más simple, local-first parcial)

Cada N minutos (o al sleep), pushear el blob entero cifrado al backend. Restore = pull blob, descifrar, reemplazar.

**Cuándo**: hasta que aparezca multi-device.
**Ventajas**: trivial. Cero conflictos. Backup gratis.
**Desventajas**: no hay sync real entre devices. El último que pushea pisa al otro.

```
Cliente: cada cambio → marcar dirty. Cada 5min, si dirty → push snapshot.
Server: solo guarda el último snapshot por user.
```

Esto resuelve el caso "perdí el celular" con cero infra de sync. Es lo que recomiendo de **fase 3 del ROADMAP** (cloud backup anónimo).

### Opción B — Op-log custom con LWW (sync real, hand-rolled)

Cada mutación local genera una **operación** (`{kind, table, id, payload, lamportClock}`). Las ops se guardan en una tabla `outbox`. Un sync engine las pushea al server, recibe ops remotas, las aplica.

**Conflict resolution**: last-write-wins por timestamp, sobre filas. Para entidades que crecen sin reescribir (como `completed_sets`), no hay conflicto real — solo concatenación.

**Cuándo**: sync entre 2-3 devices del mismo usuario, data simple, sin colaboración multi-user.

**Esfuerzo**: ~3-4 semanas de un dev senior. Las trampas:
- Lamport clocks vs server clocks.
- Idempotencia (no aplicar la misma op dos veces).
- Schema evolution (un cliente vieja que envía una op con un campo nuevo).
- Manejo de conflictos donde LWW no sirve (ej. dos clientes editan el mismo set distinto).

### Opción C — PowerSync o ElectricSQL (managed sync)

Estas plataformas dan sync real Postgres↔SQLite con conflict resolution incluido.

| | PowerSync | ElectricSQL |
|---|---|---|
| Modelo | Streaming Postgres → SQLite | Logical replication Postgres ↔ SQLite |
| Hosting | Servicio managed | Self-host o Cloud |
| Open source | Cliente sí, server no | Sí (Apache 2) |
| Madurez 2026 | Producción | Producción (1.0+) |
| Curva | Suave | Media (CRDTs, conceptos nuevos) |
| Costo | Pago por filas/conexión | Gratis self-hosted; managed pago |
| Soporta Drizzle | Sí | Sí |

**Cuándo**: cuando el caso Opción B se vuelve insostenible (3+ devices con escrituras concurrentes, conflictos frecuentes, schema evolution dolorosa).

Mi recomendación: empezar en **A** (snapshot), saltar a **C** (PowerSync) cuando justifique. Saltarse B excepto si te encanta meter mano en sync.

### Forma de la tabla `outbox`

Usable en B y C:

```ts
export const outbox = sqliteTable("_outbox", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["insert", "update", "delete"] }).notNull(),
  table: text("table").notNull(),
  rowId: text("row_id").notNull(),
  payload: text("payload", { mode: "json" }),
  lamportClock: integer("lamport_clock").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  pushedAt: integer("pushed_at", { mode: "timestamp_ms" }),  // null = pendiente
});
```

`enqueueOp` agrega filas. Un worker en background:
1. Toma ops con `pushedAt IS NULL`.
2. Las envía al server en batches.
3. Marca `pushedAt = now` cuando confirma.
4. Reintenta con backoff exponencial si falla.

---

## 13. Plan de migración por fases

Cada fase tiene **criterio de salida** y **rollback plan**. No avanzar a la siguiente sin cumplir el criterio.

### Fase 0 — Preparación (1-2 días)

- [ ] Agregar `expo-sqlite` a deps de `artifacts/ironlog`.
- [ ] Crear `lib/db/src/schema/sqlite/` con tablas vacías que reflejen los tipos actuales.
- [ ] Configurar `drizzle-kit` para SQLite (segundo config junto al actual de Postgres).
- [ ] Generar migration inicial.

**Criterio de salida**: `pnpm run drizzle:generate` produce SQL coherente sin errores.

### Fase 1 — Storage paralelo (1 sem)

- [ ] Crear `lib/db/src/client/sqlite.ts` que abre la DB.
- [ ] Aplicar migrations al boot en `_layout.tsx`.
- [ ] Implementar `migrateFromLegacyStorage` (one-shot).
- [ ] El context sigue funcionando — la DB queda llena en paralelo, sin que las pantallas la lean todavía.

**Criterio de salida**: tests verifican que un blob de AsyncStorage produce las mismas filas en SQLite.

**Rollback**: si algo falla, los datos en AsyncStorage siguen intactos. Borrás la DB y reintentas.

### Fase 2 — Lecturas reactivas (2 sem)

Pantalla por pantalla:

- [ ] Crear hooks de queries en `domains/<area>/queries.ts`.
- [ ] Reemplazar consumo de `useIronLog().X` por hooks granulares.
- [ ] Verificar manualmente que cada pantalla sigue funcionando.

Orden recomendado:
1. `progress.tsx` (pocas mutaciones, fácil verificar).
2. `(tabs)/index.tsx` (muchas lecturas).
3. `(tabs)/workout.tsx`.
4. `workout/active.tsx` (la más compleja — al final).
5. Resto.

**Criterio de salida**: `useIronLog()` ya no se usa para *lecturas* en ninguna pantalla. Solo para mutaciones (todavía).

**Rollback**: por pantalla, revertir el commit.

### Fase 3 — Mutators tipados (1-2 sem)

- [ ] Crear mutators en `domains/<area>/mutators.ts`.
- [ ] Reemplazar funciones del context con llamadas a mutators.
- [ ] Eliminar `IronLogContext`. El `_layout.tsx` ya no lo monta.

**Criterio de salida**: no hay referencias a `useIronLog()` ni a `IronLogProvider`. Borrás el archivo.

### Fase 4 — Zustand para UI state (2-3 días)

- [ ] Crear stores efímeros donde haga falta (`workout/ui.ts`, `nutrition/ui.ts`).
- [ ] Mover state de `useState` global a Zustand donde corresponda (sheets, modals, etc.).

**Criterio de salida**: prop drilling de "is open" eliminado en componentes raíz.

### Fase 5 — Testing (1 sem)

- [ ] Setup Vitest + `better-sqlite3` para tests in-memory.
- [ ] Tests por mutator (logSet, finishWorkout, swapDates, replaceSessionExercise...).
- [ ] Tests por query (volumeByMuscle, plateauDetector...).
- [ ] CI ejecuta el suite.

**Criterio de salida**: cobertura > 70% en `domains/`.

### Fase 6 — Backup snapshot (cuando lo pidan) (1 sem)

- [ ] Endpoint `/v1/backup/snapshot` y `/v1/backup/restore` en `api-server`.
- [ ] Cliente: pantalla "Activar backup", emite código, encripta blob, pushea.
- [ ] Restore: pantalla "Restaurar con código".

**Criterio de salida**: caso "instalo en otro celular y recupero todo" funciona end-to-end.

### Fase 7 — Sync real (cuando duela) (4-8 sem)

Idealmente PowerSync o ElectricSQL.

- [ ] Setup hosted o self-host.
- [ ] Migrar tablas `outbox` y configurar replicación.
- [ ] Live testing con 2 devices durante 1 semana antes de release.

**Criterio de salida**: 2 devices del mismo usuario convergen en < 5s tras una mutación.

---

## 14. Testing

### Unit (Vitest + better-sqlite3)

```ts
// domains/workout/mutators.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@workspace/db/schema/sqlite";
import { logSet } from "./mutators";

let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle/migrations" });
});

describe("logSet", () => {
  it("inserts a set and assigns an id", async () => {
    // seed a session...
    const id = await logSet(db, {
      sessionId: "s1",
      exerciseId: "ex1",
      weight: 80, reps: 10, isWarmup: false, setIndex: 1,
    });
    expect(id).toMatch(/^[a-z0-9-]+$/);
    const row = await db.select().from(schema.completedSets).get();
    expect(row.weight).toBe(80);
  });

  it("rejects negative weight", async () => {
    await expect(logSet(db, { ...invalid, weight: -5 })).rejects.toThrow(/nonnegative/);
  });
});
```

### E2E (Maestro o Detox)

Tres flows críticos:
- Onboarding → log primer set → finish → ver summary.
- Plan tomorrow → start tomorrow → planned values pre-cargan.
- Skip ejercicio → ver volumen sin contar el saltado.

Frecuencia: por PR a `main`.

### Migration tests

Por cada nueva migration, fixtures con DB en versión anterior + assert que aplica correctamente.

---

## 15. Observabilidad

### Logging local

`lib/logger.ts` con niveles. En dev console, en prod silencioso (excepto errores).

### Crash reporting

Sentry SDK con `expo-application` y `expo-device`. Cubrir el `ErrorBoundary` para reportar render errors.

### Telemetría producto

Posthog (opt-in en settings). Eventos clave:
- `onboarding_done`
- `set_logged`
- `workout_finished`
- `pr_detected`
- `plan_created`
- `plan_used` (cuántos sets pre-cargados se aceptaron sin editar)

Sin PII. Sin contenido del usuario.

### Performance budgets

- Boot a interactivo: < 1.5 s en iPhone X / SE2.
- Log set → re-render: < 32 ms (60fps).
- Switch tab: < 100 ms.

Profiler de React DevTools + flamegraphs cada release.

---

## 16. Advertencias y trade-offs

### Cosas que duelen

- **Migrar a SQLite no es free.** Es ~2-4 semanas de un dev senior haciéndolo bien. No empieces un viernes.
- **Drizzle SQLite y Drizzle Postgres tienen quirks distintos.** `boolean` no existe en SQLite (es integer 0/1). Timestamps son números o ISO strings, no `Date`. Lo manejamos con `mode: "timestamp_ms"` y `mode: "boolean"` en Drizzle, pero hay que mantener la atención.
- **`useLiveQuery` re-renderiza por tabla, no por fila.** Si tu home lee `workout_sessions` y mutás cualquier sesión, el home re-renderiza. Para fine-grained subscriptions necesitarías otra librería (legend-state, valtio). En la práctica, no hace falta hasta tener > 1000 sesiones visibles.
- **El sync es genuinamente difícil.** Si hand-rolleas (Opción B), planificá tiempo de calidad para edge cases. Considerá saltar directo a PowerSync si tu caso lo permite.
- **iCloud Sync es notoriamente difícil.** Sí, es tentador no tener server. Pero los conflictos, los entitlements y la falta de visibilidad en producción te van a hacer perder días. Recomiendo backup-en-server > iCloud.
- **AsyncStorage vs SQLite race**: durante Fase 1, puede haber una ventana donde escrites a AsyncStorage *y* a SQLite. Asegurate de que **una** sea la fuente de verdad; la otra es read-only mientras dure la migración.

### Cosas que NO ship-earía sin pensarlo dos veces

- **GraphQL/Apollo**: heavy, no offline-first natural.
- **WatermelonDB**: era el gold standard hace años; sigue siendo bueno pero la integración con server es más oscura que Drizzle. Menos comunidad TS.
- **Realm/MongoDB Atlas Sync**: vendor lock-in, modelo NoSQL no encaja con la naturaleza estructurada de los datos.
- **Firebase**: lock-in fuerte, no SQL, latencia comparada al local-first.
- **Redux/Redux Toolkit**: para state management cliente está bien, pero no aporta nada sobre Zustand y suma boilerplate.
- **MMKV** como reemplazo de AsyncStorage: es solo KV, no resuelve queries — la app eventualmente las necesita.

### Cosas con las que hay que tener cuidado

- **El cliente genera UUIDs** — usar `nanoid` o `uuid v7` (timestamp-prefixed) para IDs ordenables.
- **`updatedAt` y `deletedAt` deben actualizarse SIEMPRE** en cada mutator — no se pueden olvidar. Considerá un trigger SQLite o un wrapper de mutator.
- **Soft delete para sync**: nunca hagas DELETE físico hasta el cleanup-job nocturno. Los devices con sync diferida necesitan ver el "delete" como un cambio.
- **Tamaño del schema**: definir todo arriba (cuánto pesa cada blob, cuántas filas estimás a 1 año) ayuda a no colocar JSONs gigantes en columnas.

---

## 17. ADRs (decisiones documentadas)

Convención: cada decisión arquitectónica importante guarda un archivo en `docs/adr/NNN-titulo.md`. Formato breve.

A continuación un boilerplate y los primeros 5 ADRs propuestos.

### Plantilla
```md
# ADR-NNN: <Título>
**Status**: Proposed | Accepted | Deprecated
**Date**: YYYY-MM-DD

## Contexto
Qué problema resolvemos.

## Decisión
Qué elegimos hacer.

## Alternativas consideradas
1. ...
2. ...

## Consecuencias
- Positivas: ...
- Negativas: ...
```

### ADR sugeridos para empezar
- **ADR-001**: SQLite + Drizzle como storage local (vs MMKV vs WatermelonDB vs realm).
- **ADR-002**: Op-log con LWW como modelo de sync inicial (vs CRDT).
- **ADR-003**: UUID v7 generado en cliente como primary key (vs autoincrement server-asignado).
- **ADR-004**: Zustand para UI efímera (vs Jotai vs Context).
- **ADR-005**: Auth con código de recuperación anónimo en V1 (vs OAuth).

---

## 18. Glosario

- **Local-first**: arquitectura donde el cliente tiene una DB completa que es la fuente de verdad; el server es backup + canal de sync.
- **Op-log**: bitácora de mutaciones (insert/update/delete) que se replican entre devices.
- **CRDT**: Conflict-free Replicated Data Type. Estructuras que mergean determinísticamente sin coordinación. Ejemplo: contadores G-Counter, listas RGA.
- **LWW**: Last-Write-Wins. Política de conflictos: gana la mutación con timestamp más reciente.
- **Lamport clock**: contador lógico monotónico para ordenar eventos en sistemas distribuidos sin reloj global.
- **Watermark**: marca de tiempo (o clock) que indica "ya sincronicé hasta acá". Server pull desde el watermark devuelve cambios nuevos.
- **Outbox pattern**: tabla local de ops pendientes de pushear. Garantiza que la mutación al storage y al outbox son atómicas (misma transacción).
- **Soft delete**: marcar `deletedAt` en lugar de borrar la fila. Necesario para que devices con sync diferida sepan que algo se borró.
- **Snapshot sync**: pushear el estado entero como blob, sin granularidad. Simple pero pisa cambios concurrentes.
- **Reactive query**: query que re-emite resultados cuando los datos subyacentes cambian, sin que el código consumidor invalide explícitamente.

---

## Notas de mantenimiento

- Cada decisión arquitectónica que rompa con este doc va con un ADR nuevo.
- Cuando una fase del plan de migración se cierra, marcala con `[x]` y datada.
- Cuando aparezca una librería nueva en consideración, agregala a la sección 16 con el dictamen (recomendada / no recomendada / a evaluar).
- Antes de meter una decisión grande en producción, abrila como issue y pedí review — la arquitectura se cae cuando los criterios no son visibles.
