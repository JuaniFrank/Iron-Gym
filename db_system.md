# IronLog — Sistema de datos persistente

> Plan completo de la capa de datos: estado actual del storage + arquitectura
> local-first propuesta (SQLite + Drizzle, sync, backend opcional). Reemplaza
> los antiguos `db.md` y `backend.md` en lo que respecta a persistencia.
>
> Doc vivo. Cada decisión arquitectónica importante se marca con un ADR
> (Architecture Decision Record); cada fase de migración tiene su criterio
> de salida.
>
> **Ámbito**: este doc cubre la capa de datos. Para el state management
> efímero (Zustand, UI state) ver `state_mang_system.md`.

---

## Índice

1. [Estado actual del storage](#1-estado-actual-del-storage)
2. [Modelo de datos persistido (hoy)](#2-modelo-de-datos-persistido-hoy)
3. [Backend que existe pero no se usa](#3-backend-que-existe-pero-no-se-usa)
4. [Inventario de librerías de datos](#4-inventario-de-librerías-de-datos)
5. [Flujo de datos típico (hoy)](#5-flujo-de-datos-típico-hoy)
6. [Por qué deja de escalar](#6-por-qué-deja-de-escalar)
7. [Lo que sí está bien posicionado](#7-lo-que-sí-está-bien-posicionado)
8. [Principios local-first](#8-principios-local-first)
9. [Stack propuesto (TL;DR)](#9-stack-propuesto-tldr)
10. [Arquitectura por capas](#10-arquitectura-por-capas)
11. [Drizzle: schema compartido SQLite ↔ Postgres](#11-drizzle-schema-compartido-sqlite--postgres)
12. [Reactividad con useLiveQuery](#12-reactividad-con-uselivequery)
13. [Mutators y comandos](#13-mutators-y-comandos)
14. [Estructura de carpetas (DB-relevant)](#14-estructura-de-carpetas-db-relevant)
15. [Migraciones de schema](#15-migraciones-de-schema)
16. [Backend: cuándo, qué y cómo](#16-backend-cuándo-qué-y-cómo)
17. [Estrategias de sync (con evaluación de Turso)](#17-estrategias-de-sync-con-evaluación-de-turso)
18. [Plan de migración por fases](#18-plan-de-migración-por-fases)
19. [Testing](#19-testing)
20. [Observabilidad](#20-observabilidad)
21. [Advertencias y trade-offs](#21-advertencias-y-trade-offs)
22. [ADRs](#22-adrs)
23. [Comandos útiles](#23-comandos-útiles)
24. [Glosario](#24-glosario)

---

## 1. Estado actual del storage

### TL;DR

- La app mobile (`artifacts/ironlog`) **no tiene base de datos**. Todo el estado vive en memoria (`useState` en un solo Context) y se persiste serializado a JSON en **AsyncStorage** bajo una única clave: `ironlog:v1`.
- **No hay backend en uso**. El `api-server` existe en el monorepo pero solo expone `GET /api/healthz`. El cliente Expo nunca lo llama.
- El monorepo trae **scaffolding de Postgres + Drizzle** (`lib/db`) y un **pipeline OpenAPI → cliente React Query** (`lib/api-spec` → `lib/api-client-react`), pero ambos están vacíos / no integrados a la app.
- La única "base de datos" funcional hoy es **el JSON local del dispositivo**.

### 1.1 Mapa del repo desde el ángulo de datos

```
Iron-Gym/
├── artifacts/
│   ├── ironlog/                 ← App mobile (Expo). Storage real ocurre acá.
│   │   ├── contexts/IronLogContext.tsx   ← El "store" + persistencia AsyncStorage
│   │   ├── types/index.ts                ← Tipos canónicos del dominio
│   │   └── constants/                    ← Datos estáticos (seed) bundled en la app
│   └── api-server/             ← Express 5. Hoy solo /healthz. Sin DB conectada.
└── lib/
    ├── db/                     ← Drizzle + Postgres. Schema VACÍO. No usado.
    ├── api-spec/               ← OpenAPI YAML + orval (codegen)
    ├── api-zod/                ← Schemas Zod generados desde OpenAPI
    └── api-client-react/       ← Cliente React Query generado + customFetch
```

### 1.2 Persistencia en la app mobile (lo que realmente corre)

#### Mecanismo

Archivo: `artifacts/ironlog/contexts/IronLogContext.tsx`.

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "ironlog:v1";
```

- **Un único `useState<PersistedState>`** con todo el dominio (sesiones, rutinas, comidas, fotos, perfil, etc.) — ver §2.
- **Hidratación al boot**: en un `useEffect`, se hace `AsyncStorage.getItem("ironlog:v1")`, se parsea con `JSON.parse`, y se mergea contra los defaults: `{ ...DEFAULT_STATE, ...parsed, profile: { ...DEFAULT_PROFILE, ...parsed.profile } }`. El flag `isLoaded` evita renderizar consumidores hasta que termine.
- **Escritura**: otro `useEffect` dispara cada vez que `state` cambia y hace `AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))`. No hay debounce — escribe el blob entero en cada mutación.
- **Reset**: `resetAll()` hace `AsyncStorage.removeItem(STORAGE_KEY)` + `setState(DEFAULT_STATE)`.
- **Schema versioning**: desde el sprint de notes, `PersistedState.schemaVersion: number` + función `migrate(state, fromVersion)` aplican migraciones al hidratar (versión actual: 2).

#### Qué es AsyncStorage

`@react-native-async-storage/async-storage` v2.2.0. Es un key-value store asíncrono provisto por React Native.

- **iOS**: respaldado por un archivo en `Documents/RCTAsyncLocalStorage_V1/` (manifest en JSON + chunks). Sobrevive a relaunches y a updates de la app, pero **se pierde si el usuario desinstala**.
- **Android**: SQLite interno gestionado por la lib.
- **No está cifrado**. Cualquiera con acceso al sandbox de la app puede leerlo (relevante para jailbreak / backups sin cifrar).

Implicancias:
- Migraciones limitadas: la función `migrate()` ya existe pero solo agrega campos nuevos. Cambios estructurales (renames, normalizaciones) no son triviales.
- Sin queries: cada filtrado/agregación se hace en JS sobre arrays completos.
- Boot lag escalable: cuanto más grande el blob, más tarda el `getItem` + `JSON.parse`.

#### No hay otros mecanismos de storage

Búsqueda exhaustiva — no se usan:
- `expo-sqlite`
- `expo-secure-store`
- `react-native-mmkv`
- IndexedDB / `localStorage` (la app no se ejecuta en web hoy)
- File system (excepto fotos — ver siguiente punto)

#### El "Context = store"

El `IronLogContext` **es** la fuente de verdad. Cualquier componente que llame `useIronLog()` recibe **todo** el estado y se re-renderiza ante **cualquier** cambio. ~30 mutadores expuestos (`createRoutine`, `logSet`, `finishWorkout`, `addProgressPhoto`, etc.) — todos hacen `setState(prev => ({ ...prev, X: nuevoX }))`.

Esto significa que **el "store" y la "persistencia" están acoplados**: cambiar memoria implica reescribir disco.

#### Fotos de progreso (caso especial)

`ProgressPhoto.uri: string` se guarda en el JSON, pero **no son los bytes de la imagen** — es la URI que devuelve `expo-image-picker` (típicamente `file:///.../Library/Caches/ExponentExperienceData/...`). Los bytes viven en el cache de Expo / asset library del SO.

Riesgo: si iOS limpia el cache o el usuario revoca permisos, la URI puede romperse. El JSON queda con strings que apuntan a nada. Hoy no hay copia/move-to-stable-dir.

---

## 2. Modelo de datos persistido (hoy)

Definido en `artifacts/ironlog/types/index.ts`. La forma del blob serializado:

```ts
interface PersistedState {
  schemaVersion: number;
  customExercises: Exercise[];
  customFoods: FoodItem[];
  routines: Routine[];                  // contiene RoutineDay[] → RoutineExercise[]
  sessions: WorkoutSession[];           // cada una con CompletedSet[] + PRRecord[]
  bodyWeights: BodyWeightEntry[];
  measurements: BodyMeasurementEntry[];
  photos: ProgressPhoto[];
  foodEntries: FoodEntry[];
  goals: FitnessGoal[];
  schedule: ScheduledRoutine[];         // plan semanal por día de semana
  scheduleOverrides: ScheduleOverride[];// override por fecha calendario YYYY-MM-DD
  sessionPlans: SessionPlan[];          // pre-fill por fecha
  achievements: AchievementUnlock[];
  notes: SessionNote[];                 // sistema de notas (sprint 4.3)
  profile: UserProfile;                 // datos personales + goals macros
  activeWorkoutId: string | null;
  defaultRestSeconds: number;
}
```

**Convenciones que ya son DB-friendly** (heredan de la intención de migrar a SQL):
- `dateKey: "YYYY-MM-DD"` en `ScheduleOverride`, `SessionPlan` (no timestamps).
- IDs string generados por `utils/id.ts` (`uid()` → similar a UUIDv4 corto).
- Campos opcionales bien marcados con `?`.

**Defaults** (`DEFAULT_STATE` y `DEFAULT_PROFILE`) viven al inicio del Context y se aplican en el merge al hidratar.

### 2.1 Datos seed (no persistidos — bundled en JS)

Estáticos, viven en `constants/`. Se concatenan con los custom del usuario al exponerlos:

| Archivo | Qué trae | Cómo se expone |
|---|---|---|
| `exercises.ts` | 165 ejercicios | `allExercises = [...EXERCISES, ...state.customExercises]` |
| `foods.ts` | 47 alimentos | `allFoods = [...FOOD_DATABASE, ...state.customFoods]` |
| `presetRoutines.ts` | 3-4 rutinas predefinidas | `allRoutines = [...PRESET_ROUTINES, ...state.routines]` |
| `achievements.ts` | 13 achievements (definición + check fn) | `ACHIEVEMENTS` importado donde se evalúa |
| `volumeTargets.ts` | MEV/MAV/MRV por músculo | importado en pantallas de progress |
| `colors.ts` | paleta light/dark | leído por `ThemeContext` |
| `bodyParts.ts` | enum + labels de zonas para notas | importado por componentes de notes |
| `noteChips.ts` | chips default por categoría | importado por NoteSheet, QuickNoteMenu |
| `featureCatalog.ts` | catálogo de discovery progresivo | importado por servicio de discovery |

Los ejercicios y alimentos predefinidos **no se duplican** en el storage — solo viven los `customExercises` / `customFoods` creados por el usuario.

---

## 3. Backend que existe pero no se usa

### 3.1 `artifacts/api-server` — Express 5

Ruta: `artifacts/api-server/src/`.

- `index.ts`: bootstrap, lee `PORT` del env, escucha.
- `app.ts`: configura `cors`, `express.json`, `pino-http` para logging, monta `/api`.
- `routes/health.ts`: único endpoint hoy → `GET /api/healthz` devuelve `{ status: "ok" }` validado con `HealthCheckResponse` (zod).
- **No importa `@workspace/db`**. No hay handlers que toquen Postgres todavía.

Dependencias relevantes: `express@^5`, `cors`, `pino` + `pino-http`, `cookie-parser`, `drizzle-orm` (declarado pero no importado), `@workspace/db` (declarado, no importado), `@workspace/api-zod`.

### 3.2 `lib/db` — Drizzle + Postgres

```ts
// lib/db/src/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set...");
}
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

- Adaptador: `drizzle-orm/node-postgres` + `pg` v8 (Pool TCP, no edge).
- `lib/db/drizzle.config.ts`: dialecto `postgresql`, lee `DATABASE_URL` también para `drizzle-kit push`.
- Scripts: `pnpm --filter @workspace/db push` (sync schema → DB) y `push-force`.
- **Schema actual** (`lib/db/src/schema/index.ts`): **vacío**. Solo trae un comentario plantilla con el patrón esperado (tabla → `createInsertSchema` zod → tipos `Insert*` / `Select`). Ningún `pgTable` definido.
- Validación de schemas: `drizzle-zod` v0.8.3 (instalado).

Hoy no hay `DATABASE_URL` en el repo (no hay `.env*` versionado). Importar `@workspace/db` en cualquier punto **rompería en runtime** por el throw del módulo.

### 3.3 Pipeline de codegen API (`lib/api-spec` → `api-zod` + `api-client-react`)

OpenAPI-first. Fuente única: `lib/api-spec/openapi.yaml` (hoy: solo `GET /healthz` → `HealthStatus`).

Comando: `pnpm --filter @workspace/api-spec run codegen` (corre `orval`):

1. **`lib/api-zod/src/generated/`** — schemas Zod listos para validar payloads (con `useDates`, `useBigInt`, `coerce` de query/param/body/response). Re-exportados desde `lib/api-zod/src/index.ts`.
2. **`lib/api-client-react/src/generated/`** — hooks React Query (`useHealthCheck`, `getHealthCheckQueryOptions`, `getHealthCheckUrl`, etc.) atados al `customFetch` mutator.

#### `customFetch` (`lib/api-client-react/src/custom-fetch.ts`)

Wrapper sobre `fetch` con:
- **`setBaseUrl(url)`** — para builds de Expo que necesitan apuntar a un host remoto. Antepone el base URL a paths que empiezan con `/`.
- **`setAuthTokenGetter(getter)`** — registra un proveedor de Bearer token; se llama en cada request si no hay header `authorization` ya seteado. Pensado para mobile (en web los cookies se manejan solos).
- Manejo de respuestas: `application/json`, `application/problem+json`, text, blob; `responseType: "auto"` infiere por content-type.
- Errores tipados: `ApiError` (con `status`, `data`, `headers`, `response`) y `ResponseParseError` (cuando falla `JSON.parse`).
- Workarounds RN: `response.body` puede ser `undefined` aunque haya payload — usa `.text()`/`.json()` directamente.

### 3.4 React Query en la app

`@tanstack/react-query` v5.90.21 está instalado y montado:

```tsx
// artifacts/ironlog/app/_layout.tsx
const queryClient = new QueryClient();

<QueryClientProvider client={queryClient}>
  <IronLogProvider>...</IronLogProvider>
</QueryClientProvider>
```

Pero ningún archivo en `app/`, `contexts/` ni `components/` invoca hooks generados (`useHealthCheck`, etc.) ni llama `customFetch`. Tampoco se llama `setBaseUrl`. Es **infraestructura preparada, sin tráfico real**.

---

## 4. Inventario de librerías de datos

### Ya instaladas y en uso

| Paquete | Versión | Dónde / para qué |
|---|---|---|
| `@react-native-async-storage/async-storage` | 2.2.0 | **Único storage real**. `IronLogContext` lo usa. |
| `@tanstack/react-query` | catalog (^5.90.21) | Provider montado en `_layout.tsx`; sin queries activas todavía. |
| `zod` | catalog (^3.25.76) | Validación tipos en api-zod (generado). En `ironlog` no se usa para forms hoy. |
| `expo-image-picker` | ~17.0.9 | Genera URIs de fotos que terminan en el blob persistido. |

### Instaladas pero no integradas a la app mobile

| Paquete | Dónde | Estado |
|---|---|---|
| `drizzle-orm` | `lib/db`, `artifacts/api-server` | Schema vacío, no se ejecuta query alguna. |
| `drizzle-zod` | `lib/db` | Listo para `createInsertSchema` cuando haya tablas. |
| `drizzle-kit` | `lib/db` (dev) | Comando `push` listo, pero sin schema que pushear. |
| `pg` | `lib/db` | Pool definido pero nadie lo importa con `DATABASE_URL` activo. |
| `@types/pg` | `lib/db` (dev) | — |
| `orval` | `lib/api-spec` (dev) | Codegen funcional, ya generó hooks. |
| `express` v5, `cors`, `cookie-parser`, `pino`, `pino-http` | `api-server` | Servidor minimal corriendo (solo healthz). |

### NO instaladas (ausentes confirmadas)

`expo-sqlite`, `react-native-mmkv`, `expo-secure-store`, `realm`, `watermelondb`, `op-sqlite`, `tinybase`, `dexie`, `pouchdb`, `electric-sql`, `replicache`, `instantdb`, `firebase`, `supabase-js`, `aws-amplify`, `convex`, `@libsql/client` (Turso), etc.

---

## 5. Flujo de datos típico (hoy)

Ejemplo: "loguear un set".

1. Usuario completa un set en `app/workout/active.tsx` y dispara `logSet(sessionId, setData)`.
2. `IronLogContext.logSet` ejecuta `setState(prev => ({ ...prev, sessions: prev.sessions.map(...) }))`.
3. React re-renderiza **todos** los consumers de `useIronLog` (home, progress, planning, etc.) porque el `value` del Context cambia de identidad.
4. El `useEffect` de persistencia detecta el cambio en `state` y hace `AsyncStorage.setItem("ironlog:v1", JSON.stringify(state))` — escribe el blob entero, sincrónicamente con el render del JS thread (la API es async pero la serialización es bloqueante).
5. No hay round-trip a red. No hay validación con Zod. No hay batching.

Para una mutación más cara (ej. `finishWorkout` que computa PRs y achievements), pasa lo mismo: cómputo en JS sobre arrays, escritura del blob completo.

---

## 6. Por qué deja de escalar

Listo en orden de impacto creciente:

1. **Re-render ciego.** Loguear un set re-renderiza la home, nutrición, progress, planning — todo lo que toque el context. Hoy se nota poco; con 50+ pantallas y 1000+ sesiones será un freeze tangible.
2. **Persistencia O(N) en cada mutación.** Cada `setState` dispara un `JSON.stringify` del estado entero. A los 6 meses con 200 sesiones × 30 sets × 5 entries de comida diarias, el blob pasa de los MB y se vuelve lento de leer al startup (boot lag).
3. **Sin queries.** No hay índices, no hay joins. Cada lista filtrada es un scan completo en JS.
4. **Migraciones frágiles.** Renames y cambios estructurales requieren código manual en la función `migrate()`. Sin tests, alto riesgo de romper datos viejos.
5. **Una sola fuente de verdad implícita.** No hay separación entre datos persistentes (sesiones), cache de remoto (no aplica todavía) y estado de UI (sheets abiertos, drafts). Todo vive en el mismo lugar.
6. **Sin backup ni sync.** El día que el usuario cambie de teléfono pierde todo. Cuando salga la web companion no hay donde leer.
7. **Difícil de testear.** No se puede probar `finishWorkout` sin montar React.
8. **Acoplamiento entre dominios.** Cambiar la lógica de schedule te obliga a leer 800 líneas de un archivo que también maneja nutrición y body weight.
9. **Sin cifrado en disco.** AsyncStorage es texto plano, accesible a cualquier proceso con permisos al sandbox.

---

## 7. Lo que sí está bien posicionado

- **El monorepo ya tiene `@workspace/db` con Drizzle + Postgres.**
- **Los tipos están centralizados** en `types/index.ts`.
- **Los datos ya son DB-friendly**: `dateKey: YYYY-MM-DD` en `ScheduleOverride`, `SessionPlan`, etc.
- **`drizzle-zod` está como dep** — la conversión schema → tipos → validación es trivial.
- **IDs string** universales (UUID-like) — compatibles con `text PRIMARY KEY` en cualquier dialecto.
- **React Query montado** — agregar el primer hook generado es un import.
- **Schema versioning ya implementado** en el blob (`schemaVersion: 2` actual).

---

## 8. Principios local-first

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

## 9. Stack propuesto (TL;DR)

Solo capas relacionadas a datos. Para state management efímero ver `state_mang_system.md`.

| Capa | Hoy | Propuesta |
|---|---|---|
| Storage local | AsyncStorage (JSON blob) | **`expo-sqlite` + Drizzle** |
| Schema/types | `types/index.ts` a mano | **Drizzle schema → tipos generados + drizzle-zod** |
| Reads reactivos | `useIronLog()` (re-render global) | **`useLiveQuery` de Drizzle** (subscriptions por tabla) |
| Mutaciones | Funciones del context | **Mutators tipados por dominio** (puros, testeables) |
| Validación de boundaries | Tipos TS | **Zod** (entrada de API, deeplinks, AsyncStorage de migración) |
| Cache de remoto (cuando exista) | n/a | **TanStack Query** (ya en catalog) |
| Backend | n/a | **Postgres (Vercel/Neon) o libSQL (Turso) + Drizzle + Hono o tRPC** |
| Auth | n/a | **Código de recuperación anónimo** v1 → Clerk/Better Auth si crece |
| Sync (cuando exista) | n/a | **Snapshot en V1 → Op-log custom o Turso Embedded Replicas** |
| Migraciones | `migrate()` manual sobre blob | **drizzle-kit** + `migrate()` SQL al boot |
| Testing | nada | **Vitest** + SQLite in-memory (`better-sqlite3`) |

Todo lo "Propuesta" está en versiones estables a 2026 y muchas piezas ya las tenés en el monorepo.

---

## 10. Arquitectura por capas

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
│   Hono o tRPC + Drizzle (Postgres o Turso). Auth anónimo.    │
└──────────────────────────────────────────────────────────────┘
```

### Reglas de oro

- **Las pantallas no acceden al storage directo.** Solo a domain layer.
- **El domain layer no importa React.** Se testea con Vitest sin DOM.
- **Una mutación = una transacción.** El user no puede ver el estado a medio aplicar.
- **El sync no afecta la API local.** Las pantallas no saben si una sesión vino del server o se creó local.

---

## 11. Drizzle: schema compartido SQLite ↔ Postgres

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
  // Op-log metadata for sync (lo retomamos en sección 17)
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
- `session_notes` (sistema de notas — sprint 4.3 ya implementado)
- `feature_discoveries` (estado de discovery progresivo del user)
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
  completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
```

Ventajas:
- Queries directas: "todos los sets > 100 kg de bench" en una sola SELECT.
- Escala bien: 50000 sets son 50000 filas, no un blob inflado.
- PR detection se vuelve un `MAX(weight) GROUP BY exercise_id`.

### Notes → tabla específica con índices estratégicos

El sistema de notas (`SessionNote`) es candidato natural a tabla con índices precisos para soportar el body map de 4.16 sin escanear todo:

```sql
CREATE TABLE session_notes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  set_id TEXT REFERENCES completed_sets(id) ON DELETE SET NULL,
  exercise_id TEXT REFERENCES exercises(id),
  created_at INTEGER NOT NULL,
  category TEXT NOT NULL,
  body_part TEXT,
  severity INTEGER,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at INTEGER,
  text TEXT NOT NULL,
  source TEXT NOT NULL,
  audio_uri TEXT,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX idx_notes_session  ON session_notes(session_id);
CREATE INDEX idx_notes_exercise ON session_notes(exercise_id);
CREATE INDEX idx_notes_created  ON session_notes(created_at DESC);

-- Partial index crítico para 4.16 (body map de molestias activas).
CREATE INDEX idx_notes_active_pain ON session_notes(body_part, severity, created_at)
  WHERE category = 'pain' AND resolved = 0;
```

---

## 12. Reactividad con `useLiveQuery`

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

## 13. Mutators y comandos

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

## 14. Estructura de carpetas (DB-relevant)

Reorganizar de "por capa técnica" a "por dominio + capa". Solo capas de datos; para state efímero ver `state_mang_system.md`.

```
artifacts/ironlog/
  app/                       # rutas expo-router (sin lógica de negocio)
  components/                # design system + componentes feature
  domains/                   # NUEVO — lógica + queries + mutators por dominio
    workout/
      queries.ts             # useActiveSession, useFinishedSessions, etc.
      mutators.ts            # logSet, finishWorkout, replaceSessionExercise
      computed.ts            # buildVolumeByMuscle, detectPlateaus
      types.ts               # tipos derivados, NO los de Drizzle
    nutrition/
    body/
    schedule/
    routines/
    plans/
    achievements/
    notes/                   # sistema de notas (4.3 + 4.13 + 4.14)
    profile/
  lib/
    db/
      client.ts              # drizzle instance contra expo-sqlite
      migrations.ts          # runner que aplica las migrations al boot
      seed.ts                # seed inicial (presets de ejercicios, comidas)
    sync/
      outbox.ts              # encoder de ops + cola
      client.ts              # push/pull contra el backend (cuando exista)
  contexts/
    ThemeContext.tsx         # queda — UI puro
    # IronLogContext.tsx ← se elimina al final de la migración
  utils/
  constants/                 # solo seed data
```

### Reglas que esto fuerza

- `app/` no importa de `lib/db` ni de Drizzle. Solo de `domains/`.
- `domains/` no importa de `app/` ni de `components/`.
- `components/ui/` no importa nada de `domains/`.
- `lib/db/` no importa de React.

Esto se valida con `eslint-plugin-import` + reglas de `no-restricted-imports`.

---

## 15. Migraciones de schema

### Hoy

Función `migrate(state, fromVersion)` en `IronLogContext` que aplica steps encadenados:

```ts
function migrate(state, fromVersion) {
  let cur = state;
  let v = fromVersion;
  if (v < 2) {
    cur = { ...cur, notes: cur.notes ?? [] };
    v = 2;
  }
  return { ...cur, schemaVersion: CURRENT_SCHEMA_VERSION };
}
```

Funciona para agregar campos opcionales pero falla silencioso para renames, defaults complejos o invariantes.

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
    0003_add_session_notes.sql
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
    for (const note of legacy.notes ?? []) {
      await tx.insert(sessionNotes).values(mapLegacyNote(note));
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

## 16. Backend: cuándo, qué y cómo

### Cuándo construirlo

Tres triggers concretos:

1. **Backup en la nube** se vuelve necesario (usuarios que pierden el celular y se pierde su data) — feature 6.2 del ROADMAP.
2. **Multi-device** (iPhone + iPad + Mac) — feature 6.3.
3. **Web companion** para editar rutinas con teclado grande — feature 6.4.

Hasta que uno de esos sea fuerte, **no construyas backend**. La app local-first ya es valor diferencial.

### Stack propuesto

Cuando llegue el momento, este es el stack que recomiendo, anclado a lo que ya tenés en el monorepo:

- **Hosting / runtime**: Vercel (ya hay skills para deploy).
- **DB**:
  - **Vercel Postgres / Neon** (SQL, gratuito hasta cierto umbral, infra estándar). Compatible con `lib/db` actual.
  - **Turso (libSQL)** — alternativa edge-friendly con Embedded Replicas (ver §17 para evaluación detallada).
- **ORM**: el `@workspace/db` con Drizzle ya configurado para Postgres. Para Turso, `drizzle-orm/libsql`.
- **API**:
  - **Hono** (ligero, edge-friendly) si querés simple REST/RPC.
  - **tRPC** si querés tipos end-to-end y consumís solo desde TS.
  - Mi recomendación: **Hono + Zod** — más portable, no te ata a TS en el cliente.
- **Validación**: Zod — ya en catalog.
- **Auth**: ver subsección.
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

En todas las tablas Postgres / Turso: `userId TEXT NOT NULL` + index. Filtros en cada query del server. Cliente solo ve lo suyo.

---

## 17. Estrategias de sync (con evaluación de Turso)

Cuatro opciones reales, en orden de complejidad. Picá según el dolor.

### Opción A — Snapshot backup (la más simple, local-first parcial)

Cada N minutos (o al sleep), pushear el blob entero cifrado al backend. Restore = pull blob, descifrar, reemplazar.

**Cuándo**: hasta que aparezca multi-device.
**Ventajas**: trivial. Cero conflictos. Backup gratis.
**Desventajas**: no hay sync real entre devices. El último que pushea pisa al otro.

```
Cliente: cada cambio → marcar dirty. Cada 5min, si dirty → push snapshot.
Server: solo guarda el último snapshot por user.
```

Esto resuelve el caso "perdí el celular" con cero infra de sync. Es lo que recomiendo de **fase 6 del plan de migración** (cloud backup anónimo).

### Opción B — Op-log custom con LWW (sync real, hand-rolled)

Cada mutación local genera una **operación** (`{kind, table, id, payload, lamportClock}`). Las ops se guardan en una tabla `outbox`. Un sync engine las pushea al server, recibe ops remotas, las aplica.

**Conflict resolution**: last-write-wins por timestamp, sobre filas. Para entidades que crecen sin reescribir (como `completed_sets`), no hay conflicto real — solo concatenación.

**Cuándo**: sync entre 2-3 devices del mismo usuario, data simple, sin colaboración multi-user.

**Esfuerzo**: ~3-4 semanas de un dev senior. Las trampas:
- Lamport clocks vs server clocks.
- Idempotencia (no aplicar la misma op dos veces).
- Schema evolution (un cliente vieja que envía una op con un campo nuevo).
- Manejo de conflictos donde LWW no sirve (ej. dos clientes editan el mismo set distinto).

### Opción C — Turso Embedded Replicas (managed sync, mismo schema)

Turso (libSQL — fork de SQLite por la empresa Turso) trae **Embedded Replicas**: una SQLite local en el cliente que se sincroniza automáticamente con la base de datos Turso en el server. **Mismo dialecto SQLite en ambos lados**, sync managed por Turso.

**Cómo funciona**:
- En el cliente, usás `@libsql/client` apuntando a un archivo local + URL del Turso primary.
- Las escrituras locales se guardan en el archivo SQLite + se suben al primary cuando hay red.
- Las lecturas son siempre instantáneas (lee local).
- Sync bidireccional, conflictos resueltos por la replicación de libSQL.

**Drizzle support**: `drizzle-orm/libsql` lo soporta nativo. El schema escrito en `drizzle-orm/sqlite-core` funciona idéntico para SQLite local y Turso server.

**Free tier (a 2026)**:

| Recurso | Free |
|---|---|
| Storage | 9 GB total |
| Row reads | 1 billion / mes |
| Row writes | 25 million / mes |
| Databases | hasta 500 |
| Locations | 3 por DB |
| Inactividad | DB suspende tras 30 días sin uso |

Para una app personal/early-adopter: **abundante**. IronLog con 1000 sesiones × 30 sets × 10 reads diarias por set = ~9M reads/mes — está al 1% del límite.

**Trade-offs**:

| Pro | Con |
|---|---|
| Schema único (SQLite ↔ libSQL) — un solo Drizzle config | Vendor lock-in moderado (migrar de Turso a Postgres requiere data migration) |
| Sync managed — no escribís op-log | Si Turso baja, queda offline (mitigado: la app sigue funcionando local) |
| Edge-friendly, latencia baja | Modelo de pricing por reads/writes — costos pueden subir rápido si la app explota |
| Free tier muy generoso | Open source parcial: cliente sí, server no |
| HTTP-based (no necesita conexión TCP persistente) | Comunidad más chica que Postgres |

**Cuándo elegirla sobre Postgres**:
- Querés sync real sin construir op-log.
- El stack del cliente ya es SQLite local (Drizzle SQLite).
- No tenés requirements complejos de queries (Postgres tiene mejor planner para joins masivos).
- Free tier alcanza en early stages.

**Cuándo NO**:
- Necesitás features Postgres-specific (JSON queries complejas, full-text search robusto, GIS, etc.).
- Querés evitar lock-in.
- Tu app server-heavy con queries analíticas pesadas.

**Mi recomendación para IronLog**: **Turso es buena opción** porque (a) el cliente ya quiere ser SQLite, (b) las queries de fitness son simples (no necesitás Postgres avanzado), (c) el free tier cubre uso personal y crecimiento temprano, (d) Embedded Replicas reemplaza el sync engine custom de Opción B.

### Opción D — PowerSync o ElectricSQL (managed sync, Postgres → SQLite)

Estas plataformas dan sync real Postgres↔SQLite con conflict resolution incluido. Útil si ya tenés Postgres y no querés migrar a libSQL.

| | PowerSync | ElectricSQL | Turso Embedded |
|---|---|---|---|
| Modelo | Streaming Postgres → SQLite | Logical replication Postgres ↔ SQLite | libSQL ↔ libSQL local |
| Hosting | Servicio managed | Self-host o Cloud | Servicio managed |
| Open source | Cliente sí, server no | Sí (Apache 2) | Cliente sí, server no |
| Madurez 2026 | Producción | Producción (1.0+) | Producción |
| Curva | Suave | Media (CRDTs, conceptos nuevos) | Suave |
| Costo | Pago por filas/conexión | Gratis self-hosted; managed pago | Free tier generoso, pago después |
| Soporta Drizzle | Sí | Sí | Sí (nativo) |

### Forma de la tabla `outbox` (para opciones B / C / D)

Usable en cualquier opción que necesite encolar ops:

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

> Nota: con Turso Embedded Replicas, el outbox **no es necesario** — la replicación de libSQL maneja eso. Solo hace falta para B (custom op-log) o si combinás A con sync diferido.

### Camino recomendado

Mi recomendación: empezar en **A** (snapshot) porque resuelve el 80% del valor con 10% del esfuerzo. Cuando aparezca la necesidad real de multi-device, saltar a **C** (Turso Embedded Replicas) por simplicidad. Saltarse B (op-log custom) excepto si te encanta meter mano en sync.

---

## 18. Plan de migración por fases

Cada fase tiene **criterio de salida** y **rollback plan**. No avanzar a la siguiente sin cumplir el criterio.

> Para el state management efímero (Zustand) ver `state_mang_system.md` — ese plan es independiente de éste y se ejecuta después.

### Fase 0 — Preparación (1-2 días)

- [ ] Agregar `expo-sqlite` a deps de `artifacts/ironlog`.
- [ ] Crear `lib/db/src/schema/sqlite/` con tablas vacías que reflejen los tipos actuales.
- [ ] Configurar `drizzle-kit` para SQLite (segundo config junto al actual de Postgres).
- [ ] Generar migration inicial.
- [ ] (Opcional) Decidir Turso vs Vercel Postgres si vas a tener backend pronto. Setear cuenta gratuita.

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

### Fase 4 — Zustand para UI state efímero

Esta fase está cubierta en `state_mang_system.md`. Es independiente de las anteriores y se puede hacer en paralelo a Fase 5 si querés.

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

Idealmente Turso Embedded Replicas (Opción C) o PowerSync (Opción D).

- [ ] Setup hosted o self-host.
- [ ] Migrar tablas `outbox` y configurar replicación.
- [ ] Live testing con 2 devices durante 1 semana antes de release.

**Criterio de salida**: 2 devices del mismo usuario convergen en < 5s tras una mutación.

---

## 19. Testing

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

## 20. Observabilidad

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

## 21. Advertencias y trade-offs

### Cosas que duelen

- **Migrar a SQLite no es free.** Es ~2-4 semanas de un dev senior haciéndolo bien. No empieces un viernes.
- **Drizzle SQLite y Drizzle Postgres tienen quirks distintos.** `boolean` no existe en SQLite (es integer 0/1). Timestamps son números o ISO strings, no `Date`. Lo manejamos con `mode: "timestamp_ms"` y `mode: "boolean"` en Drizzle, pero hay que mantener la atención.
- **`useLiveQuery` re-renderiza por tabla, no por fila.** Si tu home lee `workout_sessions` y mutás cualquier sesión, el home re-renderiza. Para fine-grained subscriptions necesitarías otra librería (legend-state, valtio). En la práctica, no hace falta hasta tener > 1000 sesiones visibles.
- **El sync es genuinamente difícil.** Si hand-rolleas (Opción B), planificá tiempo de calidad para edge cases. Considerá saltar directo a Turso Embedded Replicas (C) o PowerSync (D) si tu caso lo permite.
- **iCloud Sync es notoriamente difícil.** Sí, es tentador no tener server. Pero los conflictos, los entitlements y la falta de visibilidad en producción te van a hacer perder días. Recomiendo backup-en-server > iCloud.
- **AsyncStorage vs SQLite race**: durante Fase 1, puede haber una ventana donde escrites a AsyncStorage *y* a SQLite. Asegurate de que **una** sea la fuente de verdad; la otra es read-only mientras dure la migración.

### Cosas que NO ship-earía sin pensarlo dos veces

- **GraphQL/Apollo**: heavy, no offline-first natural.
- **WatermelonDB**: era el gold standard hace años; sigue siendo bueno pero la integración con server es más oscura que Drizzle. Menos comunidad TS.
- **Realm/MongoDB Atlas Sync**: vendor lock-in, modelo NoSQL no encaja con la naturaleza estructurada de los datos.
- **Firebase**: lock-in fuerte, no SQL, latencia comparada al local-first.
- **MMKV** como reemplazo de AsyncStorage: es solo KV, no resuelve queries — la app eventualmente las necesita.

### Cosas con las que hay que tener cuidado

- **El cliente genera UUIDs** — usar `nanoid` o `uuid v7` (timestamp-prefixed) para IDs ordenables.
- **`updatedAt` y `deletedAt` deben actualizarse SIEMPRE** en cada mutator — no se pueden olvidar. Considerá un trigger SQLite o un wrapper de mutator.
- **Soft delete para sync**: nunca hagas DELETE físico hasta el cleanup-job nocturno. Los devices con sync diferida necesitan ver el "delete" como un cambio.
- **Tamaño del schema**: definir todo arriba (cuánto pesa cada blob, cuántas filas estimás a 1 año) ayuda a no colocar JSONs gigantes en columnas.
- **Si elegís Turso, ojo a la inactividad**: free tier suspende DBs sin uso por 30 días. Si la app no se abre, el primary se duerme y la primera apertura puede tener latencia. Mitigado por Embedded Replicas (lecturas locales).

---

## 22. ADRs

Convención: cada decisión arquitectónica importante guarda un archivo en `docs/adr/NNN-titulo.md`. Formato breve.

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

### ADRs sugeridos para empezar (DB-related)

- **ADR-001**: SQLite + Drizzle como storage local (vs MMKV vs WatermelonDB vs realm).
- **ADR-002**: Op-log con LWW como modelo de sync inicial (vs CRDT) — o saltarse a Turso Embedded Replicas.
- **ADR-003**: UUID v7 generado en cliente como primary key (vs autoincrement server-asignado).
- **ADR-005**: Auth con código de recuperación anónimo en V1 (vs OAuth).
- **ADR-006**: Turso (libSQL) vs Vercel Postgres como DB del backend.

---

## 23. Comandos útiles

```bash
# App mobile (storage local AsyncStorage hoy):
cd artifacts/ironlog
pnpm exec expo start --ios          # arranca Metro + simulador

# API server (sin DB conectada hoy):
PORT=3000 pnpm --filter @workspace/api-server run dev

# DB Postgres (requiere DATABASE_URL en env, schema vacío hoy):
pnpm --filter @workspace/db run push
pnpm --filter @workspace/db run push-force

# Regenerar cliente y schemas zod desde OpenAPI:
pnpm --filter @workspace/api-spec run codegen
```

Cuando esté la migración SQLite:

```bash
# Generar migration nueva tras cambiar el schema:
pnpm --filter @workspace/db run drizzle:generate

# Ver el estado de la DB en simulator (drizzle studio):
pnpm exec drizzle-kit studio
```

Para **borrar el storage local del simulador** (sin reset desde dentro de la app):

```bash
xcrun simctl uninstall booted host.exp.Exponent
# o, dentro de Expo Go: Settings → Clear data
```

Para **inspeccionar el blob en runtime** desde Hermes (mientras siga AsyncStorage):

```js
// en el debugger, scope global de cualquier componente
require("@react-native-async-storage/async-storage").default
  .getItem("ironlog:v1")
  .then((s) => JSON.parse(s));
```

---

## 24. Glosario

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
- **libSQL**: fork de SQLite mantenido por Turso, con extensiones para HTTP API y replicación.
- **Embedded Replicas (Turso)**: SQLite local en el cliente que se replica con un primary Turso server. Sync managed.

---

## Notas de mantenimiento

- Cada decisión arquitectónica que rompa con este doc va con un ADR nuevo.
- Cuando una fase del plan de migración se cierra, marcala con `[x]` y datada.
- Cuando aparezca una librería nueva en consideración, agregala a la sección 21 con el dictamen (recomendada / no recomendada / a evaluar).
- Antes de meter una decisión grande en producción, abrila como issue y pedí review — la arquitectura se cae cuando los criterios no son visibles.
