# IronLog — Roadmap de Features

> Documento vivo con backlog priorizado, plan de implementación y notas de UX/datos para cada feature. Pensado para ir tachando a medida que se shippe.

## Índice

1. [Estado actual de la app](#1-estado-actual-de-la-app)
2. [Convenciones del documento](#2-convenciones-del-documento)
3. [Quick wins de UX](#3-quick-wins-de-ux-días-no-semanas)
4. [Features de alto valor](#4-features-de-alto-valor-table-stakes)
5. [Diferenciales](#5-diferenciales-acá-ironlog-puede-ganar)
6. [Plataforma e integraciones](#6-plataforma-e-integraciones)
7. [Mejoras puntuales por pantalla](#7-mejoras-puntuales-por-pantalla)
8. [Temas transversales](#8-temas-transversales)
9. [Orden recomendado de ship](#9-orden-recomendado-de-ship-mvp1--mvp2--mvp3)
10. [Lo que NO ship-earía todavía](#10-lo-que-no-ship-earía-todavía)
11. [Glosario interno](#11-glosario-interno)

---

## 1. Estado actual de la app

Snapshot al momento de escribir este doc. Sirve como base para no proponer features que ya existen.

### Stack

- Expo SDK 54 + React Native 0.81 + expo-router 6
- TypeScript strict
- Persistencia: AsyncStorage (clave `ironlog:v1`) — sin backend, sin auth
- Tema dual (light/dark) con paleta "Calm Strength" (lime accent + cream/charcoal)
- Idioma único: español

### Pantallas existentes

- **Tabs:** `(tabs)/index.tsx` (home), `workout.tsx`, `progress.tsx`, `nutrition.tsx`, `more.tsx`
- **Workout:** `workout/active.tsx`, `workout/summary.tsx`
- **Rutinas:** `routine/[id].tsx` (editor)
- **Otros:** `planning.tsx`, `exercises.tsx`, `exercise-detail.tsx`, `body.tsx`, `goals.tsx`, `achievements.tsx`, `profile.tsx`, `settings.tsx`, `food-add.tsx`, `food-new.tsx`

### Modelo de datos (`types/index.ts`)

- `Exercise`, `RoutineExercise`, `RoutineDay`, `Routine`
- `CompletedSet`, `WorkoutSession`, `PRRecord`
- `BodyWeightEntry`, `BodyMeasurementEntry`, `ProgressPhoto`
- `FoodItem`, `FoodEntry`, `MealType`
- `UserProfile`, `FitnessGoal`
- `ScheduledRoutine` (plan semanal), `ScheduleOverride` (override por fecha calendario), `ResolvedPlan`
- `Achievement`, `AchievementUnlock`

### Constantes seed

- 165 ejercicios en `constants/exercises.ts`
- 47 alimentos en `constants/foods.ts`
- 3-4 rutinas predefinidas en `constants/presetRoutines.ts`
- 13 achievements (sesiones, streaks, PRs, body weight)

### Componentes existentes

- **UI base:** Button, Card, Text, Header, Badge, Chip, Input, IconButton, Screen, Stack (Col/Row), ProgressBar, Divider, Stat, SegmentedControl, EmptyState
- **Charts:** LineChart, BarRow, MacroRing, Heatmap
- **Workout:** SetRow, RestTimer, TermHint
- **Celebration:** CelebrationOverlay
- **Home:** DaySwapSheet
- **Misc:** ErrorBoundary, ErrorFallback, KeyboardAwareScrollViewCompat, MuscleGroupChip

### Utils ya disponibles

- `utils/calculations.ts` — BMR (Mifflin-St Jeor), TDEE, macros por goal, BMI, Navy body fat %, conversiones
- `utils/date.ts` — startOfDay, dateKey, formatDuration, formatTime, getDayOfWeek, etc.
- `utils/id.ts` — uid()

### Lo que YA está hecho (no reproponer)

- Tracking de sets con weight/reps/RPE/warmup
- Rest timer
- Detección de PRs por sesión (en summary)
- Heatmap de consistencia
- Macro tracking básico (ring + barras)
- Streak counter
- Override de plan por fecha (DaySwapSheet)
- Long-press hint en columnas (TermHint para SET/PREVIO/KG/REPS/RPE)
- Celebration overlay para PRs/achievements

---

## 2. Convenciones del documento

Cada feature usa este esquema:

- **Qué** — descripción breve.
- **Por qué** — valor para el usuario.
- **Plan de acción** — pasos concretos.
- **Datos / contratos** — cambios de tipos/contexto/storage si aplican.
- **A tener en cuenta** — sutilezas, casos borde.
- **Advertencias** — riesgos reales.
- **Sugerencias** — copy, UX, micro-interacciones.
- **Esfuerzo:** S (1-2 días) · M (3-5 días) · L (1-2 sem) · XL (>2 sem)
- **Impacto:** Bajo · Medio · Alto · Muy alto

Convención de tildado: `[ ]` pendiente, `[~]` en progreso, `[x]` listo.

---

## 3. Quick wins de UX (días, no semanas)

Fricciones reales sobre lo que ya existe. Son los que mejor ratio impacto/esfuerzo tienen y pueden entrar en un sprint corto.

### 3.1 Plate calculator

`[ ]` Esfuerzo: **S** · Impacto: **Alto**

- **Qué:** modal que se abre al tocar el campo `KG` en `SetRow`. Muestra qué discos cargar a cada lado dada una barra (default 20 kg, configurable a 15 / 10 / fixed).
- **Por qué:** el lifter no piensa en kilos totales, piensa en discos. Es el feature #1 pedido en apps de gym.
- **Plan de acción:**
  1. Crear `components/workout/PlateCalculator.tsx` con un sheet/modal chico.
  2. Agregar `Profile.barWeightKg` (default 20) en `UserProfile` + setting en `settings.tsx`.
  3. Algoritmo greedy con discos estándar (25, 20, 15, 10, 5, 2.5, 1.25, 0.5).
  4. Render visual: barra horizontal con los discos apilados a cada lado, muted en dark mode.
  5. Tap en `KG` abre el modal en read-only; en el modal hay slider/quick chips para ajustar.
- **Datos:** `UserProfile.barWeightKg?: number`, `UserProfile.availablePlatesKg?: number[]`.
- **A tener en cuenta:** debe aceptar pesos imperiales (45 lb bar). Si `units === "imperial"`, cambiar discos a 45/35/25/10/5/2.5.
- **Sugerencias:** mostrar arriba "Por lado: 30 kg" cuando ya hay valor; default plates configurables desde settings.

### 3.2 Quick-weight chips

`[ ]` Esfuerzo: **S** · Impacto: **Alto**

- **Qué:** debajo del numpad (o flotando arriba), chips `+2.5`, `+5`, `-2.5`, `-5`, "= último" para incrementar el peso de un set sin teclear.
- **Por qué:** reduce errores de tipeo y acelera el log entre series.
- **Plan de acción:**
  1. Agregar barra de chips dentro de `SetRow` cuando el input está enfocado.
  2. Botón "= último" copia el peso del set anterior del mismo ejercicio.
  3. Configurable: chips por defecto en `Profile.quickIncrements?: number[]`.
- **Sugerencias:** haptic `selection` en cada tap. No mostrar chips negativos cuando el peso es 0.

### 3.3 e1RM (estimación de 1RM)

`[ ]` Esfuerzo: **S** · Impacto: **Alto**

- **Qué:** mostrar el 1-rep-max estimado en cada set completado y como métrica histórica en `exercise-detail`.
- **Por qué:** la métrica que la gente compara entre sesiones; abre la sección de progreso.
- **Plan de acción:**
  1. En `utils/calculations.ts`: `epley(w, r) = w * (1 + r/30)`, `brzycki(w, r) = w * 36 / (37 - r)`. Promediar (o usar Brzycki para reps ≤ 10, Epley para > 10).
  2. Badge sutil "e1RM 105" al lado del check del set.
  3. En `exercise-detail.tsx`: agregar serie e1RM al `LineChart`.
- **A tener en cuenta:** las fórmulas son inexactas para reps > 12; podés ocultarlas o desclamar el dato más allá de 10 reps.
- **Advertencias:** no llamarlo "tu 1RM" sin la palabra "estimado". El usuario que entrena fuerza pura puede ofenderse.
- **Sugerencias:** mostrar la fórmula usada en el `TermHint` al long-pressear el badge.

### 3.4 Última sesión inline en SetRow

`[ ]` Esfuerzo: **S** · Impacto: **Medio**

- **Qué:** debajo del input KG/REPS, una línea muy fina en color `muted` con "12×80 · RPE 8" del set previo correspondiente.
- **Por qué:** la columna `PREVIO` actual se queda corta cuando el usuario está mirando los inputs; tener la referencia al lado del campo activo evita doble lectura.
- **Plan de acción:**
  1. Reusar `getLastSetsForExercise` ya existente.
  2. Render condicional dentro de `SetRow` cuando hay match para ese índice.
- **Sugerencias:** si no hay PREVIO, mostrar "Primer registro" con un ícono `sparkles` muy sutil.

### 3.5 Detección de PR en vivo

`[ ]` Esfuerzo: **S** · Impacto: **Alto**

- **Qué:** al completar un set que rompe el max histórico, animar el row con accent + haptic medio + tooltip "¡Nuevo PR!" 1.5s.
- **Por qué:** hoy el PR aparece sólo en el summary; perdemos el momento de dopamina que tiene la app.
- **Plan de acción:**
  1. Hook nuevo `useIsNewPR(exerciseId, weight, reps)` que compara contra `getMaxWeightForExercise` + e1RM histórico.
  2. Cuando `logSet` retorna PR, animar `SetRow` (Reanimated `withSequence` scale + glow accent).
  3. `Haptics.notificationAsync(Success)`.
- **A tener en cuenta:** evitar falsos positivos cuando es la primera vez del ejercicio; mostrar como "Primer registro" en vez de "PR".
- **Sugerencias:** pequeña confeti micro (1-2 partículas) en vez del overlay completo del summary.

### 3.6 Onboarding de 3 pantallas

`[ ]` Esfuerzo: **M** · Impacto: **Muy alto**

- **Qué:** wizard al primer abrir: nombre → datos físicos → objetivo + frecuencia → genera plan inicial desde `PRESET_ROUTINES`.
- **Por qué:** hoy el usuario abre la app y está vacía. El primer entreno debe estar a 30 segundos del primer tap.
- **Plan de acción:**
  1. Nueva ruta `app/onboarding.tsx` (fuera de tabs).
  2. Flag `Profile.onboardedAt?: number`. En `_layout.tsx`, redirect a onboarding si no está seteado y no hay sesiones.
  3. Pantalla 1: nombre + foto opcional.
  4. Pantalla 2: sexo, peso, altura, edad, activity level.
  5. Pantalla 3: objetivo (lose/maintain/muscle) + frecuencia (3/4/5 días). Selecciona preset ad-hoc y lo programa en el `schedule` semanal.
  6. CTA final → home con plan listo.
- **Datos:** `UserProfile.onboardedAt?: number`.
- **A tener en cuenta:** que sea skipeable. Que el botón "Saltar" cree perfil mínimo y rutina vacía, no bloquee.
- **Advertencias:** no pedir email/teléfono. La app es offline y eso es un diferencial.
- **Sugerencias:** en pantalla 3, animación de calendario llenándose con los días elegidos.

### 3.7 Hero post-entrenamiento

`[ ]` Esfuerzo: **S** · Impacto: **Medio**

- **Qué:** cuando hoy ya entrenaste (`completedToday`), el hero card cambia a "Recovery / Comer / Logear peso" con CTAs reales en lugar de seguir mostrando "Día de hoy".
- **Por qué:** hoy queda como un botón muerto post-sesión.
- **Plan de acción:**
  1. En `(tabs)/index.tsx`, cuando `completedToday`, render alternativo del hero con 3 CTAs: ir a nutrition, registrar peso, ver summary.
  2. Calcular el primer CTA pendiente según qué le falta loguear hoy (ej. macros < 50% del goal).
- **Sugerencias:** confeti suave 1 vez por día tras la primera sesión; no repetir si vuelve a entrar.

### 3.8 Empty states con acción

`[ ]` Esfuerzo: **S** · Impacto: **Medio**

- **Qué:** en `progress.tsx`, `body.tsx`, `goals.tsx`, reemplazar gráficas planas / cards vacías por `EmptyState` con CTA explícito y umbral de datos.
- **Por qué:** evita confundir al usuario con gráficas vacías.
- **Plan de acción:**
  1. Definir umbrales: progress necesita 4 sesiones, body chart necesita 2 weights, etc.
  2. Reusar `EmptyState` ya existente.
- **Sugerencias:** copy honesto ("Logueá 4 sesiones para desbloquear gráficas") en vez de "Sin datos".

### 3.9 Streak grace day

`[ ]` Esfuerzo: **S** · Impacto: **Medio**

- **Qué:** al completar 7 sesiones, ganás 1 "freeze" (tipo Duolingo). Si saltás un día, se consume sin romper el streak.
- **Por qué:** convierte una métrica punitiva en motivacional. La gente abandona apps cuando rompen un streak grande.
- **Plan de acción:**
  1. Estado nuevo: `streakFreezesAvailable: number`, `streakFreezesUsed: { dateKey: string }[]`.
  2. Al `getStreak`, si hay un gap de 1 día y hay freezes disponibles, consumir uno y continuar.
  3. UI en home: ícono "❄" al lado del streak con contador.
- **Datos:** dos nuevos campos en estado persistido.
- **A tener en cuenta:** máximo 2 freezes acumulables; ganados sólo con actividad real (no por reset).
- **Sugerencias:** haptic + toast "Freeze usado · Tu racha sigue viva" la primera vez que se aplica.

### 3.10 Numpad mejorado en SetRow

`[ ]` Esfuerzo: **S** · Impacto: **Medio**

- **Qué:** cambiar el `keyboardType` a `decimal-pad`, agregar un dot custom si ya hay punto, y un tap-out que confirme valor.
- **Por qué:** los teclados defaults en iOS para numérico tienen UX inconsistente.
- **Sugerencias:** auto-tab al siguiente input al presionar return.

---

## 4. Features de alto valor (table stakes)

Cosas que cualquier usuario que viene de Strong/Hevy/JEFIT espera. Son las que sostienen la decisión de usar la app a largo plazo.

### 4.1 Volumen por grupo muscular semanal

`[ ]` Esfuerzo: **M** · Impacto: **Muy alto**

- **Qué:** en `progress.tsx`, mostrar un gráfico por grupo muscular (pecho, espalda, etc.) con sets efectivos de la semana actual y bandas MEV/MAV/MRV (Renaissance Periodization).
- **Por qué:** el chart que todo lifter serio busca. Hoy `progress.tsx` muestra body weight y volumen total — útil pero no accionable a nivel programación.
- **Plan de acción:**
  1. Agregar utilidad `utils/volume.ts` con `weeklyVolumeByMuscle(sessions, exercises, weekRange)` que cuenta sets efectivos (no warmup) ponderando por músculo primario (1.0) y secundarios (0.5).
  2. Componente `components/charts/MuscleVolumeBar.tsx`: barra horizontal por músculo con marcadores MEV/MAV/MRV.
  3. Defaults sugeridos por género/nivel; ajustables en settings.
  4. Insertar arriba del line chart actual en `progress.tsx`.
- **Datos:** `Profile.volumeTargets?: Record<MuscleGroup, { mev: number; mav: number; mrv: number }>`.
- **A tener en cuenta:** los thresholds dependen de nivel; arrancar con presets razonables (Mike Israetel) y dejar override.
- **Advertencias:** no convertirlo en autoridad — los números son orientativos. Mostrar tooltip explicativo.
- **Sugerencias:** colorear según zona (verde MEV-MAV, amarillo MAV-MRV, rojo > MRV).

### 4.2 Reordenar / reemplazar / saltar ejercicio en sesión activa

`[ ]` Esfuerzo: **M** · Impacto: **Alto**

- **Qué:** dentro de `workout/active.tsx`, drag-to-reorder de cards de ejercicio + acción "Reemplazar" (abre picker filtrado por mismo músculo) + "Saltar" (marca como skipped).
- **Por qué:** caso real: máquina ocupada en el gym, querés cambiar sin romper el plan.
- **Plan de acción:**
  1. Usar `react-native-draggable-flatlist` o reordering manual con Reanimated.
  2. Acción del menú `more-horizontal` en cada card → ActionSheet: Reemplazar / Saltar / Eliminar.
  3. "Reemplazar" abre `exercises.tsx` modal con filtro pre-aplicado del músculo primario del ejercicio actual.
  4. "Saltar" marca `exerciseOrder` con un flag o agrega tabla `skippedExercises`. La lógica del summary debería ignorarlo.
- **Datos:** `WorkoutSession.skippedExerciseIds?: string[]`.
- **A tener en cuenta:** si el ejercicio reemplazado ya tiene sets logueados, preguntar antes de reemplazar.
- **Sugerencias:** al saltar, sugerir un ejercicio alternativo proactivamente.

### 4.3 Sistema de notas estructuradas (fundación)

`[ ]` Esfuerzo: **M** · Impacto: **Alto**

- **Qué:** capturar notas durante y después del entreno como **datos estructurados**, no texto libre suelto. Cada nota tiene categoría, body part (si aplica), severity, fuente (chip/voz/texto) y referencia opcional al set/ejercicio. Es la base sobre la que se construyen 4.13–4.16, 5.13 y 5.14.
- **Por qué:** "dolor en hombro derecho", "la segunda serie me pareció fácil", "barra rebotó" — info clave que hoy se pierde. Si la guardamos estructurada desde el día cero, cualquier feature posterior (visualizaciones, alertas, IA) puede consumirla sin parsear NLP. Sin esta capa, todo lo demás es ruido.
- **Plan de acción:**
  1. Tipos nuevos:
     ```ts
     type NoteCategory = "pain" | "effort" | "technique" | "equipment" | "energy" | "mood" | "other";
     type BodyPart =
       | "shoulder_left" | "shoulder_right" | "elbow_left" | "elbow_right"
       | "wrist_left" | "wrist_right" | "lower_back" | "upper_back"
       | "hip_left" | "hip_right" | "knee_left" | "knee_right"
       | "ankle_left" | "ankle_right" | "neck" | "chest" | "abs";
     type NoteSource = "chip" | "text" | "voice" | "recap";

     interface SessionNote {
       id: string;
       sessionId: string;
       setId?: string;          // si está atada a un set específico
       exerciseId?: string;     // derivable de setId, o nota a nivel ejercicio
       createdAt: number;
       category: NoteCategory;
       bodyPart?: BodyPart;
       severity?: number;       // 1–10, típico para pain/effort
       resolved?: boolean;      // usuario marca cuando dejó de molestar
       text: string;            // texto libre — siempre presente, aunque venga de chip
       source: NoteSource;
       audioUri?: string;       // si vino de voice note
     }
     ```
  2. Campo en `PersistedState`: `notes: SessionNote[]`.
  3. UI de captura — `components/notes/NoteSheet.tsx`:
     - Bottom sheet pequeño abrible desde 3 lugares: ícono `edit-2` al lado del check de un set, FAB durante la sesión, recap post-workout (4.13).
     - Tabs verticales por categoría con chips frecuentes precomputados ("dolor", "fácil hoy", "agarre cambiado", "barra rebotó", "rom completo", "perdí tensión").
     - Tap en chip → si es `pain` despliega selector de body part + slider de severity. Si no, se guarda directo.
     - Campo de texto opcional siempre debajo.
  4. Visualización en `summary.tsx`: sección "Highlights" que lista notas de la sesión, agrupadas por categoría con íconos.
  5. Visualización en `exercise-detail.tsx`: timeline de notas históricas para ese ejercicio.
- **Datos / contratos:** `SessionNote[]` en `PersistedState`. Migración: ninguna ruptura — campo nuevo. Cuando migremos a SQLite (cf. `backend.md`), tabla `session_notes` con índice por `sessionId` + `bodyPart`.
- **A tener en cuenta:**
  - **Chips evolutivos**: las top 8 chips frecuentes deben aprenderse del uso del propio usuario, no ser fijas. Si vos escribís "barra rebotó" 3 veces, aparece como chip al cuarto.
  - **Severity sin numerología obsesiva**: en UI mostrar 3 niveles ("leve / molesta / fuerte" mapeados a 1-3 / 4-6 / 7-10) — el número crudo se guarda pero no aturde.
- **Advertencias:**
  - El `bodyPart` es enum cerrado a propósito. Texto libre como body part rompe la utilidad estructural. Si el usuario tipea "dolor en el aductor" sin mapear a `hip_left/right`, queda como `other` con `text` poblado — la IA puede inferir, los gráficos no.
  - **No prometemos diagnóstico médico**: copy explícito en onboarding del feature ("registro personal, no consejo profesional").
- **Sugerencias:**
  - Haptic `selection` al tap de chip; haptic `medium` al guardar nota de pain con severity ≥ 7.
  - Si una nota nueva de pain tiene severity ≥ 8, ofrecer dos botones inmediatos: "Terminar sesión" / "Seguir con cuidado".
  - Default de chips por categoría: pain → ["leve", "molesta", "fuerte"]; effort → ["fácil", "duro", "RPE alto"]; technique → ["form rota", "buena ejecución", "perdí tensión"].

### 4.4 Supersets visualmente agrupados

`[ ]` Esfuerzo: **M** · Impacto: **Medio**

- **Qué:** el campo `supersetWith` ya existe en `RoutineExercise` pero no se renderiza. Mostrarlos como un bloque con indentación + marcador "A1/A2" + rest timer compartido.
- **Por qué:** lo configurás en routine pero no se nota en sesión, perdiendo la utilidad.
- **Plan de acción:**
  1. En `workout/active.tsx`, agrupar `session.exerciseOrder` consecutivos que estén en superset.
  2. Render: card padre con borde lime soft, ejercicios A1/A2/... dentro.
  3. Rest timer salta entre ejercicios del bloque.
  4. En `routine/[id].tsx`: UI para conectar/desconectar dos ejercicios como superset (drag-drop o "Asociar con anterior").
- **A tener en cuenta:** triset/circuit como caso especial — el campo actual sólo soporta pares. Considerar `supersetGroupId` en lugar de `supersetWith`.
- **Advertencias:** revisar la migración: si hay datos viejos con `supersetWith`, agruparlos al cargar.
- **Sugerencias:** label A1/A2 con la inicial del ejercicio entre paréntesis para identificación rápida.

### 4.5 Barcode scanner en nutrición

`[ ]` Esfuerzo: **M** · Impacto: **Muy alto**

- **Qué:** botón cámara en `food-add.tsx` que abre `expo-camera` + `expo-barcode-scanner`. Lookup contra Open Food Facts API (gratis, no requiere key).
- **Por qué:** es el feature #1 de retención en apps de comida.
- **Plan de acción:**
  1. Instalar `expo-barcode-scanner` (ya viene en SDK 54 vía `expo-camera`).
  2. Pantalla `food-scan.tsx` con cámara + overlay de área de scan.
  3. Al matchear EAN/UPC, fetch a `https://world.openfoodfacts.org/api/v2/product/<ean>.json` y mapear a `FoodItem`.
  4. Si no se encuentra, abrir `food-new.tsx` pre-poblado con el código.
  5. Cachear matches localmente en `customFoods`.
- **Datos:** `FoodItem.ean?: string` para evitar duplicados.
- **A tener en cuenta:** OFF puede no tener data para productos locales argentinos; flow de "Crear manualmente" debe estar a 1 tap.
- **Advertencias:** OFF tiene datos sucios; validar caloriesPer100g antes de aceptar (rango 0-900).
- **Sugerencias:** ofrecer "Foto del paquete" como fallback (foto + macros manuales después).

### 4.6 Templates de rutina por wizard

`[ ]` Esfuerzo: **M** · Impacto: **Alto**

- **Qué:** wizard "Generar rutina": eligen objetivo (fuerza/hipertrofia/cutting), frecuencia (3/4/5/6 días), foco (full body / split). La app ensambla días desde `EXERCISES`.
- **Por qué:** los presets fijos no escalan; un usuario que quiere "5 días, hipertrofia, foco pierna" no tiene match.
- **Plan de acción:**
  1. Definir templates parametrizados en `constants/routineTemplates.ts` (ej. "PPL 6d", "U/L 4d", "Full Body 3d").
  2. Cada template como función: `generate({ goal, frequency, equipmentAvailable }) => Routine`.
  3. Pool de ejercicios indexado por `MuscleGroup` y `ExerciseType`.
  4. Wizard `routine/new-from-template.tsx` con 4 pantallas.
- **Datos:** ninguno nuevo, sólo más data en constants.
- **A tener en cuenta:** balancear volumen entre días (no todos los empujes el mismo día); aplicar progressive overload defaults sensatos.
- **Sugerencias:** mostrar un preview semanal antes de confirmar.

### 4.7 Body fat % calculado (Navy method)

`[ ]` Esfuerzo: **S** · Impacto: **Medio**

- **Qué:** la fórmula Navy ya está en `calculations.ts`. Agregar UI en `body.tsx` para registrar las medidas necesarias (cuello, cintura, cadera) y mostrar trend.
- **Por qué:** dato gratis para el usuario sin balanza especial.
- **Plan de acción:**
  1. Sección nueva en `body.tsx` "Body fat estimado".
  2. Línea de tiempo con cálculo automático cuando hay `BodyMeasurementEntry` con los campos necesarios.
  3. Trend chart al lado del peso corporal.
- **Sugerencias:** dejar claro que es estimación (±3-4%); no usar copy "tu body fat es X".

### 4.8 Stats arriba en exercise-detail

`[ ]` Esfuerzo: **S** · Impacto: **Medio**

- **Qué:** 4 stats arriba del chart: primer registro, último PR, volumen lifetime, mejor e1RM.
- **Por qué:** la gente entra al detalle a ver historia, no solo el último valor.
- **Plan de acción:**
  1. Reusar componente `Stat` existente en `components/ui/Stat.tsx`.
  2. Calcular en `useMemo` desde sesiones.
- **Sugerencias:** tap en cada stat lleva a la sesión donde ocurrió.

### 4.9 Quick-add por repetir comida

`[ ]` Esfuerzo: **S** · Impacto: **Alto**

- **Qué:** en `nutrition.tsx`, sección "Repetir": las últimas 3 comidas logueadas (por meal type) tappeables.
- **Por qué:** la gente come lo mismo 80% del tiempo. Loguear desayuno en 1 tap es la diferencia entre seguir o abandonar.
- **Plan de acción:**
  1. `getRecentEntriesByMeal(mealType, limit=3)` en context.
  2. Card horizontal scrollable arriba del listado actual.
- **Sugerencias:** permitir "guardar comida combinada" (recipe) tras 3 ingresos del mismo conjunto.

### 4.10 Recipe builder

`[ ]` Esfuerzo: **M** · Impacto: **Alto**

- **Qué:** combinar varios `FoodItem` en un único "Recipe" reutilizable (ej. "Mi avena de mañana = avena 60g + leche 200g + miel 15g").
- **Por qué:** las comidas reales son combinaciones; meterlas como ingredientes individuales es 4x el tiempo.
- **Plan de acción:**
  1. Nuevo tipo `Recipe { id, name, items: { foodItemId, grams }[], createdAt }`.
  2. Sección en `more.tsx` o tab dentro de nutrition.
  3. En `food-add.tsx`, las recipes aparecen al lado de los foods con un ícono distintivo.
- **Datos:** `Recipe[]` en estado persistido.
- **Sugerencias:** importar/exportar recipes como JSON para compartir.

### 4.11 Water tracker

`[ ]` Esfuerzo: **S** · Impacto: **Medio**

- **Qué:** vasos de agua diarios. Stepper +/- con goal configurable (default 8).
- **Por qué:** es el tracker más liviano y de más alta retención que existe.
- **Plan de acción:**
  1. Tipo nuevo `WaterEntry { id, dateKey, count, updatedAt }` (1 entry por día).
  2. Card chico en home + sección en nutrition.
  3. Botón flotante "+1 vaso" en home.
- **Sugerencias:** si hay sesión activa, sumar 1 vaso automáticamente al terminar.

### 4.12 Foto del plato (visual log)

`[ ]` Esfuerzo: **S** · Impacto: **Medio**

- **Qué:** opción de adjuntar foto al `FoodEntry`. Sin análisis IA — solo log visual.
- **Por qué:** muchos usuarios prefieren ver lo que comieron antes que recordar gramos. Aporta contexto al tracking.
- **Plan de acción:**
  1. Campo `FoodEntry.photoUri?: string`.
  2. Botón cámara en `food-add.tsx`.
  3. Galería en nutrition por día.
- **Advertencias:** las URIs locales se rompen si el usuario limpia caché; copiar a `FileSystem.documentDirectory`.

### 4.13 Recap reflexivo post-workout

`[ ]` Esfuerzo: **S** · Impacto: **Alto** · **Depende de 4.3**

- **Qué:** después del summary actual, una pantalla extra de 30 segundos con 3 prompts cortos. Skipeable con un tap. Lo capturado se guarda como `SessionNote[]` con `source: "recap"`.
- **Por qué:** la mejor data viene cuando se pide en el momento. Hoy la sesión termina y la oportunidad de capturar "cómo me sentí hoy" se pierde. 30 segundos de fricción consciente = data de altísima calidad para gráficos, alertas y para la IA después.
- **Plan de acción:**
  1. Nueva pantalla `app/workout/recap.tsx`. Aparece tras `summary.tsx` con animación slide-up, no bloqueante (botón "Saltar" arriba).
  2. Tres bloques verticales:
     - **"¿Cómo te sentiste?"** — slider 1–5 con emoji (😩 / 😐 / 🙂 / 😄 / 🔥). Se guarda como `SessionNote { category: "mood", severity: 1-5 }`.
     - **"¿Alguna molestia?"** — silueta SVG del cuerpo (vista frontal + posterior tabbeable). Tap en zona → severity slider. Multi-select. Cada zona genera una `SessionNote { category: "pain", bodyPart, severity }`.
     - **"¿Algo que querés recordar?"** — text input opcional. Una `SessionNote { category: "other", text, source: "recap" }`.
  3. CTA grande "Listo" → home.
- **Datos / contratos:** usa los tipos de 4.3. Sin tipos nuevos.
- **A tener en cuenta:**
  - El recap NO debe ser obligatorio. Si el user lo skipea, no rompe nada.
  - Si ya hay notas durante la sesión que coinciden con el body part del recap (ej. ya marcaste "rodilla derecha" durante un set), pre-seleccionar esa zona en el body map y permitir update de severity en lugar de duplicar.
- **Sugerencias:**
  - Mostrar al final un mini-summary: "Hoy: energía 4/5 · 1 molestia (hombro D leve)" para reforzar el valor del registro.
  - Después de 5 sesiones con recap completado, desbloquear el "Health timeline" (4.16).

### 4.14 Pre-workout "Factor X"

`[ ]` Esfuerzo: **S** · Impacto: **Alto** · **Depende de 4.3**

- **Qué:** pantalla de 10 segundos al iniciar la sesión que captura **factores de confusión**: sueño, energía, contexto. Estos taggean la sesión entera y se guardan como notas de categoría `energy`.
- **Por qué:** un PR un día y una sesión basura al siguiente se explican casi siempre por sueño, ayuno, stress, viaje. Hoy se pierden. Capturándolos podemos correlacionar performance vs contexto y decirle al user *"tus mejores sesiones de squat son cuando dormiste +7h"* — un humano nunca correlaciona eso solo.
- **Plan de acción:**
  1. Nueva pantalla `app/workout/preflight.tsx`. Aparece tras tap "Empezar entrenamiento" en home, antes de `active.tsx`.
  2. Tres preguntas rápidas (todas skipeables):
     - **Sueño anoche**: 3 chips (mal · OK · bien).
     - **Energía hoy**: 3 chips (baja · media · alta).
     - **Algo distinto?** — chips multi-select: ayuno · post-cardio · stress · viaje · enfermedad · primer entreno tras descanso largo · cafeína fuerte · post-comida pesada.
  3. Persiste 1–N `SessionNote { category: "energy", text, source: "chip", createdAt: now }` antes de empezar la sesión.
- **Datos / contratos:** usa tipos de 4.3.
- **A tener en cuenta:**
  - Setting global "Saltar siempre el preflight" para usuarios que les molesta. Por default ON las primeras 5 sesiones, después se vuelve opcional con un dismiss.
  - Si ya hay un preflight de hace < 4 horas (ej. usuario hizo dos entrenos el mismo día), reusar y no preguntar de nuevo.
- **Sugerencias:**
  - Después de 10 sesiones, mostrar un insight inicial en home: "Tus mejores PRs ocurren con sueño 'bien' (78% vs 22% con 'mal')".
  - Animación sutil del bloque de chips elegidos integrándose en el header de la sesión activa ("Energía: alta · ayuno") para reforzar la captura.

### 4.15 Voice notes hands-free durante la sesión

`[ ]` Esfuerzo: **M** · Impacto: **Medio** · **Depende de 4.3**

- **Qué:** botón flotante 🎙 en `workout/active.tsx`. Hold-to-record. Se transcribe on-device (iOS 17+ Speech framework, Android SpeechRecognizer) y se asocia automáticamente al ejercicio en curso + timestamp.
- **Por qué:** tipear con manos sudadas/guantes entre series es feo. Hablar es natural. Captura matices que no entran en chips ("esta serie sentí que el peso me ganó en la última rep, perdí la tensión"). Reduce drásticamente la fricción de capturar nota.
- **Plan de acción:**
  1. Lib: `expo-speech-recognition` o el wrapper sobre `SFSpeechRecognizer` (iOS) / `RecognizerIntent` (Android). Ambos on-device en versiones modernas.
  2. Permiso `NSSpeechRecognitionUsageDescription` (iOS) y `RECORD_AUDIO` + `INTERNET` (Android — algunas mantienen on-device, otras requieren cloud, hay que validar por device).
  3. UI: FAB redondo lime accent en bottom-right durante sesión activa. Hold-to-record con waveform mini en pantalla. Suelta → muestra transcript en una card → tap "Guardar" o "Editar".
  4. Persiste como `SessionNote { source: "voice", text: transcript, audioUri, exerciseId: <currentExerciseId> }`.
  5. Audio file en `FileSystem.documentDirectory + "audio_notes/"`.
- **Datos / contratos:** usa tipos de 4.3 + `audioUri`.
- **A tener en cuenta:**
  - Modo offline: si el SO no soporta on-device en ese device, fallback a guardar solo audio (sin transcript) y mostrar play button. La IA después puede transcribir.
  - **Keep-awake**: la pantalla no debe bloquearse mientras estás grabando.
  - Botón claro para silenciar/desactivar voice notes para sesiones donde no querés (gym ruidoso, no querés que escuchen).
- **Advertencias:**
  - No bypassar el sistema de mic-permission del SO. Cada vez que empieza una sesión y no hay permiso, mostrar un primer-uso explicativo con "Activá micrófono para voice notes".
  - **Privacidad**: el audio se guarda local. **Nunca** se sube a la nube sin consent explícito por usuario (relevante también para 5.13).
- **Sugerencias:**
  - El transcript pasa por un mini-clasificador de chips (regex simple): si dice "dolor" / "molestia" → category=pain con prompt de body part; si dice "fácil" / "duro" → category=effort con severity inferido.
  - Atajo de iOS: Action Button del iPhone 15 Pro+ → empezar voice note (out of scope v1, anotado).

### 4.16 Health timeline / body map de molestias

`[ ]` Esfuerzo: **M** · Impacto: **Alto** · **Depende de 4.3**

- **Qué:** vista nueva accesible desde `body.tsx` o como tab en progress: silueta SVG del cuerpo donde podés tap cualquier zona y ver la timeline de notas de tipo `pain` ahí. Severity over time + sesiones donde apareció + botón "Marcar como resuelto".
- **Por qué:** visualización honesta de tus molestias acumuladas. Útil para vos (detectar patrones) y para mostrar al kine/PT/médico sin tener que recordar fechas. Ninguna app de gym mainstream tiene esto.
- **Plan de acción:**
  1. Nueva ruta `app/health-timeline.tsx`.
  2. Componente `BodyMapSVG` con todas las zonas mappeadas a `BodyPart`. Frontal + posterior con tab toggle.
  3. Cada zona se colorea con intensidad según notas activas (no `resolved`):
     - Sin notas: muted.
     - 1–2 menciones, severity ≤ 4: amarillo soft.
     - 3+ menciones o severity ≥ 6: rojo soft (`danger`).
  4. Tap en zona → bottom sheet con:
     - Lista de notas (desc por fecha): `"hace 3 días · entreno de pierna · severity 6 · 'molesta al bajar'"`.
     - Mini-chart de severity vs tiempo.
     - Lista de ejercicios donde más apareció (top 3).
     - Botón "Marcar todas como resueltas" → seteo `resolved: true` en todas.
  5. Botón "Exportar resumen" → genera PDF con timeline filtrable por fecha + body part. Útil para llevar al kine.
- **Datos / contratos:** usa tipos de 4.3.
- **A tener en cuenta:**
  - **Silueta unisex** y respetuosa. Considerar profile.sex para variantes mínimas (no anatomía detallada — silueta abstracta tipo emergency room).
  - Estado "resuelto" debe persistir incluso si después aparecen notas nuevas en la misma zona (cada nota se evalúa individualmente).
- **Sugerencias:**
  - Notificación opcional: si hay 3+ notas de pain en la misma zona en 14 días, mandar alert sutil "¿Querés reposo / bajar volumen en esa zona?".
  - Export como PDF llevable al fisio = killer feature para usuarios serios.

---

## 5. Diferenciales (acá IronLog puede ganar)

Lo que separa a IronLog del resto. Apuntan a usar el modelo de datos único (override-by-date, e1RM, RPE) en formas que la competencia no hace bien.

### 5.1 Auto-regulation por RPE

`[ ]` Esfuerzo: **M** · Impacto: **Muy alto**

- **Qué:** sugerir el peso del próximo set basándose en el RPE de los últimos N sets de ese ejercicio. Si los RPE vienen bajos, +2.5 kg. Si vienen altos, mantener o bajar.
- **Por qué:** convierte la columna RPE de "decoración" a feature insignia. Es lo que hacen RP, Boostcamp, Juggernaut AI — y casi nadie lo hace bien en español.
- **Plan de acción:**
  1. `utils/autoregulation.ts` con `suggestNextLoad({ history, targetRpe })`. Heurística simple: promedio RPE del último set top de las últimas 2 sesiones; ajusta peso según diferencia con target.
  2. En `SetRow`, antes de loggar, mostrar arriba del input "Sugerido: 102.5 kg" en gris muted.
  3. Tap sobre la sugerencia auto-completa el campo.
  4. Setting global: "RPE objetivo" (default 8) + on/off.
- **Datos:** `Profile.targetRpe?: number`, `Profile.autoregulationEnabled?: boolean`.
- **A tener en cuenta:** necesita histórico — primer ejercicio sin data no sugiere nada (o sugiere repetir).
- **Advertencias:** no imponer la sugerencia. Mostrarla como hint, no como autoridad. El usuario puede ignorarla siempre.
- **Sugerencias:** explicación en `TermHint`: "Sugerido según RPE de tus últimas sesiones".

### 5.2 Auto-fit del plan semanal

`[ ]` Esfuerzo: **M** · Impacto: **Alto**

- **Qué:** si saltaste lunes (rest forzado), el martes el hero te sugiere "Mover Push de ayer a hoy" como banner proactivo (no escondido en el sheet). Mismo motor para semana de descarga: cada N semanas detectar y proponer deload.
- **Por qué:** ya tenés `ScheduleOverride` — falta inteligencia que la use sin pedir input al usuario.
- **Plan de acción:**
  1. Hook `useSchedulingSuggestion()` que evalúa: días faltados últimos 3, semanas consecutivas sin deload, días con > 2 PRs (deload candidato).
  2. Banner colapsable en home arriba del hero, con CTAs.
  3. Aplicar `swapDates` o `setOverrideForDate` con un solo tap.
- **Datos:** logs de cuándo se aplicaron sugerencias para no repetir.
- **A tener en cuenta:** dejar dismiss persistente por sugerencia (no volver a sugerir lo mismo).
- **Sugerencias:** copy honesto y específico: "Ayer faltaste a Push. ¿Lo movés acá?".

### 5.3 Plateau detector

`[ ]` Esfuerzo: **M** · Impacto: **Alto**

- **Qué:** análisis pasivo. Si un ejercicio core (squat/bench/deadlift/row) no progresa en e1RM en 3+ sesiones, card en home: "Bench estancado · 4 semanas" con 3 caminos.
- **Por qué:** valor cada vez que el usuario abre la app, sin pedirle nada.
- **Plan de acción:**
  1. `utils/plateau.ts` con `detectPlateaus(sessions, exercises, options)`. Defina ventana mínima (3 sesiones), tolerancia (e1RM dentro de ±2.5%).
  2. Card especial en home si hay >0 plateaus.
  3. Tap → detalle con sugerencias: deload (-10% peso 1 sem), cambiar variación (sugerir ejercicio similar), aumentar volumen (+1 set).
- **Datos:** ninguno nuevo (solo cómputo derivado).
- **Sugerencias:** detectarlos sólo en ejercicios marcados como "principales" para no spammear.

### 5.4 Readiness check de 5 segundos

`[ ]` Esfuerzo: **M** · Impacto: **Alto**

- **Qué:** modal opcional al iniciar sesión: 3 sliders 1-5 (sueño / energía / dolor). Calcula un score que ajusta el target RPE del día.
- **Por qué:** "Body Battery" personalizado al lifting. La auto-regulation 5.1 se vuelve más exacta con esto.
- **Plan de acción:**
  1. Tipo nuevo `DailyCheckIn { dateKey, sleep, energy, pain, score, createdAt }`.
  2. Modal en `startWorkout` (skipeable, recordar preferencia).
  3. Score = weighted avg → ajusta `targetRpe` para esa sesión (±0.5).
  4. Histórico en `progress.tsx` como mini-chart.
- **Datos:** `dailyCheckIns: DailyCheckIn[]` en estado persistido.
- **A tener en cuenta:** que sea opcional y rápido (5 segundos de tap).
- **Sugerencias:** después de 4 semanas, correlacionar score con PRs/volumen y mostrar insights.

### 5.5 Year/Month in Lift

`[ ]` Esfuerzo: **M** · Impacto: **Alto**

- **Qué:** review automático tipo Spotify Wrapped a fin de mes/año. Volumen total, ejercicio favorito (más volumen), mayor PR, días entrenados, racha máxima, kg "movidos" totales.
- **Por qué:** *shareable factor* alto. La gente comparte estas pantallas y trae usuarios nuevos.
- **Plan de acción:**
  1. Pantalla `app/wrap/[period].tsx` (period = `2026-04` o `2026`).
  2. Render de 5-6 "slides" estilo stories con animaciones bonitas.
  3. Botón "Compartir" usa `expo-sharing` para snapshot PNG (`react-native-view-shot`).
  4. Notificación local el último día del mes / 30 dic.
- **Datos:** ninguno nuevo.
- **A tener en cuenta:** diseño debe verse bien en story (ratio 9:16). Usar el palette accent + ink.
- **Sugerencias:** Easter egg: si el usuario hizo > 100 sesiones en el año, slide especial con copy honesto.

### 5.6 Modo coach customizable

`[ ]` Esfuerzo: **M** · Impacto: **Medio**

- **Qué:** el `TermHint` actual crece a un sistema de tips contextuales por ejercicio (form cues, errores comunes), togglable: "estricto" / "minimalista" / "humorístico".
- **Por qué:** personalidad como producto. Convierte tips genéricos en una voz reconocible.
- **Plan de acción:**
  1. Diccionario `constants/coachTips.ts` indexado por `exerciseId`, con 3 voces por tip.
  2. Setting "Voz del coach" en settings.
  3. Tip card al iniciar el ejercicio (long-press en el nombre del ejercicio).
- **Sugerencias:** dejar al usuario sugerir tips propios, persisten como custom.

### 5.7 Live Activity en lock screen

`[ ]` Esfuerzo: **L** · Impacto: **Alto**

- **Qué:** durante una sesión activa, Live Activity en lock screen + Dynamic Island con rest timer + último set + sets restantes.
- **Por qué:** casi nadie en la categoría tiene esto. Diferencial visual fuerte.
- **Plan de acción:**
  1. Plugin `expo-live-activities` (config plugin) o módulo nativo custom.
  2. Definir `Activity.swift` con `ActivityAttributes`.
  3. Mantener estado actualizado vía `Activity.update()` desde el JS context al lograr/empezar set.
- **Datos:** ninguno nuevo.
- **Advertencias:** sólo iOS 16.1+. Requiere build EAS (no Expo Go).
- **Sugerencias:** ofrecer al usuario al primer end-of-session: "Activá Live Activity para ver el timer en pantalla bloqueada".

### 5.8 Apple Watch companion mínimo

`[ ]` Esfuerzo: **XL** · Impacto: **Alto**

- **Qué:** app watchOS minimal: rest timer + tap "set hecho" + dial RPE.
- **Por qué:** pull magnético para usuarios serios. Hevy/Strong la tienen, pero feas.
- **Plan de acción:**
  1. Crear target watchOS en Xcode (no se puede sólo desde Expo).
  2. Comunicación phone↔watch vía `WCSession` (iOS) y JSI bridge.
  3. Vista única: el set actual, con weight/reps en mono grandes, tap = log.
- **Advertencias:** mantenimiento doble (watch app + phone app). No empezar hasta que el core esté maduro.
- **Sugerencias:** primera versión read-only ("ver tu sesión activa"), luego escritura.

### 5.9 Modo gym social no-auth (sesión live compartida)

`[ ]` Esfuerzo: **L** · Impacto: **Medio**

- **Qué:** generar un link efímero (24h TTL) de tu sesión activa. Un amigo lo abre y ve los sets en vivo. Sin cuenta.
- **Por qué:** diferenciador real frente a apps que te obligan a cuenta para cualquier compartir.
- **Plan de acción:**
  1. Backend mínimo: function en Vercel + KV / Upstash Redis. Endpoint `POST /share` recibe sesión inicial, devuelve `shareId`. `WS /share/:id` para updates en vivo.
  2. Cliente con `expo-sharing`.
  3. Web viewer mínimo (Next.js con read-only del shareId) en `/s/<id>`.
- **Datos:** `WorkoutSession.shareId?: string`.
- **Advertencias:** abre puerta a moderación. Limitar a usuarios anónimos sin texto libre. TTL agresivo. No persistir nada del lado del server más allá del TTL.
- **Sugerencias:** copy del link incluye un código de 4 letras para confirmar entre amigos.

### 5.10 Voz / Siri Shortcut

`[ ]` Esfuerzo: **M** · Impacto: **Medio**

- **Qué:** Intents para "Empezar día de pierna" y "Loguear 100 kg por 5 reps". Disparados desde Siri o atajos.
- **Por qué:** suena premium y en gym a veces no podés mirar la pantalla.
- **Plan de acción:**
  1. Config plugin para `App Intents` (iOS 16+).
  2. Intent `StartDayWorkoutIntent(dayName)` y `LogSetIntent(weight, reps)`.
  3. Conectar al context vía deep link cuando la app abre por intent.
- **Advertencias:** App Intents no son triviales en RN/Expo; investigar si bare workflow es necesario.

### 5.11 What-if simulator

`[ ]` Esfuerzo: **M** · Impacto: **Medio**

- **Qué:** en `exercise-detail`, slider hipotético: "si mi próximo set es 105 kg × 5, ¿cómo cambia mi e1RM trend?".
- **Por qué:** gamifica la planificación; ayuda a setear targets realistas.
- **Plan de acción:**
  1. Sección extra en exercise-detail con 2 sliders (peso, reps).
  2. Recomputar e1RM proyectado y mostrar punto fantasma en el chart.

### 5.12 Compound goals

`[ ]` Esfuerzo: **S** · Impacto: **Medio**

- **Qué:** unir dos `FitnessGoal` en una meta compuesta ("Bajar a 70 kg AND bench 100 kg para diciembre").
- **Por qué:** las metas reales suelen ser combinadas; tracking aislado se queda corto.
- **Plan de acción:**
  1. Campo `FitnessGoal.linkedGoalIds?: string[]`.
  2. Render de progreso combinado (% promedio o ambos progresos en paralelo).

### 5.13 AI Coach conversacional con privacy-first

`[ ]` Esfuerzo: **XL** · Impacto: **Muy alto** · **Depende de 4.3, 4.13, 4.14, 4.16**

- **Qué:** un chat dentro de la app — pestaña nueva o screen en `more` — donde un coach IA **lee tus notas, sesiones y body map** y conversa con vos. Te pregunta proactivamente, te da recomendaciones, contesta tus dudas. Soporta dos modos: **on-device** (Apple Intelligence en iOS 18+ o un small model open-source para Android) o **cloud** (con consent explícito y prompt logs visibles).
- **Por qué:** las notas son data de salud — eso es **diferencial real** vs apps que mandan todo a OpenAI sin pedirte permiso. Tener un coach que conoce todo tu historial y respeta tu privacidad es un moat genuino. El usuario serio paga por eso.
- **Plan de acción:**
  1. **Capa de datos**: función `buildCoachContext(userId)` que arma un JSON compacto con:
     - Últimas N sesiones con stats agregadas.
     - Notas activas (no `resolved`) de todas las categorías.
     - Body map de zonas con menciones.
     - Goals activos.
     - Profile (sin info personal sensible — sexo, edad, peso si user opt-in).
     Truncado a un budget de tokens razonable (ej. 4k tokens).
  2. **Capa de inferencia** — abstracción `CoachProvider` con dos backends:
     - `AppleIntelligenceCoach` — usa el `LanguageModelSession` API (iOS 18.1+). 100% on-device. Cero red.
     - `CloudCoach` — backend `api-server` + `lib/db` + endpoint que hace proxy a Anthropic/OpenAI. Requiere auth (cuando llegue, cf. `backend.md`). Logs de prompts visibles al user.
  3. **UI** — `app/coach.tsx`:
     - Chat estándar tipo Messages, con tu propia paleta.
     - Header con badge: "On-device" verde lime / "Cloud" charcoal.
     - Mensajes proactivos del coach al abrir (ej. *"Vi 3 menciones de molestia en hombro derecho esta semana. ¿Querés que ajuste tu próxima sesión?"*).
     - Acciones inline: si el coach propone un cambio al plan (cf. 5.14), botones "Aplicar" / "Rechazar" / "Más info".
  4. **System prompt** — versionado, en `constants/coachPrompts.ts`. Define tone (calmo, no alarmista, español argentino), reglas (no diagnósticos médicos, sugerencias deben ser conservadoras ante pain), formato de output cuando proponga cambios al plan.
  5. **Triggers proactivos**: el coach abre conversación sin que pidás cuando:
     - Hay 3+ notas de pain en misma zona en 14 días.
     - Hay 2+ sesiones consecutivas con energía "baja".
     - Detecta plateau (cf. 5.3).
     - Llevás N días sin entrenar con goal activo.
  6. **Privacy controls** en settings:
     - Toggle "Modo on-device (recomendado)" / "Modo cloud".
     - Lista de las últimas N requests cloud con prompt visible y botón "Eliminar".
     - Botón "Borrar todas las conversaciones".
- **Datos / contratos:**
  - `interface CoachMessage { id: string; role: "user" | "assistant" | "system"; content: string; createdAt: number; provider: "apple" | "cloud"; promptVersion: string; appliedActions?: AppliedAction[] }`
  - Persistido en `PersistedState.coachMessages: CoachMessage[]` (capeado a últimas 200 messages).
- **A tener en cuenta:**
  - **Apple Intelligence requiere iPhone 15 Pro o más nuevo, iOS 18.1+**. Devices viejos no tienen on-device. Para esos, ofrecer cloud explícito con consent fuerte o no tener coach.
  - **Latencia on-device**: 1–3s por respuesta es normal. UX debe mostrar typing indicator.
  - **Hallucinations** son riesgo real. Mitigar con: prompt strict ("solo respondé sobre la data provista"), validación de outputs estructurados con Zod cuando el coach propone acciones, fallback "No tengo suficiente info" hardcodeado para ciertos triggers.
- **Advertencias:**
  - **Disclaimer médico** obvio en onboarding del feature: "no es consejo médico, reemplaza un kine/médico solo si te conviene".
  - **No mostrar el coach a usuarios menores de 16 años** (regulación, además de prudencia).
  - El backend cloud, si se usa, **debe** estar bajo `api-server` propio, no llamar OpenAI desde la app directo (api keys en cliente = leak).
- **Sugerencias:**
  - Primer mensaje de bienvenida educativo: explicar qué puede y qué no puede hacer.
  - Comandos rápidos sugeridos como chips arriba del input: "¿Cómo voy?", "Ajustar plan", "Resumen de la semana".
  - Export de chat completo a Markdown — útil si querés llevar al kine.

### 5.14 Auto-ajuste del plan basado en notas

`[ ]` Esfuerzo: **L** · Impacto: **Muy alto** · **Depende de 5.13**

- **Qué:** el coach (5.13) no solo conversa — **acciona**. Cuando detecta dolor en zona X, propone un "plan ajustado" para los próximos N días: -10% peso en ejercicios que más involucran esa zona, alternativas de ejercicios, posible inserción de cooldown / mobility extra. El usuario confirma o rechaza con un tap.
- **Por qué:** es el output natural del coach. Sin esta capa, el coach es solo conversación; con ella, se vuelve un asistente real que cierra el loop "captura nota → analiza → modifica plan". Es exactamente la idea original de "si hay dolor, sugerir 1kg menos o reps menos en músculos afectados".
- **Plan de acción:**
  1. **Mapa ejercicio → músculos** ya parcialmente en `EXERCISES` con `primaryMuscle` + `secondaryMuscles`. Expandir si hace falta.
  2. **Mapa body part → músculos afectados** (`shoulder_right` → `chest, anterior_delt, triceps`).
  3. **Action types** que el coach puede proponer (validados con Zod):
     ```ts
     type CoachAction =
       | { type: "reduce_weight"; exerciseId: string; daysAhead: number; reductionPct: number }
       | { type: "reduce_reps"; exerciseId: string; daysAhead: number; reductionAbs: number }
       | { type: "swap_exercise"; fromId: string; toId: string; reason: string; daysAhead: number }
       | { type: "skip_exercise"; exerciseId: string; daysAhead: number }
       | { type: "add_warmup"; bodyPart: BodyPart; durationSec: number };
     ```
  4. **Aplicación**: cuando el user acepta, el sistema crea/edita `SessionPlan` para los próximos `daysAhead` días afectados. Un nuevo `appliedActions: AppliedAction[]` se asocia al plan para mostrar al user en `plan.tsx` ("Coach ajustó: -10% press banca por molestia hombro derecho").
  5. **Diff visible**: la pantalla `plan.tsx` muestra los cambios en un diff inline (tachado peso original, nuevo peso accent). Botón "Restaurar original" siempre disponible.
  6. **Learning loop**: si el user rechaza 3 veces el mismo tipo de sugerencia, el coach deja de proponerla y aprende ese contexto.
- **Datos / contratos:**
  - `interface AppliedAction { id: string; action: CoachAction; appliedAt: number; messageId: string; rejected?: boolean; rejectedAt?: number }`
  - `SessionPlan.appliedActions?: AppliedAction[]`.
- **A tener en cuenta:**
  - **Conservadurismo by default**: -10% de peso es demasiada para algunos, demasiado poco para otros. El coach debe inferir desde la severity (severity 4 → -5%, severity 8 → -20% + skip si es ejercicio compound).
  - **Reversibilidad**: el original siempre se preserva. El "ajustado" es una capa encima. Esto es crítico — si el user no quiere el ajuste, debe poder deshacerlo en 1 tap sin perder data.
  - **No tocar más de N días hacia adelante** sin confirmación (ej. máximo 3 sesiones). Más allá es presunción.
- **Advertencias:**
  - El coach no es médico. Si severity ≥ 8 o duración > 21 días, en lugar de ajustar el plan, recomendar consulta profesional explícitamente.
  - **No bypassar consent**: ningún plan se modifica sin tap explícito del user. El coach propone, user dispone.
  - Validar exhaustivo el output del LLM con Zod — si el LLM aluc inación un ejercicio que no existe, descartar la acción y loggear.
- **Sugerencias:**
  - "Apply All" como atajo cuando el coach propone un set completo de ajustes coherentes (ej. "ajustar todo el día de pierna").
  - History de ajustes en settings — el user puede ver "estos son los cambios que el coach me sugirió este mes".
  - Cuando el user marca el dolor como `resolved` en 4.16, ofrecer auto-revert de los ajustes activos relacionados.

---

## 6. Plataforma e integraciones

Cosas que tocan más infraestructura. Pensar bien antes de meter scope.

### 6.1 Apple HealthKit sync

`[ ]` Esfuerzo: **L** · Impacto: **Alto**

- **Qué:** import body weight desde Health, export workouts (calorías quemadas estimadas, duración) a Health.
- **Por qué:** cierra el ciclo de balance energético. Usuarios que ya usan Health se enganchan rápido.
- **Plan de acción:**
  1. Lib `expo-healthkit` o `react-native-health` (requiere build EAS).
  2. Permisos al primer abrir nutrition o body.
  3. Sync bidireccional: at app start, pull pesos nuevos desde Health; al `finishWorkout`, push workout summary.
- **Datos:** flag `BodyWeightEntry.source: 'manual' | 'healthkit'`.
- **Advertencias:** reglas de App Store: HealthKit data no puede salir del device sin consent explícito.
- **Sugerencias:** durante onboarding, ofrecer importar últimos 30 días de peso.

### 6.2 Cloud backup anónimo

`[ ]` Esfuerzo: **L** · Impacto: **Muy alto**

- **Qué:** generar código de recuperación al instalar (12 palabras o 6 letras + 6 dígitos). Con ese código en otro dispositivo, recuperás todo. Sin email, sin password, sin cuenta.
- **Por qué:** mejor UX que pedir cuenta antes de saber si vas a usar la app.
- **Plan de acción:**
  1. Backend en Vercel + Postgres (Supabase / Neon). Tabla `backups(code TEXT PK, encrypted_blob BYTEA, updated_at)`.
  2. Cliente: clave AES local derivada del código, blob cifrado en cliente antes de upload.
  3. Setting "Backup en la nube" off por defecto. Al activar, mostrar el código una vez con CTA "Guardalo".
  4. Auto-upload diferido (debounced 5min) tras cambios.
  5. Recuperación: pantalla en settings "Restaurar con código".
- **Datos:** `Profile.backupCode?: string` (o no almacenar — sólo mostrar al activar).
- **Advertencias:** el código debe ser inválido + invalidable; si el usuario lo pierde, no hay recuperación. Copy claro.
- **Sugerencias:** guardar fecha del último backup en profile y mostrarla en settings.

### 6.3 Sync iCloud

`[ ]` Esfuerzo: **M** · Impacto: **Alto**

- **Qué:** entre iPhone/iPad/Mac del mismo Apple ID, vía CKShare o documento iCloud.
- **Por qué:** sin backend; gratis para el dev y rápido para el usuario.
- **Plan de acción:**
  1. Mover persistencia de AsyncStorage a SQLite + iCloud document container.
  2. Resolución de conflictos: last-write-wins por `updatedAt` en cada entidad.
- **Advertencias:** iCloud Sync es notoriamente difícil. Considerar 6.2 antes de esto.

### 6.4 Web companion read-only / editor

`[ ]` Esfuerzo: **L** · Impacto: **Medio**

- **Qué:** web app (Next.js) para diseñar rutinas con teclado en pantalla grande. Read-only en MVP1; editor en MVP2.
- **Por qué:** lifters serios arman su programa los domingos en la PC.
- **Plan de acción:**
  1. Re-utilizar parte del código RN con react-native-web (ya está como dep).
  2. O Next.js separado consumiendo el backup endpoint.
  3. Sync vía 6.2 o un endpoint dedicado.

### 6.5 Export / Import

`[ ]` Esfuerzo: **S** · Impacto: **Alto**

- **Qué:** export a JSON / CSV. Import desde Strong y Hevy CSV.
- **Por qué:** la gente quiere salida para Excel y para no quedar trabada en la app antes de confiar en ella. Import facilita migración.
- **Plan de acción:**
  1. `Settings → Exportar datos`: genera JSON pretty + CSV de sesiones (un row por set), comparte vía `expo-sharing`.
  2. `Settings → Importar`: file picker (.csv), parser para Strong y Hevy.
  3. Mapeo de ejercicios: si el nombre matchea uno existente, reusar; si no, crear como custom.
- **Datos:** mapeo de aliases en `constants/exerciseAliases.ts`.
- **Advertencias:** validación estricta — datos con timestamp inválido pueden romper streaks/heatmap.
- **Sugerencias:** preview antes de confirmar import.

### 6.6 Widgets (iOS 17+)

`[ ]` Esfuerzo: **L** · Impacto: **Medio**

- **Qué:** widget de home: día de hoy + streak + último PR. Variante interactiva para iOS 17+ con "Iniciar sesión".
- **Plan de acción:**
  1. Widget Extension nativo (no se puede 100% Expo).
  2. App Group compartido para acceder al estado.
  3. Refresh por timeline + manual refresh tras cambios via background fetch.
- **Advertencias:** mantenimiento. Solo iOS.

### 6.7 Notificaciones

`[ ]` Esfuerzo: **S** · Impacto: **Medio**

- **Qué:** recordatorios: rest timer, día de entrenamiento programado, missed-day nudge.
- **Plan de acción:**
  1. `expo-notifications` con permission flow al primer onboarding.
  2. Schedule local: 1h antes del entrenamiento programado.
  3. Smart nudge: si llevás 2 días missed, "Volvé hoy, tu última sesión fue [day name]".
- **Advertencias:** no spammear. Dar control granular en settings.

### 6.8 Localización (multi-idioma)

`[ ]` Esfuerzo: **M** · Impacto: **Medio**

- **Qué:** infra i18n + traducciones en EN. Hoy hardcoded en español.
- **Plan de acción:**
  1. `expo-localization` + `i18n-js` o `react-i18next`.
  2. Extraer strings a `locales/es.json` y `locales/en.json`.
  3. Selector en settings; default desde `Localization.locale`.

---

## 7. Mejoras puntuales por pantalla

Cosas chicas que detecté pantalla por pantalla.

### Home (`(tabs)/index.tsx`)

- `[ ]` Hero post-entrenamiento dinámico (3.7).
- `[ ]` Banner de sugerencia auto-fit (5.2).
- `[ ]` Card de plateau detector cuando aplica (5.3).
- `[ ]` Mini ring de macros del día tappable hacia nutrition.
- `[ ]` Streak con ❄ si hay freeze disponible (3.9).
- `[ ]` Heatmap interactivo: tap en un día abre detalle de esa sesión.

### Workout tab (`(tabs)/workout.tsx`)

- `[ ]` Sección "Recientes" arriba con últimas 3 rutinas usadas.
- `[ ]` Search en el listado de rutinas si > 10.
- `[ ]` "Quick start" abajo con contextual: si hay schedule de hoy, CTA directo.
- `[ ]` Filtrar presets por equipamiento disponible.

### Workout activo (`workout/active.tsx`)

- `[ ]` Auto-arrancar rest timer al log set (3.5 PR detection lo refuerza).
- `[ ]` Reordenar/saltar (4.2).
- `[ ]` Notas por set (4.3).
- `[ ]` Supersets agrupados (4.4).
- `[ ]` Volumen target progress bar arriba (sets pendientes vs hechos).
- `[ ]` Botón "Cerrar sesión sin terminar" alternativo a "Descartar" — guarda en draft pero no la finaliza.
- `[ ]` Foto de la barra (1 por sesión) para record visual.

### Progress (`(tabs)/progress.tsx`)

- `[ ]` Volumen por músculo arriba (4.1) > body weight chart.
- `[ ]` Tab "Comparar": dos rangos de fechas lado a lado.
- `[ ]` Filtro por ejercicio en el line chart.

### Nutrition (`(tabs)/nutrition.tsx`)

- `[ ]` Quick-add por repetir comida (4.9).
- `[ ]` Recipe builder (4.10).
- `[ ]` Water tracker (4.11).
- `[ ]` Ring overlap "consumido vs target" más legible (hoy se confunde).
- `[ ]` Foto del plato (4.12).
- `[ ]` Pegar copy nutricional desde el portapapeles (parsing simple) — para usuarios que ya escanearon en otra app.

### Body (`body.tsx`)

- `[ ]` Mini line chart por cada medida (cintura, brazo, etc.). Hoy solo peso tiene chart.
- `[ ]` Comparador foto-a-foto con slider de transparencia.
- `[ ]` Body fat estimado (4.7).
- `[ ]` Sleep slider diario (alimenta 5.4).

### Exercise detail (`exercise-detail.tsx`)

- `[ ]` 4 stats arriba (4.8).
- `[ ]` Toggle "peso máx / volumen / e1RM" en el chart.
- `[ ]` Listado de últimas 10 sesiones con peso/reps/RPE.
- `[ ]` Botón "Crear meta de PR para este ejercicio".
- `[ ]` What-if simulator (5.11).

### Goals (`goals.tsx`)

- `[ ]` Compound goals (5.12).
- `[ ]` Bar de progreso real (no solo checkbox).
- `[ ]` Si goal exercise tiene PR reciente, auto-marcar como completed.

### Achievements (`achievements.tsx`)

- `[ ]` Más achievements (Volume 1M kg, "Sin saltar 30 días", "RPE 10 en compound", etc.). Hoy son 13.
- `[ ]` Filtrar por categoría.
- `[ ]` Compartir achievement como imagen.

### Planning (`planning.tsx`)

- `[ ]` Drag-and-drop en el plan semanal para reordenar.
- `[ ]` Acción "Repetir esta semana" → copia overrides al rango futuro.
- `[ ]` Vista de mes con plan + sesiones reales superpuestas.

### Settings (`settings.tsx`)

- `[ ]` Export/Import (6.5).
- `[ ]` Backup en la nube (6.2).
- `[ ]` Cambiar barra default + discos disponibles (3.1).
- `[ ]` RPE objetivo + autoregulation toggle (5.1).
- `[ ]` Voz del coach (5.6).
- `[ ]` Idioma (6.8).
- `[ ]` Notificaciones granular (6.7).

### More (`(tabs)/more.tsx`)

- `[ ]` Reorganizar para que entradas frecuentes (body, planning, achievements) estén arriba.
- `[ ]` Section "Recetas" si 4.10 está hecha.

---

## 8. Temas transversales

Cosas que no son features pero impactan toda la app.

### 8.1 Testing

- `[ ]` Setup `vitest` o `jest` para utils puros (`calculations.ts`, `volume.ts`, autoregulation).
- `[ ]` Detox o Maestro para flow E2E mínimo: onboarding → log set → finish workout.
- `[ ]` Snapshot tests de componentes UI base.
- **A tener en cuenta:** la lógica del context es donde más bugs van a aparecer; testear `getPlanForDate`, `swapDates`, `finishWorkout`.

### 8.2 Telemetría / analítica

- `[ ]` Posthog o Plausible (sin PII). Eventos clave: `onboarding_done`, `set_logged`, `workout_finished`, `pr_detected`.
- `[ ]` Toggle on/off en settings + opt-out al instalar.
- **Advertencias:** no trackear contenido (nombres, fotos). Sólo eventos agregados.

### 8.3 Crashlytics / error reporting

- `[ ]` Sentry SDK con `expo-application` + `expo-device`.
- `[ ]` Cubrir el `ErrorBoundary` para que reporte automáticamente.

### 8.4 Performance

- `[ ]` Profiling de re-renders con `react-devtools` profiler. El `IronLogContext` actual disemina cambios; considerar dividir en sub-contexts (workout, nutrition, profile).
- `[ ]` Memoizar selectors caros (`getStreak`, agregaciones de progress).
- `[ ]` Lazy-load de pantallas no críticas (`achievements`, `goals`).

### 8.5 Accesibilidad

- `[ ]` Audit de touch targets (`SetRow` tiene zonas chicas para gym hands sudados).
- `[ ]` `accessibilityLabel` en IconButtons sin texto.
- `[ ]` `Dynamic Type` support — la tipografía actual fija `fontSize` en muchos lados.
- `[ ]` Modo "gym hands": tamaño de tap aumentado configurable.

### 8.6 Migraciones de schema

- `[ ]` Versionado de la clave AsyncStorage (`ironlog:v1` → `:v2`).
- `[ ]` Función `migrate(prevState, prevVersion)` que se ejecuta al cargar.
- **Advertencias:** ya hay datos vivos en device; cualquier rename de campo necesita backfill.

### 8.7 Diseño de tokens / dark mode revisión

- `[ ]` Auditar contraste de los `mutedSoft` en dark mode.
- `[ ]` Definir `radius` token por scale (sm/md/lg/full) en lugar del único actual.
- `[ ]` Animations tokens (durations, easings) para consistencia.

### 8.8 Sweat / gym mode

- `[ ]` Modo "Pantalla siempre encendida" durante sesión activa (`expo-keep-awake`).
- `[ ]` Modo automático dim por sensor de luz ambiental.
- `[ ]` Botones grandes opcional.

### 8.9 Internacionalización del data

- `[ ]` Si se libera con i18n (6.8), traducir nombres de ejercicios y comidas.
- `[ ]` Mantener nombres alternativos buscables.

---

## 9. Orden recomendado de ship (MVP1 → MVP2 → MVP3)

### MVP1 — Acabar la sensación de producto pulido (3-4 semanas)

Foco: que cada flow existente brille. Sin features nuevas grandes.

1. **3.1 Plate calculator** — el más pedido en gym apps.
2. **3.2 Quick-weight chips** + numpad mejorado (3.10).
3. **3.3 e1RM**.
4. **3.4 Última sesión inline en SetRow**.
5. **3.5 Detección de PR en vivo**.
6. **3.6 Onboarding de 3 pantallas**.
7. **3.7 Hero post-entrenamiento**.
8. **3.8 Empty states con acción**.
9. **3.9 Streak grace day**.
10. **6.5 Export / Import** (en settings).

### MVP2 — Inteligencia y diferenciales (4-6 semanas)

Foco: usar la data que ya tenemos para aportar valor pasivo.

1. **4.1 Volumen por grupo muscular semanal** — el chart insignia.
2. **5.1 Auto-regulation por RPE** — convierte RPE en feature.
3. **5.3 Plateau detector**.
4. **5.4 Readiness check de 5 segundos**.
5. **5.2 Auto-fit del plan semanal**.
6. **4.2 Reordenar/reemplazar/saltar ejercicio**.
7. **4.3 Notas por set**.
8. **4.4 Supersets agrupados**.
9. **5.5 Year/Month in Lift**.

### MVP3 — Nutrición seria + plataforma (4-8 semanas)

Foco: cerrar el lado de nutrición y abrir cloud/sync.

1. **4.5 Barcode scanner**.
2. **4.9 Quick-add por repetir comida**.
3. **4.10 Recipe builder**.
4. **4.11 Water tracker**.
5. **6.1 Apple HealthKit**.
6. **6.2 Cloud backup anónimo**.
7. **6.7 Notificaciones**.
8. **5.7 Live Activity** (post-EAS build).

### Backlog largo plazo

- 5.8 Apple Watch companion.
- 5.9 Live sharing no-auth.
- 5.10 Siri Shortcuts.
- 6.3 iCloud sync.
- 6.4 Web companion.
- 6.6 Widgets.
- 6.8 i18n.
- 8.x Suite de testing y observabilidad.

---

## 10. Lo que NO ship-earía todavía

- **Social pesado / feed / leaderboards.** Requiere moderación, backend, retención de contenido. La app local-first es el diferencial; rompe la promesa muy temprano.
- **AI workout generation tipo FitBod.** Suena premium pero abre soporte infinito. Mejor wizards templated (4.6) que se sientan inteligentes sin promesa de IA.
- **Análisis de fotos con IA.** Ruido legal (datos sensibles), costoso de mantener.
- **Pago / suscripción.** No antes de tener tracción real (>10k usuarios activos).
- **Más de un athlete (modo coach con clientes).** Se queda corto el modelo de datos actual; replantear primero el storage.

---

## 11. Glosario interno

- **e1RM** — estimación de 1 rep max desde un set submáximo.
- **RPE** — Rate of Perceived Exertion (1-10).
- **RIR** — Reps in Reserve (10 - RPE aproximadamente).
- **MEV / MAV / MRV** — Minimum Effective / Maximum Adaptive / Maximum Recoverable Volume (Renaissance Periodization).
- **Deload** — semana de baja intensidad (-30 a -50% volumen) cada 4-6 semanas.
- **Auto-regulation** — ajustar peso/reps según RPE en lugar de un plan rígido.
- **Plateau** — ausencia de progreso medible en N sesiones.
- **Ready check** — auto-evaluación corta de sueño/energía/dolor previa a la sesión.
- **Override (de schedule)** — entrada `ScheduleOverride` que pisa el plan semanal para una fecha calendario específica.
- **Swap (de día)** — intercambiar dos fechas mediante dos overrides, preservando volumen semanal.

---

## Notas de mantenimiento

- Mantené este doc actualizado al cerrar cada feature (cambia `[ ]` por `[x]` y movelo a la sección de "Estado actual" si es relevante).
- Cada feature que entre debería tener su propia entrada de PR description con link a la sección correspondiente.
- Cuando aparezcan nuevas ideas, sumalas al final de la sección que corresponda con el mismo formato.

