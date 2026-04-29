# IronLog — Módulo de Running

> Plan completo del feature de running para IronLog. Cubre tracking GPS, mapa,
> métricas en vivo, planificación, integraciones y plan de entrega por fases.
>
> Doc vivo. Mismo estilo que `ROADMAP.md` y `backend.md`. Hereda las
> convenciones de la app (español, AsyncStorage hoy, futuro local-first).

---

## Índice

1. [Visión y alcance](#1-visión-y-alcance)
2. [Cómo encaja con la app actual](#2-cómo-encaja-con-la-app-actual)
3. [Modos de running (taxonomía)](#3-modos-de-running-taxonomía)
4. [User stories](#4-user-stories)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Pantallas](#6-pantallas)
7. [Tracking en vivo (arquitectura)](#7-tracking-en-vivo-arquitectura)
8. [Cálculos y métricas](#8-cálculos-y-métricas)
9. [Audio coaching y alertas](#9-audio-coaching-y-alertas)
10. [Integraciones](#10-integraciones)
11. [Achievements y goals running-specific](#11-achievements-y-goals-running-specific)
12. [Permisos y privacidad](#12-permisos-y-privacidad)
13. [Stack técnico](#13-stack-técnico)
14. [Plan de entrega por fases](#14-plan-de-entrega-por-fases)
15. [Edge cases y advertencias](#15-edge-cases-y-advertencias)
16. [Fuera de scope v1](#16-fuera-de-scope-v1)

---

## 1. Visión y alcance

Que un usuario de IronLog pueda **planear, ejecutar y revisar carreras** con la misma calidad de UX que su entreno de gimnasio. El objetivo es paridad funcional con apps standalone tipo Strava/Nike Run Club en lo esencial — tracking GPS preciso, mapa, splits, audio coaching, history, plans — sin perder la coherencia visual de IronLog (paleta lime + cream/charcoal, calma, números grandes, mínimo ruido).

**No-goals v1**: red social, segmentos competitivos, descubrimiento de rutas de terceros, ciclismo / natación / otros deportes, indoor cycling.

---

## 2. Cómo encaja con la app actual

### 2.1 Concepto: "training day" se vuelve polimórfico

Hoy un día puede ser **gym** (rutina) o **descanso**. El módulo de running agrega un tercer tipo: **run**. La home, el calendar y el planning tienen que aceptar los tres y mostrar el bloque correcto.

El tipo `ResolvedPlan` actual:

```ts
type ResolvedPlan =
  | { kind: "training"; routineId; routineDayId; isOverride }
  | { kind: "rest"; isOverride };
```

se extiende:

```ts
type ResolvedPlan =
  | { kind: "training"; routineId; routineDayId; isOverride }
  | { kind: "run"; runPlanId: string; isOverride }
  | { kind: "rest"; isOverride };
```

`ScheduledRoutine` (plan semanal) y `ScheduleOverride` (override por fecha) ganan slots análogos para running. Detalle en §5.

### 2.2 Navegación

Sin tab nuevo (ya hay 5 — `index/workout/progress/nutrition/more`). En cambio:

- **Home** muestra "lo de hoy" — incluye runs planeados con su CTA propio ("Empezar carrera").
- **Workout tab** se renombra **Entrenar** y arriba tiene un toggle `Pesas | Running` que filtra rutinas vs runs.
- **Progress tab** gana una sub-vista `Running` con sus métricas propias (totales, PRs, gráficos).
- **Planning** acepta arrastrar runs al calendario igual que rutinas.
- **More** lista rutas guardadas y plans de entrenamiento (5K, 10K, etc.).

Pantallas específicas viven bajo `app/run/...` (paralelo a `app/workout/...`):

```
app/run/
├── plan.tsx          ← Setup pre-carrera (modo, target, audio, etc.)
├── live.tsx          ← Pantalla principal durante la carrera
├── summary.tsx       ← Resumen post-carrera con mapa y stats
├── history.tsx       ← Lista de carreras pasadas
├── [id].tsx          ← Detalle de una carrera específica
├── routes.tsx        ← Rutas guardadas
├── route/[id].tsx    ← Detalle / preview de una ruta
└── plans.tsx         ← Training plans (5K, 10K, etc.)
```

### 2.3 Calorías y nutrición

`nutrition.tsx` ya tiene tracking de macros con goals. Las kcal quemadas en una carrera se suman al "gasto del día" — útil para ajustar el balance calórico. Hoy no existe el concepto de "gasto"; al introducir running aparece y aplica también a workouts de gym (estimado por volumen × peso, peor estimación que running pero útil).

---

## 3. Modos de running (taxonomía)

Cada modo cambia la pantalla `live` y los cues de audio:

| Modo | Descripción | Targets | Audio cues |
|---|---|---|---|
| **Free run** | Solo trackear, sin objetivo. | — | Splits cada km. |
| **Distance** | Correr X km. | distancia objetivo | Progreso (25/50/75/100%), splits. |
| **Time** | Correr X minutos. | duración objetivo | Tiempo restante en hitos, splits. |
| **Pace target** | Mantener ritmo X min/km. | pace objetivo + tolerancia | Alertas "muy rápido / muy lento". |
| **Intervals** | Repeticiones de work/rest configurables. | series, work, rest | Beep al cambio, "corré 3 minutos", "caminá 1 minuto". |
| **Tempo** | Calentamiento + bloque a ritmo + cooldown. | 3 segmentos con duración o distancia | Cambio de fase narrado. |
| **Long run** | Correr largo y a ritmo cómodo. | distancia objetivo (suave) | Splits + mensaje motivacional cada 5 km. |
| **Treadmill / indoor** | Sin GPS — distancia/pace ingresados o estimados por pasos. | distancia o tiempo | Splits por tiempo. |
| **Race** | Modo evento — cero pausas autopáusas, cero notificaciones. | distancia oficial | Solo splits oficiales. |

Cada `RunSession` graba el modo elegido y los targets para poder comparar sesiones equivalentes en `history`.

---

## 4. User stories

> Formato: **como [rol] quiero [acción] para [beneficio]**.

1. Como atleta híbrido **quiero planear running en mi calendario semanal junto a mis rutinas de gym** para ver toda la semana en un solo lugar.
2. Como corredor casual **quiero salir a correr sin configurar nada** y tener stats decentes (distancia, pace, ruta).
3. Como corredor con objetivo **quiero fijar una meta de distancia o tiempo** y que la app me avise cuando me acerco / supero.
4. Como corredor estructurado **quiero hacer intervalos** con cues de audio para no mirar el teléfono.
5. Como usuario en formación para 5K **quiero un plan progresivo** de varias semanas que la app me programe automáticamente.
6. Como persona con rutas favoritas **quiero guardar una ruta** y poder repetirla / ver el GPX.
7. Como obsesivo de stats **quiero ver mi progreso de pace, distancia semanal, elevación y PRs** (1k más rápido, 5k más rápido, etc.).
8. Como dueño de Apple Watch **quiero que la sesión sume a HealthKit** y que las pulsaciones aparezcan en el resumen.
9. Como ahorrador de batería **quiero modo low-power** que reduzca la frecuencia de GPS sin perder calidad esencial.
10. Como persona consciente de privacidad **quiero "privacy zone"** que oculte los primeros y últimos N metros de cada ruta cerca de mi casa.
11. Como caminante (no runner) **quiero registrar caminatas** con la misma UX, distinguibles del running por etiqueta.
12. Como el que quiere ver lo de hoy a las 6am **quiero el live screen sin distracciones** — números enormes, fondo simple, lock-screen-friendly.

---

## 5. Modelo de datos

Tipos nuevos en `types/index.ts`. Se persisten dentro del mismo `PersistedState` (mientras siga siendo AsyncStorage; cuando migre a SQLite, se vuelven tablas — ver `backend.md`).

### 5.1 Sesiones de running

```ts
export type RunMode =
  | "free"
  | "distance"
  | "time"
  | "pace"
  | "intervals"
  | "tempo"
  | "long"
  | "treadmill"
  | "race";

export type RunActivity = "run" | "walk" | "hike";

/** Un punto del trazado GPS. Compacto a propósito (bytes importan a escala). */
export interface RunPoint {
  /** Unix ms desde el inicio de la sesión. Resta para timestamp absoluto si querés. */
  t: number;
  lat: number;
  lon: number;
  /** Metros sobre el nivel del mar. Opcional si el device no reporta. */
  alt?: number;
  /** Velocidad instantánea en m/s (del SO si está disponible, si no derivada). */
  v?: number;
  /** Accuracy del fix en metros. */
  acc?: number;
  /** Heart rate bpm si vino de HealthKit / wearable. */
  hr?: number;
}

/** Cada km/milla que el usuario completa. Ojo con units (ver §8). */
export interface RunSplit {
  index: number;          // 1, 2, 3, ...
  distanceM: number;      // metros recorridos en este split (típico 1000)
  durationMs: number;
  avgPaceSecPerKm: number;
  elevGainM: number;
  elevLossM: number;
}

/** Un par work/rest dentro de un run de intervals. */
export interface RunInterval {
  index: number;
  kind: "work" | "rest";
  targetDurationMs?: number;
  targetDistanceM?: number;
  actualDurationMs: number;
  actualDistanceM: number;
  avgPaceSecPerKm?: number;
  avgHr?: number;
}

export interface RunTargets {
  distanceM?: number;
  durationMs?: number;
  paceSecPerKm?: number;
  /** Tolerancia de pace en segundos (para alertas). */
  paceToleranceSec?: number;
  intervals?: {
    sets: number;
    workSec: number;
    restSec: number;
  };
  tempo?: {
    warmupSec: number;
    blockSec: number;
    blockPaceSecPerKm: number;
    cooldownSec: number;
  };
}

export interface RunSession {
  id: string;
  activity: RunActivity;          // run / walk / hike
  mode: RunMode;
  startedAt: number;              // unix ms
  endedAt?: number;               // undefined => sesión activa
  /** Timestamps absolutos de cada pausa/resume para reconstruir tiempo en movimiento. */
  pauses: { pausedAt: number; resumedAt?: number }[];

  targets?: RunTargets;
  routeId?: string;               // si corrió sobre una ruta guardada

  // Stats agregadas (recalculadas al finalizar).
  totalDistanceM: number;
  totalDurationMs: number;        // tiempo cronómetro (sin pausas)
  movingTimeMs: number;           // tiempo "corriendo" (con auto-pause aplicada)
  avgPaceSecPerKm: number;
  bestPaceSecPerKm: number;       // mejor split
  elevGainM: number;
  elevLossM: number;
  caloriesKcal: number;
  steps?: number;
  avgCadenceSpm?: number;         // pasos por minuto
  avgHr?: number;
  maxHr?: number;
  hrZones?: number[];             // segundos en zonas 1..5

  splits: RunSplit[];
  intervals?: RunInterval[];
  points: RunPoint[];             // path completo
  notes?: string;
  weather?: RunWeather;
  /** Apariencia/tags libres del usuario ("matutina", "lluvia", "post-pesas"). */
  tags?: string[];
  /** PRs detectados al cerrar la sesión. */
  prs: RunPR[];
}

export interface RunWeather {
  temperatureC: number;
  conditions: string;        // ej. "soleado", "lluvia ligera"
  windKmh?: number;
  humidity?: number;
}

export type RunPRType =
  | "longest_distance"
  | "longest_duration"
  | "fastest_1k"
  | "fastest_5k"
  | "fastest_10k"
  | "fastest_half"
  | "fastest_full"
  | "highest_elev_gain";

export interface RunPR {
  type: RunPRType;
  value: number;             // metros / ms / s/km según tipo
  previousValue?: number;
  achievedAt: number;
}
```

### 5.2 Plans, schedule y rutas

```ts
/** Plan reutilizable — el usuario lo arrastra a una fecha o lo agenda semanalmente. */
export interface RunPlan {
  id: string;
  name: string;             // ej. "Tempo 8K", "Intervalos 6×400"
  mode: RunMode;
  activity: RunActivity;
  targets?: RunTargets;
  notes?: string;
  isPreset?: boolean;       // true para los plans built-in (couch-to-5K, etc.)
  createdAt: number;
}

/** Programación recurrente por día de semana — análogo a `ScheduledRoutine`. */
export interface ScheduledRun {
  dayOfWeek: number;        // 1..7 (lunes=1)
  runPlanId: string;
}

/** Ruta guardada — coordenadas + metadata. Se puede crear desde una sesión hecha
 *  ("guardar como ruta") o dibujada en el route planner. */
export interface SavedRoute {
  id: string;
  name: string;
  distanceM: number;
  elevGainM?: number;
  /** Sample del trazado: puntos compactados (downsampled) para preview. */
  preview: { lat: number; lon: number }[];
  /** Trazado completo (alta resolución) — opcional, puede ser pesado. */
  full?: { lat: number; lon: number }[];
  createdAt: number;
  /** Origen: si vino de una sesión, referencia al `RunSession.id`. */
  fromSessionId?: string;
}

/** Plan de entrenamiento estructurado (multi-semana). Cada item se materializa
 *  como `ScheduledRun`/`SessionPlan` cuando el usuario lo activa. */
export interface TrainingPlan {
  id: string;
  name: string;             // "Couch to 5K", "10K en 8 semanas"
  description?: string;
  weeks: TrainingPlanWeek[];
  isPreset?: boolean;
  createdAt: number;
}

export interface TrainingPlanWeek {
  weekNumber: number;
  days: { dayOfWeek: number; runPlanId: string | null }[]; // null = descanso
}
```

### 5.3 Extensiones a tipos existentes

```ts
// types/index.ts — actualizaciones

export interface ScheduledRoutine {
  dayOfWeek: number;
  routineId?: string;           // pasa a opcional
  routineDayId?: string;        // pasa a opcional
  runPlanId?: string;           // alternativa: ese día se corre
}

export interface ScheduleOverride {
  dateKey: string;
  routineId: string | null;
  routineDayId: string | null;
  runPlanId?: string | null;    // override "ese día corro X"
  createdAt: number;
}

export type ResolvedPlan =
  | { kind: "training"; routineId: string; routineDayId: string; isOverride: boolean }
  | { kind: "run"; runPlanId: string; isOverride: boolean }
  | { kind: "rest"; isOverride: boolean };
```

### 5.4 PersistedState

Suma cuatro arrays + (cuando arranque la sesión) un `activeRunId`:

```ts
interface PersistedState {
  // ... existentes
  runs: RunSession[];
  runPlans: RunPlan[];
  savedRoutes: SavedRoute[];
  trainingPlans: TrainingPlan[];
  scheduledRuns: ScheduledRun[];
  activeRunId: string | null;   // mutuamente exclusivo con activeWorkoutId
}
```

**Decisión de diseño**: una sesión activa única en toda la app. No se pueden tener un `activeWorkout` y un `activeRun` simultáneos — el iniciar uno avisa que cierre el otro.

---

## 6. Pantallas

Para cada pantalla: propósito, partes, datos que consume, acciones, navegación.

### 6.1 Home — tarjeta "lo de hoy"

**Propósito**: que la primera mirada del día muestre el run planeado con CTA para arrancar.

**Cuando hay run planeado para hoy**:

```
┌──────────────────────────────────────┐
│  HOY · LUN 28 ABR                    │
│                                       │
│  Tempo 8K                             │
│  ⏱ 45 min · 🏃 8 km · pace 5:30      │
│                                       │
│  [ Empezar carrera   →]               │
│                                       │
│  Última carrera: hace 2 días          │
│  6,2 km · 32:15 · 5:12/km             │
└──────────────────────────────────────┘
```

**Cuando hay gym + run el mismo día**: dos tarjetas apiladas con orden sugerido (ej. pesas primero, run cooldown después).

**Cuando es rest**: card neutra con sugerencia "¿caminar 20 min?" con CTA "Empezar caminata".

### 6.2 Plan semanal — `Workout tab` con toggle

Sobre el contenido actual del tab, una segmented control arriba:

```
┌──────────────────────────────────────┐
│      [ Pesas ]   [ Running ]         │
└──────────────────────────────────────┘
```

`Running` muestra el calendario semanal con runs agendados, plans disponibles y un botón "Ver training plans" que lleva a §6.10.

### 6.3 Run setup — `app/run/plan.tsx`

**Propósito**: configurar la carrera antes de empezar.

Componentes (de arriba abajo):

1. **Header** — modo seleccionable como segmented (Free / Dist / Tiempo / Pace / Intervals / Tempo / Indoor / Race).
2. **Targets** — inputs según modo:
   - `distance`: slider o input "8.0 km" + chips de presets (3, 5, 10, 21, 42).
   - `time`: time picker.
   - `pace`: pace picker `min:seg /km` + tolerancia.
   - `intervals`: sets × work × rest con preview (`6 × 400m / 1:30 rest`).
   - `tempo`: warmup, block, cooldown.
3. **Ruta** — opcional: "Sin ruta · Ruta guardada · Crear ruta".
4. **Audio** — toggle global + selector de cues:
   - Splits cada [1km / 0.5km / 1mi / off]
   - Pace alerts (solo en pace/tempo)
   - Voz [feminina / masculina / off — usa `expo-speech` con voces del SO]
5. **Activity** — Run / Walk / Hike (afecta cálculo de calorías).
6. **Pre-run checklist** (collapsable):
   - Permisos GPS (warning si solo "while in use" — recomendar "always").
   - Battery saver desactivado.
   - HealthKit conectado (iOS).
7. **CTA grande**: `Comenzar` → navega a `app/run/live.tsx`.

### 6.4 Run live — `app/run/live.tsx`

**Propósito**: única pantalla durante la carrera. **Glanceable, mínimas interacciones, evitar lock**.

Navegación interna: **swipe horizontal entre 3 vistas**.

#### View 1 · Métricas grandes (default)

```
┌───────────────────────────┐
│  HORA  ⏵                  │  ← status bar
│                           │
│        00:12:45           │  ← tiempo en movimiento (GIGANTE)
│         tiempo            │
│                           │
│   2,34         5:24       │
│    km          /km        │
│                           │
│   178         312          │
│   bpm        kcal          │
│                           │
│  ━━━━━━━━━━░░░░░░░░  62%  │  ← progreso a target (si hay)
│                           │
│  ╭─────╮ ╭─────╮ ╭─────╮ │
│  │  ⏸  │ │  ➤  │ │  □  │ │  ← pause / lap / stop
│  ╰─────╯ ╰─────╯ ╰─────╯ │
└───────────────────────────┘
```

- **Tiempo grande arriba** — siempre el "moving time".
- **2 columnas × 2 filas** de métricas secundarias (configurable: distancia, pace actual, pace promedio, hr, kcal, cadence, elev gain). Default según modo.
- **Barra de progreso** — solo si hay target (`distance`/`time`/`intervals`).
- **Controles** — Pausa (toggle), Lap manual, Stop (mantener apretado 1s para evitar accidental).

#### View 2 · Mapa

Mapa fullscreen con:
- Polyline del path recorrido (stroke = `accent`, ancho 4).
- Marcador de posición actual + heading.
- Pin de start.
- Cada split marcado como punto pequeño con número.
- Botón overlay para centrar / cambiar a north-up vs heading-up.
- Mini-card abajo con distance + pace.

#### View 3 · Splits

Lista de cada km con su pace, ascendente. El último (en curso) se muestra en color accent.

```
┌───────────────────────────┐
│  KM    PACE      ELEV    │
│  1     5:18      +12 m   │
│  2     5:24      +8 m    │
│  3     5:21      −3 m    │
│  4 …   3:45/km           │  ← parcial actual
└───────────────────────────┘
```

#### Lock screen / always-on

- En modo "race" o long-run, opción "always-on display dim" — pantalla con brillo bajo, sin auto-lock (`expo-keep-awake`).
- Live Activities (iOS 16.1+): tiempo + distancia + pace en la pantalla bloqueada y en Dynamic Island. **v2** — ver §16.

#### Audio cues

Disparados por reglas en §9. Se ducken la música del usuario (si hay) automáticamente.

### 6.5 Run summary — `app/run/summary.tsx`

**Propósito**: cerrar la carrera con dignidad. Mostrar todo. Dejar acción de guardar/borrar/notas.

Bloques (scroll vertical):

1. **Hero**: nombre del modo + "¡Carrera completada!" + duración + distancia grandes. Si hubo PRs, banner accent con ícono trofeo.
2. **Mapa con la ruta** — full width, altura 240, polyline coloreada por pace (gradiente verde→rojo según velocidad relativa).
3. **Stats grid** (2-3 columnas):
   - Distancia / Tiempo / Pace promedio / Pace mejor
   - Elev gain / loss / Calorías / Pasos / Cadence
   - HR avg / max / Tiempo en zonas (donut o bar)
4. **Splits** (lista con barras horizontales por pace).
5. **Pace chart** — line chart pace vs km.
6. **Elevation chart** — area chart altitud vs km.
7. **Heart rate chart** (si hubo) — line chart bpm vs tiempo + zonas como bandas.
8. **Intervals**: tabla con work/rest si aplica.
9. **Tags** — chips multi-select (matutina, lluvia, gym-day, etc.).
10. **Notas** — text area.
11. **Foto** — opcional (1 foto adjuntable usando `expo-image-picker`).
12. **Acciones** — `Guardar`, `Guardar como ruta`, `Compartir` (genera imagen con stats), `Descartar`.

### 6.6 Run history — `app/run/history.tsx`

Lista de runs pasadas con filtros:

- Filtro por activity (run / walk / hike / todos).
- Filtro por modo.
- Filtro por mes (chips de meses recientes).

Cada item:

```
┌─────────────────────────────────────────┐
│ [mini map 60×60]  Tempo 8K              │
│                   8,12 km · 42:15 · 5:12│
│                   Lun 28 abr · soleado  │
│                                          PR │
└─────────────────────────────────────────┘
```

Tap → §6.7. Long-press → menú (eliminar, duplicar, guardar como ruta, compartir).

### 6.7 Run detail — `app/run/[id].tsx`

Igual que summary (§6.5) pero read-only y con botones extra: `Repetir esta carrera` (clona targets + ruta), `Comparar con...` (selecciona otra carrera del mismo modo y diffea métricas).

### 6.8 Routes — `app/run/routes.tsx`

Grilla de rutas guardadas. Cada card con preview map (polyline simple), nombre, distancia, elev gain. Tap → §6.9.

CTA arriba: `Crear ruta` → route planner (§16, **v2**).

### 6.9 Route detail — `app/run/route/[id].tsx`

- Mapa full-bleed con la ruta.
- Stats (distancia, elev, número de veces corrida).
- Lista "veces corridas": las sesiones donde se usó esta ruta.
- CTA: `Empezar carrera con esta ruta` → setup pre-cargado.

### 6.10 Training plans — `app/run/plans.tsx`

Lista de plans:

- **Built-in**: Couch-to-5K (8 semanas), 10K en 8 semanas, Half marathon en 12 semanas, Easy maintenance.
- **Customizados**: los que el usuario haya armado.

Tap → detalle del plan con calendar de las N semanas. Botón `Activar plan` agenda los `ScheduledRun`s de la semana 1 y avanza automáticamente cada lunes.

### 6.11 Stats / Progress (running) — `progress.tsx` extendido

Sub-vista "Running" con:

- Totales (este mes / últimos 12 meses / all-time): distancia, tiempo, runs, kcal, elev.
- Heatmap (`Heatmap` ya existe en componentes) días con run.
- **Pace progression**: line chart "pace promedio últimos 30 runs".
- **Distancia por semana**: bar chart 12 semanas.
- **Records**: lista de PRs con fecha y link al run.
- **Mapa de actividad**: heatmap geográfico de las rutas (overlay sobre tile map). v2.

---

## 7. Tracking en vivo (arquitectura)

### 7.1 Servicio singleton

`contexts/RunTrackerContext.tsx` (o un `services/runTracker.ts` si preferimos sacarlo del Context API).

Responsabilidades:

- Suscribirse a `expo-location` con `accuracy: BestForNavigation`, `timeInterval: 1000`, `distanceInterval: 5`.
- Mantener un buffer de `RunPoint[]` en memoria.
- Calcular en vivo: distancia acumulada (haversine entre puntos contiguos, descartando outliers), velocidad, pace, elev gain.
- Detectar splits (cada vez que `distanceM` cruza un múltiplo de 1000m emite un `RunSplit`).
- Manejar pause/resume (no acumula puntos durante pausa, registra timestamps).
- Manejar **auto-pause** (configurable): si `velocityMs < 0.6` por > 10s, pausar. Reanudar al detectar movimiento.
- Persistir cada N segundos (cada 30s) un snapshot del run en AsyncStorage para sobrevivir crashes.

### 7.2 Background tracking

Cuando el usuario bloquea la pantalla:

- iOS: requiere `UIBackgroundModes: location` en `app.json` y permiso "Always Allow". Usamos `Location.startLocationUpdatesAsync` con `expo-task-manager`.
- Android: foreground service. La librería `expo-location` lo maneja con `foregroundService: { notificationTitle, ... }`.
- Hay que **mostrar una notificación persistente** mientras se trackea ("Iron Gym está rastreando tu carrera — toca para volver").

### 7.3 Filtrado de ruido

- Descartar puntos con `accuracy > 30m`.
- Si dos puntos consecutivos están a > 50m con dt < 2s → outlier, descartar.
- Promedio móvil de pace sobre últimos 30s para evitar volatilidad en la métrica visible.

### 7.4 Battery savings

Modo "low power":
- `accuracy: Balanced` en lugar de `BestForNavigation`.
- `timeInterval: 3000`, `distanceInterval: 10`.
- Sin pulsado constante de altímetro; se infiere elev del SO (menos preciso).

Activable desde setup pre-run y desde un menú en live screen.

### 7.5 Crash recovery

Al abrir la app, si `activeRunId != null` y la sesión tiene `endedAt == undefined`, mostrar diálogo: "Tenías una carrera en curso. ¿Continuar / Finalizar / Descartar?" Reconstruir desde el snapshot persistido.

---

## 8. Cálculos y métricas

### 8.1 Distancia

Suma de haversine entre puntos consecutivos (filtrados):

```
d(p1, p2) = 2R · asin(√(sin²(Δφ/2) + cosφ1·cosφ2·sin²(Δλ/2)))
con R = 6_371_000 m
```

### 8.2 Pace (min/km)

`pace = (movingTimeSec / distanceKm)`. En vivo, se calcula sobre ventana de 30s para suavizar. Visualizado como `mm:ss` por km (o por mi si units = imperial).

### 8.3 Elevation

- Gain: suma de incrementos en `alt` con un threshold de 1m (filtrar ruido de altímetro).
- Loss: análogo con decrementos.
- Si el device no provee `alt`, intentar con elevación del primer punto desde un servicio (out-of-scope v1) o mostrar `—`.

### 8.4 Calorías

MET-based:

```
kcal = MET · pesoKg · horas
```

con MET dependiente de pace (running) o de velocidad media (walking/hiking). Tabla aproximada:

| Pace (min/km) | MET |
|---|---|
| > 8:00         | 6 (jog) |
| 6:00–8:00      | 9 |
| 5:00–6:00      | 11 |
| < 5:00         | 13 |

Para walking, MET = 3.5 estable. Hiking, MET ≈ 6 con elev gain factor.

Si HealthKit reporta `activeEnergyBurned` para la sesión, **preferir ese valor**.

### 8.5 Pasos / cadence

- iOS: `expo-sensors` `Pedometer.watchStepCount` durante la sesión.
- Android: idem.
- Cadence = `steps / (movingTimeSec / 60)`. Típico runner = 160-180 spm.

### 8.6 Heart rate

- iOS con HealthKit: leer samples del intervalo de la carrera.
- Sin HealthKit: campo vacío. v1 no soporta wearables BLE directamente.

Zonas (Karvonen simplificado o por % de HR max estimado):

```
HRmax estimada = 220 - edad
Zonas (% HRmax):
  Z1 ≤ 60%
  Z2 60–70%
  Z3 70–80%
  Z4 80–90%
  Z5 ≥ 90%
```

### 8.7 PR detection

Al cerrar la sesión, calcular contra `runs` previas:

- `longest_distance` / `longest_duration` — comparación directa.
- `fastest_1k` / `5k` / `10k` / `half` / `full`: **encontrar el segmento contiguo** de esa distancia con menor tiempo dentro de los `points` de la sesión actual; comparar contra el mejor histórico equivalente.
- `highest_elev_gain` — comparación directa.

---

## 9. Audio coaching y alertas

### 9.1 Engine

`expo-speech` para TTS. Voz se elige una vez (preferencia en `UserProfile.runVoice`). Texto se compone en español:

- "1 kilómetro completado. Tiempo total: 5 minutos 24 segundos. Pace promedio: 5 minutos 24 por kilómetro."
- "Quedan 2 kilómetros para tu objetivo de 8."
- "Estás 15 segundos por debajo de tu pace objetivo."
- "Comenzá a correr. 3 minutos."
- "Caminá. 1 minuto."

### 9.2 Reglas de cues

Configurables por run en setup (§6.3). Defaults:

- **Splits**: cada 1 km.
- **Pace alerts** (si modo `pace`): si pace actual sale de la tolerancia por > 15s.
- **Intervals**: countdown 3-2-1 antes de cambio + announcement del próximo bloque.
- **Tempo**: anuncio de cambio de fase.
- **Halfway / 75%**: cuando hay target de distancia o tiempo.
- **PR alert**: "¡Récord! Acabás de superar tu mejor 5K."

### 9.3 Audio session

- `expo-av` setea `staysActiveInBackground: true`, `interruptionModeIOS: DUCK_OTHERS` para que la música del usuario baje volumen mientras habla la app.
- Beep de intervalos: archivo de audio corto bundled (no TTS, latencia < 50ms).

### 9.4 Vibración / haptic

- Cambio de intervalo: doble haptic medium.
- Split completado: haptic light.
- PR: notification feedback success.

---

## 10. Integraciones

### 10.1 HealthKit (iOS)

Lib: `@kingstinct/react-native-healthkit` (mejor mantenida que la oficial RN-Health, soporta iOS 17+).

Lectura:
- HR samples durante la sesión.
- Active energy burned como fallback de cálculo MET.
- Body weight para mejorar el cálculo de kcal.

Escritura:
- Workout sample (`HKWorkoutTypeIdentifierRunning`/`Walking`/`Hiking`) con duración, distancia, kcal.
- Asociar route (`HKWorkoutRoute`) si user lo permite.

### 10.2 Google Fit / Health Connect (Android)

v2 (no en v1).

### 10.3 Música

- Detectar app de música activa (Spotify, Apple Music) — solo informativo.
- Botón mini de "play/pause/next" usando `MPRemoteCommandCenter` via lib (`react-native-music-control`). v2 si suma fricción a v1.

### 10.4 Weather

- API gratuita (Open-Meteo, sin key). Llamada al `startedAt` con `lat/lon` del primer punto.
- Se guarda en `RunSession.weather`. No bloqueante: si falla, sesión sigue.

### 10.5 Apple Watch

v2 — integración nativa con WatchOS app companion. Out-of-scope.

### 10.6 Strava export

v2 — exportar a GPX/TCX desde `summary` para subir a Strava manual.

---

## 11. Achievements y goals running-specific

Sumar a `constants/achievements.ts`:

| ID | Título | Descripción |
|---|---|---|
| `first_run` | Primera carrera | Loguear tu primer run. |
| `5k_club` | Club de los 5K | Completar tu primer 5K. |
| `10k_club` | Club de los 10K | Completar tu primer 10K. |
| `half_marathon` | Media maratón | Completar 21,1 km en una salida. |
| `marathon` | Maratón | Completar 42,2 km. |
| `100k_lifetime` | 100 km | Sumar 100 km de running totales. |
| `streak_running_7` | Semana corredora | 7 días seguidos con al menos 1 km. |
| `early_bird` | Madrugador | 5 carreras antes de las 7am. |
| `consistent_pacer` | Ritmo firme | 5 splits consecutivos con < 5s diferencia. |
| `vertical_km` | Kilómetro vertical | Sumar 1000 m de elev gain en un mes. |

Goals genéricos extendidos: `FitnessGoal.targetDistanceKm`, `FitnessGoal.targetDurationMin`, `FitnessGoal.targetPaceSec` con periodicidad semanal/mensual.

---

## 12. Permisos y privacidad

### 12.1 Permisos requeridos

| Permiso | Cuándo | Mensaje |
|---|---|---|
| Location · Always | Antes del primer run | "IronLog necesita acceso a tu ubicación para rastrear tus carreras incluso con la pantalla bloqueada." |
| Motion & Fitness | Antes del primer run | "Para contar pasos y cadence durante tus carreras." |
| HealthKit (iOS) | Opcional, en setup | "Sincroniza tus carreras con la app Salud y leé tus pulsaciones." |
| Notifications | Opcional | "Avisos de splits y entrenamientos programados." |
| Photo library | Al adjuntar foto a summary | "Para sumar una foto a tu carrera." |

### 12.2 Privacy zones

Setting global: lista de "zonas privadas" (ubicación + radio en metros). Al renderizar mapas/preview, los puntos dentro de cada zona se enmascaran (no se dibujan, los splits ajustan).

### 12.3 Datos exportables

Botón en `more.tsx` → "Exportar mis carreras" — genera archivo JSON o GPX bundle con todas las sesiones. Refuerza el principio local-first (lo tuyo es tuyo).

### 12.4 Modo incógnito

Toggle "no guardar este run" pre-empezar — útil para cuando se prueba el feature o se quiere correr sin que cuente.

---

## 13. Stack técnico

### 13.1 Librerías a sumar

| Paquete | Uso | Estado |
|---|---|---|
| `expo-location` | GPS foreground/background | **YA INSTALADO** |
| `expo-task-manager` | Background location task | a instalar |
| `expo-sensors` | Pedometer (steps), accelerometer | a instalar |
| `expo-speech` | TTS para audio coaching | a instalar |
| `expo-av` o `expo-audio` | Beeps + audio session config | a instalar |
| `expo-keep-awake` | Mantener pantalla viva | a instalar |
| `expo-background-task` | Fallback background fetch | a instalar |
| `react-native-maps` o `expo-maps` | Mapa con polyline | a instalar (preferir `expo-maps` cuando esté estable) |
| `@kingstinct/react-native-healthkit` | HealthKit (iOS) | a instalar |
| `react-native-svg` | Charts custom (si extendemos LineChart) | **YA INSTALADO** |

### 13.2 Cambios en `app.json`

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSLocationAlwaysAndWhenInUseUsageDescription": "...",
        "NSLocationWhenInUseUsageDescription": "...",
        "NSMotionUsageDescription": "...",
        "UIBackgroundModes": ["location", "audio"]
      }
    },
    "android": {
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "ACTIVITY_RECOGNITION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ]
    },
    "plugins": [
      ["expo-location", { "locationAlwaysAndWhenInUsePermission": "..." }]
    ]
  }
}
```

### 13.3 Estructura de archivos

```
app/run/
  plan.tsx
  live.tsx
  summary.tsx
  history.tsx
  [id].tsx
  routes.tsx
  route/[id].tsx
  plans.tsx

components/run/
  RunMetric.tsx           ← celda métrica grande
  RunMap.tsx              ← wrapper de mapa con polyline
  RunSplitsList.tsx
  RunPaceChart.tsx
  RunElevationChart.tsx
  RunHrChart.tsx
  RunModeSelector.tsx
  RunTargetEditor.tsx
  RouteCard.tsx
  TrainingPlanCard.tsx

contexts/
  RunTrackerContext.tsx   ← service de tracking en vivo

services/
  runMetrics.ts           ← cálculos puros (testeables)
  runAudio.ts             ← engine de cues
  runHealthKit.ts         ← wrapper HealthKit

constants/
  trainingPlans.ts        ← presets (Couch-to-5K, etc.)
  runAchievements.ts      ← (o sumar al achievements.ts existente)
```

---

## 14. Plan de entrega por fases

Inspirado en cómo está fraseada la roadmap actual: cada fase tiene scope claro y criterio de salida. Después de cada fase la app es usable.

### Fase 1 · MVP tracking (free run + summary)

**Scope**:
- Tipos `RunSession`, `RunPoint`, `RunSplit`.
- `RunTrackerContext` con foreground GPS (no background todavía).
- `app/run/plan.tsx` modo `free` solamente.
- `app/run/live.tsx` con view 1 (métricas grandes) + pause/stop.
- `app/run/summary.tsx` con stats básicas + mapa.
- Persistencia en `PersistedState.runs`.
- Permiso "while in use".

**Criterio de salida**: usuario puede salir a correr 30 minutos y guardar la sesión con distancia, tiempo, pace, splits, mapa.

### Fase 2 · Background + audio + targets

- Background tracking con `expo-task-manager`.
- Modos `distance` y `time` con barra de progreso.
- Audio cues splits + halfway.
- View 2 (mapa) en live screen.
- View 3 (splits) en live screen.
- Auto-pause configurable.
- Crash recovery.

### Fase 3 · Intervalos, tempo, history & detail

- Modos `intervals` y `tempo` con cues correspondientes.
- `app/run/history.tsx` con filtros.
- `app/run/[id].tsx` detail.
- PR detection completa.
- Notification persistente Android.

### Fase 4 · Schedule + planning + plans

- `RunPlan`, `ScheduledRun`, integración en home y planning.
- `ResolvedPlan` extendido con `kind: "run"`.
- Toggle Pesas/Running en workout tab.
- `app/run/plans.tsx` con built-ins (Couch-to-5K).
- Goals running-specific.

### Fase 5 · Routes + HealthKit + weather

- `SavedRoute`, `app/run/routes.tsx`, `app/run/route/[id].tsx`.
- Integración HealthKit (lectura HR + escritura workout).
- Weather snapshot al iniciar.
- Privacy zones.
- Achievements running.
- Heatmap geográfico en progress.

### Fase 6 · Polish

- Live Activities iOS.
- Modo low-power.
- Modo incógnito.
- Tags + foto + share image.
- Compare runs.
- Modo treadmill (estimación por pasos).

---

## 15. Edge cases y advertencias

**GPS lost in tunnel/inside**: detectar gap > 15s sin fix; en vez de extrapolar, marcar el segmento como "GPS lost" y no acumular distancia hasta recuperar.

**Trip in airplane mode**: el run sigue (GPS funciona sin internet), pero weather y HealthKit pueden fallar. Defer escritura a HealthKit a `summary`.

**App killed mid-run**: el snapshot persistido cada 30s permite recuperar. Si el snapshot tiene > 5 min sin actualizar al recuperar, pedir confirmación al usuario.

**Llamada entrante**: pause automática del audio TTS (audio session interruption listener); resume al colgar.

**Battery < 10%**: warning en live screen "batería baja, considerá modo low-power".

**Permisos revocados a mitad**: si el usuario quita el permiso `Always` mientras corre, iOS pasa a "while in use" y no manda updates con pantalla bloqueada. Detectar y mostrar warning en pantalla cuando vuelva.

**Cambio de unidades mid-app**: si el usuario cambia metric ↔ imperial entre runs, mostrar en sus unidades originales en `summary` viejo, y marcar la unidad explícitamente. Convertir solo en agregados.

**Time zone change**: usar UTC para `startedAt`/`endedAt`. Las labels visibles usan timezone local en el momento de render.

**Indoor / treadmill sin GPS**: `points = []`. Distancia entrada manual o estimada por pasos × longitud-de-zancada (estimar en `UserProfile`). No hay mapa.

**Datos pesados**: una sesión de 1 hora con sample cada 1s = ~3600 `RunPoint`s. Con 100 sesiones serían ~360k puntos. Si esto se vuelve un problema en AsyncStorage (boot lag), **es exactamente el caso que justifica migrar a SQLite** (cf. `backend.md`). Mientras tanto, downsample a 2-3s en sesiones > 90 min para limitar.

**Offline maps**: `react-native-maps` requiere conexión para tiles. Para v1 aceptamos eso. Cache de tiles offline → v2.

---

## 16. Fuera de scope v1

Listado para evitar scope creep:

- Apple Watch / WatchOS app companion.
- Live Activities en lock screen / Dynamic Island (v6 si v1 anda fluido).
- Cycling, swimming, yoga.
- Segmentos competitivos tipo Strava.
- Descubrimiento social de rutas.
- Wearables BLE (chest strap HR).
- Analytics avanzados (VO2max, training load, fatigue).
- Coaching adaptativo con AI.
- Race day mode con corral y pace bands oficiales.
- Voice control durante la carrera.

Cuando alguno de estos pase a in-scope, sumarlo en el `RUNNING.md` con su propia sección de fase.

---

## Apéndice · Decisiones documentadas (mini-ADRs)

**ADR R-1: una sesión activa global**
Decisión: `activeWorkoutId` y `activeRunId` mutuamente exclusivos.
Razón: la UX de tener dos sesiones simultáneas es confusa y los picos de batería se duplicarían (GPS + sensores). Si querés combinar (gym + run cooldown), se loguean secuencialmente.

**ADR R-2: GPS path se guarda completo**
Decisión: `RunSession.points: RunPoint[]` con todos los puntos (downsampled solo en sesiones largas).
Razón: permite features posteriores (privacy zones recalc, heatmaps, comparar runs) sin reprocesar. Costo en bytes asumido como justificación para migrar a SQLite.

**ADR R-3: cálculos puros separados del context**
Decisión: `services/runMetrics.ts` exporta funciones puras (haversine, splits, calorías) que el context invoca. Tests unitarios sin React.
Razón: alinea con la dirección documentada en `backend.md` §7 ("mutators y comandos").

**ADR R-4: no integrar Strava en v1**
Decisión: posponer integración OAuth con Strava.
Razón: requiere backend (proxy de tokens). Hasta que `api-server` tenga DB y auth, no aplica.

**ADR R-5: voz en español por defecto**
Decisión: `expo-speech` con voz `es-ES` o `es-MX` según el SO.
Razón: app es solo español. Inglés en v2 si se internacionaliza.
