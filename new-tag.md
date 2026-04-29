# Release v1.1.0 — IronLog

Documento de referencia para la creación del tag `v1.1.0` y su correspondiente
release en GitHub. El cuerpo de abajo (a partir de "## Release notes") es lo
que va dentro del mensaje annotated del tag y/o en el body del Release de
GitHub.

---

## Cómo crear el tag y release

### Opción A — Tag + push desde terminal (sin Release UI rico)

```bash
cd /Users/jfrank/Documents/Projects/Iron-Gym

# Verificar que estás en main al día (HEAD = lo que querés taggear)
git status
git log --oneline -3

# Crear el tag annotated leyendo la descripción de este archivo
git tag -a v1.1.0 -F new-tag.md

# Pushear al remote
git push origin v1.1.0
```

Esto deja el tag visible en `https://github.com/JuaniFrank/Iron-Gym/tags`.
La descripción queda como mensaje del tag — no es lo mismo que un Release.

### Opción B — Crear Release con UI rica (recomendado)

1. Crear el tag local y pushearlo (Opción A).
2. Ir a `https://github.com/JuaniFrank/Iron-Gym/releases/new`.
3. En "Choose a tag" elegir `v1.1.0` (ya creado en el paso 1).
4. **Release title**: `v1.1.0 — Redesign + foundations`.
5. **Describe this release**: copiar y pegar todo el bloque "## Release notes" de abajo (el contenido entre `<!-- RELEASE_NOTES_START -->` y `<!-- RELEASE_NOTES_END -->`).
6. Marcar "Set as the latest release".
7. Publish.

### Opción C — Si tenés `gh` CLI más adelante

```bash
gh release create v1.1.0 \
  --title "v1.1.0 — Redesign + foundations" \
  --notes-file new-tag.md \
  --latest
```

> Nota sobre el tag existente `1.1`: ya hay un tag local sin `v` apuntando al
> mismo commit que HEAD. `v1.1.0` es un nombre más estándar (semver). Si
> querés borrar el viejo después: `git tag -d 1.1` y `git push origin
> :refs/tags/1.1`.

---

<!-- RELEASE_NOTES_START -->

## Release notes

> **IronLog v1.1.0 — Redesign completo + foundations para escalar.**
>
> Esta versión cierra el sprint de redesign de UI/UX (paleta "Calm Strength",
> nueva navegación, todas las pantallas iteradas) y deja documentada la
> arquitectura, el modelo de datos, el plan de monetización IAP, el plan de
> release a Android y el módulo de running por venir. Es el primer release
> "presentable" del repo.

### Highlights

- App mobile (Expo SDK 54 + React Native 0.81) con UI completa repensada.
- 30+ pantallas funcionales cubriendo entreno, nutrición, progreso y planning.
- Modelo de datos con 14+ entidades persistido localmente.
- Sistema de planning por fecha con override por día y pre-fill por sesión.
- Editor de bulk por columna en `plan.tsx` con cascadas y igualar todos.
- Documentación exhaustiva: ROADMAP, RUNNING, db, backend, release-android.

### Features incluidas

#### Workout (gym)

- Tracking de sets con weight / reps / RPE / warmup.
- Rutinas personalizables por día de la semana, con días múltiples por rutina.
- 165+ ejercicios pre-cargados, agrupados por músculo.
- Custom exercises con biblioteca propia del usuario.
- Rest timer con auto-start tras completar set.
- **Detección de PRs en vivo y en el summary** (peso, volumen, reps).
- **Bulk column edit** (`plan.tsx`): long-press en KG / REPS / RPE abre sheet
  con patrones (igualar todos, cascada ↓ -2.5/-5, cascada ↑ +2.5/+5, etc.).
- **Auto-fill chips** corregidos: "Repetir última" preserva warmups; "+2,5 kg"
  y "+1 rep" operan sobre el plan actual con fallback a `lastSets`.
- Reordenar / reemplazar / saltar ejercicio en sesión activa.
- Manejo de superset (campo de datos, render visual pendiente — ver ROADMAP 4.4).
- Plan a futuro: pre-pre-fill de pesos según rutina + última sesión.

#### Schedule y planning

- Schedule semanal por día (`ScheduledRoutine`).
- Override por fecha calendario (`ScheduleOverride`) — convertir un día de
  descanso en entreno o viceversa para una fecha específica.
- Pre-fill por sesión (`SessionPlan`) — pesos / reps / RPE pre-definidos por
  fecha que se cargan automáticamente al iniciar el entreno.
- Resolución de plan: override > weekly schedule > rest.
- DaySwapSheet para cambiar el plan de un día con UI consistente.
- "Próximo día de entreno" computado dinámicamente para mostrar en home.
- Entrenar en día de descanso ("training on rest day") flow.

#### Body y mediciones

- Body weight log con histórico y gráfico.
- Body measurements (cintura, pecho, etc.) con histórico.
- Progress photos (URI local de `expo-image-picker`).
- Body fat % via Navy method (calculado a partir de mediciones + perfil).

#### Nutrición

- Food database de 47 items pre-cargados.
- Custom foods con biblioteca propia del usuario.
- Logging por meal type (breakfast / lunch / snack / dinner / other).
- Macro tracking con ring + bars (cal / protein / carbs / fat).
- Goals macros calculados desde profile (sex, age, weight, height, activity, goal).

#### Progress y stats

- Heatmap de consistencia (días entrenados).
- Streak counter (días consecutivos entrenando).
- Volume bar por grupo muscular (semanal vs MEV/MAV/MRV).
- Charts (LineChart, BarRow, MacroRing, Heatmap) con colores temáticos.
- Stats por ejercicio en `exercise-detail.tsx`.

#### Goals y achievements

- Sistema de fitness goals con target weight + target date.
- 13 achievements (sesiones, streaks, PRs, body weight) con celebration overlay.

#### UI / UX

- Tema dual light/dark con paleta "Calm Strength" (lime accent + cream/charcoal).
- Idioma único: español (Argentina).
- 5 tabs: home, workout, progress, nutrition, more.
- Componentes UI base: Button, Card, Text, Header, Badge, Chip, Input,
  IconButton, Screen, Stack, ProgressBar, Divider, Stat, SegmentedControl,
  EmptyState.
- ErrorBoundary global con fallback amistoso.
- Long-press hints (TermHint) en columnas SET / PREVIO / KG / REPS / RPE.
- Celebration overlay para PRs y achievements.
- Bottom sheets consistentes (NoteSheet, BulkColumnSheet, DaySwapSheet,
  ExerciseActionSheet).
- Glass effect en bottom nav.

#### Settings y perfil

- Profile editor (nombre, edad, peso, altura, sexo, activity level).
- Goals macros editables.
- Tema (system / light / dark).
- Units (metric / imperial).
- Reset all data con confirmación.

### Stack técnico

- **Framework**: Expo SDK 54 + React Native 0.81 + expo-router 6.
- **Lenguaje**: TypeScript strict.
- **Build**: Metro bundler + React Compiler habilitado.
- **Storage**: AsyncStorage (`ironlog:v1`) — un único blob JSON con todo el
  estado. Sin DB, sin backend en uso.
- **State**: un único `IronLogContext` con ~30 mutadores expuestos.
- **UI libs**: `@expo/vector-icons` (Feather + MaterialCommunityIcons),
  `react-native-keyboard-controller`, `react-native-gesture-handler`,
  `react-native-reanimated`, `react-native-svg`, `expo-blur`,
  `expo-glass-effect`, `expo-haptics`, `expo-image`, `expo-linear-gradient`.
- **Pre-instalado para futuro**: `expo-location`, `@tanstack/react-query`.
- **Fonts**: Inter via `@expo-google-fonts/inter`.

### Estado de la arquitectura

#### Persistencia (hoy)

- **AsyncStorage** key `ironlog:v1` con un blob JSON único.
- Hidratación al boot, escritura en cada mutación (sin debounce).
- 14+ entidades en `PersistedState`: customExercises, customFoods, routines,
  sessions, bodyWeights, measurements, photos, foodEntries, goals, schedule,
  scheduleOverrides, sessionPlans, achievements, profile, activeWorkoutId,
  defaultRestSeconds.
- Detalle completo en `db.md`.

#### Backend (hoy)

- **No hay backend en uso desde la app.** El usuario funciona 100% local.
- `artifacts/api-server` (Express 5) existe con un único endpoint
  `GET /api/healthz`. La app no lo invoca.
- `lib/db` con scaffolding de Drizzle + Postgres — schema vacío, sin tablas
  definidas. Requiere `DATABASE_URL` para arrancar.
- `lib/api-spec` (OpenAPI YAML) → `lib/api-zod` (Zod) + `lib/api-client-react`
  (hooks React Query) — codegen funcional, expone solo el endpoint healthz.
- `@tanstack/react-query` está montado en `_layout.tsx` pero ningún componente
  dispara queries todavía.

#### Documentación incluida en este release

- **`README.md`** — cómo correr la app y el api-server.
- **`backend.md`** — plan de evolución de la arquitectura (local-first,
  SQLite, sync, backend opcional). 16 secciones + 5 ADRs.
- **`db.md`** — estado actual de storage y datos. Cubre AsyncStorage, modelo
  persistido, librerías presentes y limitaciones.
- **`artifacts/ironlog/ROADMAP.md`** — backlog priorizado de features con
  esquema Qué/Por qué/Plan/Datos/Advertencias/Sugerencias. ~70 items en 7
  secciones (quick wins, table stakes, diferenciales, plataforma, mejoras por
  pantalla, etc.).
- **`artifacts/ironlog/RUNNING.md`** — diseño completo del módulo de running
  por venir. Cubre 9 modos de running, 11 pantallas, modelo de datos,
  arquitectura de tracking en vivo, integraciones (HealthKit, weather), audio
  coaching, plan de entrega por fases.
- **`artifacts/ironlog/release-android.md`** — guía paso a paso para publicar
  en Google Play Store. 20 secciones, checklist de 80+ items, comandos EAS,
  cuestionarios obligatorios, regla 20/14 de testing, permisos sensibles.

#### Sistema de notas (en planificación, no implementado)

ROADMAP.md sección 4.3 + 4.13–4.16 + 5.13–5.14 documenta la fundación de un
sistema de notas estructurado pensado para ser consumible por IA. Incluye:

- Tipos `SessionNote` con categoría / body part / severity / source.
- Recap reflexivo post-workout (3 prompts en 30 segundos).
- Pre-workout "Factor X" para capturar contexto.
- Voice notes hands-free durante la sesión.
- Health timeline / body map de molestias.
- AI Coach conversacional con privacy-first (Apple Intelligence on-device).
- Auto-ajuste del plan basado en notas (con confirmación explícita).

### Conocimientos / decisiones documentadas (ADRs)

- **ADR D-1** (db.md): persistencia única en AsyncStorage hasta que justifique
  migración a SQLite.
- **ADR R-1** (RUNNING.md): una sesión activa global — gym y running
  mutuamente exclusivos.
- **ADR R-2**: GPS path se guarda completo (no compactado prematuramente).
- **ADR A-1** (release-android.md): primera versión a Play Store **sin**
  módulo running, para evitar el form de permisos sensibles en el primer
  launch.
- **ADR A-3**: Play App Signing siempre — Google guarda la signing key.

### Configuración del workspace

- pnpm monorepo con `pnpm-workspace.yaml` (artifacts/* + lib/*).
- `packageManager: "pnpm@10.12.1"` declarado en root para evitar que Corepack
  / Expo CLI escriban yarn por accidente.
- `preinstall` hook que rechaza npm/yarn y borra lockfiles ajenos.
- `minimumReleaseAge: 1440` (1 día) sobre cada paquete npm — defensa contra
  supply-chain attacks.
- Excluidos binarios nativos no usados (esbuild, lightningcss, rollup,
  tailwindcss-oxide, ngrok-bin) excepto los necesarios para el host de cada
  developer.
- Scripts de dev:
  - `pnpm dev` — Replit local.
  - `pnpm dev:ios` — iOS simulator.
  - `pnpm dev:tunnel` / `pnpm dev:tunnel:ios` — tunnel ngrok para compartir
    el QR fuera de la red local.

### Cómo correr esta versión

#### App mobile (iOS local)

```bash
cd artifacts/ironlog
pnpm install
pnpm exec expo start --ios
# o:
pnpm dev:ios
```

#### App mobile (compartir QR remoto)

```bash
cd artifacts/ironlog
pnpm dev:tunnel:ios
```

#### API server (sin DB conectada hoy)

```bash
PORT=3000 pnpm --filter @workspace/api-server run dev
```

#### Typecheck

```bash
pnpm run typecheck
```

### Limitaciones conocidas

- **Datos solo locales**: no hay sync ni backup. Desinstalar la app = perder
  todo.
- **Sin migraciones de schema**: cambios en `PersistedState` rompen blobs
  viejos en silencio (mitigado parcialmente con merge `{ ...defaults,
  ...parsed }`).
- **Re-render global**: cualquier mutación re-renderiza todos los consumidores
  de `IronLogContext`. A escala se va a notar.
- **Escritura O(N) por mutación**: cada cambio reescribe el blob JSON
  completo.
- **Fotos de progreso** se guardan como URI de cache de Expo. Si iOS limpia
  el cache, las URIs se rompen (no copiamos a documentDirectory todavía).
- **Sin tests automatizados**.
- **Sin CI/CD configurado**.
- **No publicada todavía** en App Store ni Play Store.

### Próximos pasos (referencias)

- **Notas + AI**: ROADMAP §4.3, 4.13–4.16, 5.13–5.14.
- **Módulo running**: RUNNING.md (6 fases, MVP en Fase 1).
- **Migración a local-first / SQLite**: backend.md.
- **Lanzamiento a Play Store**: release-android.md.
- **Monetización IAP** (pending de doc dedicado).

### Compatibilidad

- iOS 15.1+ (req mínimo de Expo SDK 54).
- Android 7.0+ (Nougat) / API level 24+.
- Node.js 24 + pnpm 10.12.1 para desarrollo.

### Contribuyentes

- Juan Frank (`@JuaniFrank`).
- Asistencia con Claude Code para diseño, refactors y documentación.

<!-- RELEASE_NOTES_END -->

---

## Notas internas (no van en el release)

- Tag existente `1.1` apunta al mismo commit que HEAD (`37060f6`). El nuevo
  tag `v1.1.0` lo reemplaza con nombre más estándar y descripción completa.
- Si después borrás el `1.1`: `git tag -d 1.1` (local) y
  `git push origin :refs/tags/1.1` (remoto).
- Para próximas versiones recomiendo seguir semver estricto: `v1.1.1` para
  patches, `v1.2.0` para features, `v2.0.0` para breaking changes.
- Considerar mover este flujo a un script `pnpm release` o a un GitHub Action
  cuando haya CI configurado.
