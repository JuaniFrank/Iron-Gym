# IronLog — Almacenamiento y datos (estado actual)

> Foto del **estado real** de cómo se guardan datos en el monorepo hoy. Para la
> arquitectura futura (local-first, sync, etc.) ver [`backend.md`](./backend.md).

---

## TL;DR

- La app mobile (`artifacts/ironlog`) **no tiene base de datos**. Todo el estado vive en memoria (`useState` en un solo Context) y se persiste serializado a JSON en **AsyncStorage** bajo una única clave: `ironlog:v1`.
- **No hay backend en uso**. El `api-server` existe en el monorepo pero solo expone `GET /api/healthz`. El cliente Expo nunca lo llama.
- El monorepo trae **scaffolding de Postgres + Drizzle** (`lib/db`) y un **pipeline OpenAPI → cliente React Query** (`lib/api-spec` → `lib/api-client-react`), pero ambos están vacíos / no integrados a la app.
- La única "base de datos" funcional hoy es **el JSON local del dispositivo**.

---

## 1. Mapa del repo desde el ángulo de datos

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

---

## 2. Persistencia en la app mobile (lo que realmente corre)

### 2.1 Mecanismo

Archivo: `artifacts/ironlog/contexts/IronLogContext.tsx`.

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "ironlog:v1";
```

- **Un único `useState<PersistedState>`** con todo el dominio (sesiones, rutinas, comidas, fotos, perfil, etc.) — ver §3.
- **Hidratación al boot**: en un `useEffect`, se hace `AsyncStorage.getItem("ironlog:v1")`, se parsea con `JSON.parse`, y se mergea contra los defaults: `{ ...DEFAULT_STATE, ...parsed, profile: { ...DEFAULT_PROFILE, ...parsed.profile } }`. El flag `isLoaded` evita renderizar consumidores hasta que termine.
- **Escritura**: otro `useEffect` dispara cada vez que `state` cambia y hace `AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))`. No hay debounce — escribe el blob entero en cada mutación.
- **Reset**: `resetAll()` hace `AsyncStorage.removeItem(STORAGE_KEY)` + `setState(DEFAULT_STATE)`.

### 2.2 Qué es AsyncStorage

`@react-native-async-storage/async-storage` v2.2.0. Es un key-value store asíncrono provisto por React Native.

- **iOS**: respaldado por un archivo en `Documents/RCTAsyncLocalStorage_V1/` (manifest en JSON + chunks). Sobrevive a relaunches y a updates de la app, pero **se pierde si el usuario desinstala**.
- **Android**: SQLite interno gestionado por la lib.
- **No está cifrado**. Cualquiera con acceso al sandbox de la app puede leerlo (relevante para jailbreak / backups sin cifrar).

Implicancias:
- Sin migraciones: si renombrás un campo de un tipo, los blobs viejos del usuario quedan inconsistentes y el `{ ...defaults, ...parsed }` los "tapa" silenciosamente.
- Sin queries: cada filtrado/agregación se hace en JS sobre arrays completos.
- Boot lag escalable: cuanto más grande el blob, más tarda el `getItem` + `JSON.parse`.

### 2.3 No hay otros mecanismos de storage

Búsqueda exhaustiva — no se usan:
- `expo-sqlite`
- `expo-secure-store`
- `react-native-mmkv`
- IndexedDB / `localStorage` (la app no se ejecuta en web hoy)
- File system (excepto fotos — ver §2.5)

### 2.4 El "Context = store"

El `IronLogContext` **es** la fuente de verdad. Cualquier componente que llame `useIronLog()` recibe **todo** el estado y se re-renderiza ante **cualquier** cambio. ~30 mutadores expuestos (`createRoutine`, `logSet`, `finishWorkout`, `addProgressPhoto`, etc.) — todos hacen `setState(prev => ({ ...prev, X: nuevoX }))`.

Esto significa que **el "store" y la "persistencia" están acoplados**: cambiar memoria implica reescribir disco.

### 2.5 Fotos de progreso (caso especial)

`ProgressPhoto.uri: string` se guarda en el JSON, pero **no son los bytes de la imagen** — es la URI que devuelve `expo-image-picker` (típicamente `file:///.../Library/Caches/ExponentExperienceData/...`). Los bytes viven en el cache de Expo / asset library del SO.

Riesgo: si iOS limpia el cache o el usuario revoca permisos, la URI puede romperse. El JSON queda con strings que apuntan a nada. Hoy no hay copia/move-to-stable-dir.

---

## 3. Modelo de datos persistido

Definido en `artifacts/ironlog/types/index.ts`. La forma del blob serializado:

```ts
interface PersistedState {
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

### 3.1 Datos seed (no persistidos — bundled en JS)

Estáticos, viven en `constants/`. Se concatenan con los custom del usuario al exponerlos:

| Archivo | Qué trae | Cómo se expone |
|---|---|---|
| `exercises.ts` | 165 ejercicios | `allExercises = [...EXERCISES, ...state.customExercises]` |
| `foods.ts` | 47 alimentos | `allFoods = [...FOOD_DATABASE, ...state.customFoods]` |
| `presetRoutines.ts` | 3-4 rutinas predefinidas | `allRoutines = [...PRESET_ROUTINES, ...state.routines]` |
| `achievements.ts` | 13 achievements (definición + check fn) | `ACHIEVEMENTS` importado donde se evalúa |
| `volumeTargets.ts` | MEV/MAV/MRV por músculo | importado en pantallas de progress |
| `colors.ts` | paleta light/dark | leído por `ThemeContext` |

Los ejercicios y alimentos predefinidos **no se duplican** en el storage — solo viven los `customExercises` / `customFoods` creados por el usuario.

---

## 4. Backend que existe pero no se usa

### 4.1 `artifacts/api-server` — Express 5

Ruta: `artifacts/api-server/src/`.

- `index.ts`: bootstrap, lee `PORT` del env, escucha.
- `app.ts`: configura `cors`, `express.json`, `pino-http` para logging, monta `/api`.
- `routes/health.ts`: único endpoint hoy → `GET /api/healthz` devuelve `{ status: "ok" }` validado con `HealthCheckResponse` (zod).
- **No importa `@workspace/db`**. No hay handlers que toquen Postgres todavía.

Dependencias relevantes: `express@^5`, `cors`, `pino` + `pino-http`, `cookie-parser`, `drizzle-orm` (declarado pero no importado), `@workspace/db` (declarado, no importado), `@workspace/api-zod`.

### 4.2 `lib/db` — Drizzle + Postgres

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

### 4.3 Pipeline de codegen API (`lib/api-spec` → `api-zod` + `api-client-react`)

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

### 4.4 React Query en la app

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

## 5. Inventario de librerías relacionadas a datos

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

`expo-sqlite`, `react-native-mmkv`, `expo-secure-store`, `realm`, `watermelondb`, `op-sqlite`, `tinybase`, `dexie`, `pouchdb`, `electric-sql`, `replicache`, `instantdb`, `firebase`, `supabase-js`, `aws-amplify`, `convex`, etc.

---

## 6. Flujo de datos típico (ejemplo: "loguear un set")

1. Usuario completa un set en `app/workout/active.tsx` y dispara `logSet(sessionId, setData)`.
2. `IronLogContext.logSet` ejecuta `setState(prev => ({ ...prev, sessions: prev.sessions.map(...) }))`.
3. React re-renderiza **todos** los consumers de `useIronLog` (home, progress, planning, etc.) porque el `value` del Context cambia de identidad.
4. El `useEffect` de persistencia detecta el cambio en `state` y hace `AsyncStorage.setItem("ironlog:v1", JSON.stringify(state))` — escribe el blob entero, sincrónicamente con el render del JS thread (la API es async pero la serialización es bloqueante).
5. No hay round-trip a red. No hay validación con Zod. No hay batching.

Para una mutación más cara (ej. `finishWorkout` que computa PRs y achievements), pasa lo mismo: cómputo en JS sobre arrays, escritura del blob completo.

---

## 7. Limitaciones explícitas del enfoque actual

Documentadas también en `backend.md` §1, las repito acá para que este doc se sostenga solo:

1. **Re-render global**: cualquier mutación re-renderiza todo lo que toque el Context.
2. **Escritura O(N) por mutación**: el blob se serializa entero. A escala se vuelve boot-lag y jank al guardar.
3. **Sin queries / índices**: cada filtrado es scan en JS.
4. **Sin migraciones**: cambios de schema rompen blobs viejos en silencio.
5. **Sin separación de capas**: persistencia ↔ UI state ↔ remote cache mezclados.
6. **Sin backup ni sync**: desinstalar la app = perder todo. Cambio de teléfono = perder todo.
7. **No testeable sin React**: `finishWorkout` solo puede probarse montando el Provider.
8. **Sin cifrado en disco**.

---

## 8. Lo que sí está bien posicionado para crecer

- **Tipos centralizados** en `types/index.ts` — listos para mapearse a tablas Drizzle.
- **`dateKey` strings** ya en formato SQL-friendly para ser PK de tablas como `schedule_overrides` o `session_plans` (los comentarios JSDoc en los tipos ya proponen el shape de la tabla destino).
- **IDs string** universales (UUID-like) — compatibles con Postgres `text PRIMARY KEY` o `uuid`.
- **Monorepo con `lib/db` y pipeline de codegen funcionando** — la rampa para introducir backend está armada.
- **React Query montado** — agregar el primer hook generado es un import.

---

## 9. Cómo evolucionarlo

Ver [`backend.md`](./backend.md) — propone un camino local-first:

1. SQLite local (drizzle + `expo-sqlite`/`op-sqlite`) reemplaza el blob, mismo schema que Postgres.
2. `useLiveQuery` para reactividad granular (solo re-renderiza lo que cambió).
3. Mutators como funciones puras testeables.
4. Zustand para estado UI efímero.
5. Backend opcional + sync (push/pull diferencial).

Mientras tanto, **cualquier feature nuevo sigue agregando campos al `PersistedState`** y al merge en hidratación. Documentar cada cambio de shape (aunque sea en el commit message) ayuda a no olvidarse de un futuro `migrate(parsed)` cuando se mueva a SQLite.

---

## 10. Comandos útiles

```bash
# App mobile (storage local AsyncStorage):
cd artifacts/ironlog
pnpm exec expo start --ios          # arranca Metro + simulador

# API server (sin DB conectada hoy):
PORT=3000 pnpm --filter @workspace/api-server run dev

# DB (requiere DATABASE_URL en env, schema vacío hoy):
pnpm --filter @workspace/db run push
pnpm --filter @workspace/db run push-force

# Regenerar cliente y schemas zod desde OpenAPI:
pnpm --filter @workspace/api-spec run codegen
```

Para **borrar el storage local del simulador** (sin reset desde dentro de la app):

```bash
xcrun simctl uninstall booted host.exp.Exponent
# o, dentro de Expo Go: Settings → Clear data
```

Para **inspeccionar el blob en runtime** desde Hermes:

```js
// en el debugger, scope global de cualquier componente
require("@react-native-async-storage/async-storage").default
  .getItem("ironlog:v1")
  .then((s) => JSON.parse(s));
```
