# Release v1.2.0 — IronLog

Documento de referencia para la creación del tag `v1.2.0` y su correspondiente
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
git tag -a v1.2.0 -F new-tag.md

# Pushear al remote
git push origin v1.2.0
```

Esto deja el tag visible en `https://github.com/JuaniFrank/Iron-Gym/tags`.

### Opción B — Crear Release con UI rica (recomendado)

1. Crear el tag local y pushearlo (Opción A).
2. Ir a `https://github.com/JuaniFrank/Iron-Gym/releases/new`.
3. En "Choose a tag" elegir `v1.2.0` (ya creado en el paso 1).
4. **Release title**: `v1.2.0 — Notes, Recap & Preflight`.
5. **Describe this release**: copiar y pegar todo el bloque "## Release notes" de abajo (entre `<!-- RELEASE_NOTES_START -->` y `<!-- RELEASE_NOTES_END -->`).
6. Marcar "Set as the latest release".
7. Publish.

### Opción C — Si tenés `gh` CLI más adelante

```bash
gh release create v1.2.0 \
  --title "v1.2.0 — Notes, Recap & Preflight" \
  --notes-file new-tag.md \
  --latest
```

---

<!-- RELEASE_NOTES_START -->

## Release notes

> **IronLog v1.2.0 — Sistema de notas estructuradas, recap reflexivo y preflight contextual.**
>
> Esta versión introduce las features 4.3, 4.13 y 4.14 del ROADMAP y deja la
> base sembrada para 4.15 (voice notes) y 4.16 (body map full screen) sin
> cambios al schema. Suma un sistema de descubrimiento progresivo de features
> con arquitectura premium-ready, fix crítico al detector de PRs, y separación
> formal de los planes de DB y state management en docs nuevos.

### Highlights

- **Sistema de notas estructuradas** con 7 categorías, 17 zonas corporales tappables, severity bucketeada y fuente identificable (chip / texto / voz / recap / preflight).
- **Recap post-workout** reflexivo de 30 segundos con mood selector, body map mini SVG y texto libre. Reabrible hasta 24h después.
- **Preflight Factor X** pre-sesión con sueño, energía y factores contextuales (ayuno, cardio, stress, viaje, etc.).
- **Sistema de descubrimiento progresivo** — los features opt-in aparecen cuando el usuario tiene contexto para valorarlos (ej. recap se ofrece tras 3 sesiones, preflight tras 5).
- **Arquitectura premium-ready** — `services/entitlements.ts` listo para integrar IAP via RevenueCat sin tocar UI.
- **Fix crítico de PR detection**: el primer set de un ejercicio nuevo ya no se marca incorrectamente como PR.
- **Refactor visual de `SetRow`**: distinción clara entre completed / active / planned con borders y backgrounds diferenciados.
- **Migración de docs**: `db.md` + `backend.md` reemplazados por `db_system.md` + `state_mang_system.md` con evaluación detallada de Turso como opción de sync.

### Features incluidas

#### Notes — Sistema de notas estructuradas (ROADMAP §4.3)

- **Tipos canónicos** en `types/index.ts`: `SessionNote`, `NoteCategory`, `BodyPart`, `NoteSource`.
- **7 categorías**: `pain`, `effort`, `technique`, `equipment`, `energy`, `mood`, `other`.
- **17 zonas corporales** (enum cerrado): hombros, codos, muñecas, cuello, espalda alta/lumbar, pecho, abdomen, caderas, rodillas, tobillos.
- **Severity 1–10** stored en backend, **bucketeada en UI** según categoría:
  - Pain → 3 niveles (leve / molesta / fuerte) con slider + colores (accent / warning / danger).
  - Effort/Energy → 3 chips (fácil-medio-duro / baja-media-alta).
  - Mood → 5 emojis (😩 😐 🙂 😄 🔥) mapeados a 1/3/5/7/10.
- **Captura rápida** via long-press en el check del set → menú con top 4 chips de "effort". 1 tap → nota guardada.
- **Captura detallada** via ícono `edit-2` al lado del check → bottom sheet completo con categoría / zona / severity / chips frecuentes / texto libre.
- **Lista de notas existentes** cuando un set ya tiene ≥1 nota: el sheet abre con cards tappables (tap → editar) + botón "Agregar otra".
- **Mini-badge "•"** en el check del set cuando tiene notas asociadas.
- **Highlights en summary** agrupados por categoría con header + count.
- **Timeline histórica** en exercise-detail con hasta 20 notas relativas ("hace 3 días", "ayer", etc.).
- **Chips evolutivos**: textos libres repetidos ≥3 veces en últimas 20 sesiones suben automáticamente al top de sugerencias.
- **Forward compat con 4.15** (voice): `source: "voice"` y `audioUri?: string` ya en el schema.
- **Forward compat con 4.16** (health timeline): helpers `activePainNotes()`, `notesByBodyPart()`, queries por `bodyPart` / `severity` / `resolved` listos.

#### Recap — Reflexión post-workout (ROADMAP §4.13)

- Pantalla nueva en `app/workout/recap.tsx` con 3 bloques:
  1. **MoodSelector** — 5 emojis con border accent al seleccionar.
  2. **BodyMapMini** — silueta SVG abstracta unisex con tabs Frontal/Posterior. 17 zonas tappables que mappean al enum `BodyPart`. Cada zona seleccionada despliega su SeveritySlider + textbox opcional.
  3. **Texto libre** "Algo para recordar".
- **Reabrible 24h** desde `endedAt` (cf. D-16). Después se cierra para no contaminar datos retroactivamente.
- **Tasa de uso computable** vía `recapCompletionRate(sessions, notes, windowSize)` — habilita el smart reminder futuro de ROADMAP §4.17.
- **Discovery progresivo**: aparece como prompt opt-in tras 3 sesiones completadas. El usuario decide activar / más tarde / no mostrar más.
- Las notas se guardan con `source: "recap"` para distinguir de las capturadas durante el set.

#### Preflight — Factor X pre-sesión (ROADMAP §4.14)

- Pantalla nueva en `app/workout/preflight.tsx` con 3 bloques:
  1. **Sueño anoche** — 3 chips (mal / OK / bien).
  2. **Energía hoy** — 3 chips (baja / media / alta).
  3. **Algo distinto?** — multi-select de chips contextuales (ayuno, post-cardio, stress, viaje, enfermedad, vuelta de descanso, cafeína).
- **Persistencia transaccional** con `startWorkout()` (cf. D-18): si el usuario cancela el inicio de sesión, las respuestas se descartan.
- **Discovery progresivo**: aparece como prompt opt-in tras 5 sesiones completadas.
- Las notas se guardan con `source: "preflight"` y `category: "energy"`.

#### Discovery System — Descubrimiento progresivo de features

- **Catálogo central** en `constants/featureCatalog.ts` con definiciones declarativas: trigger, surface (modal vs banner), `requiresEntitlement` opcional para premium futuro.
- **Servicio centralizado** en `services/featureDiscovery.ts`:
  - `getEligibleDiscoveries(profile, sessions, notes)` — devuelve features cuyo trigger se cumple y no fueron decididas.
  - `isFeatureActive(profile, featureId)` — chequeo rápido para routing.
  - Mutators puros: `withDiscoveryStatus`, `snoozeDiscovery`, `resetAllDiscoveries`.
- **Componente `FeatureDiscoveryPrompt`** — bottom sheet reusable con 3 CTAs: "Más tarde", "Activar", "No mostrar más".
- **Estados**: `unseen` → `shown` → `activated` / `dismissed` / `snoozed` (con `snoozeUntil` para reintentar después).
- **Premium gating sembrado** vía `services/entitlements.ts`. En v1, `hasEntitlement()` siempre devuelve `true`; cuando llegue IAP, marcar `requiresEntitlement: "pro"` en el catálogo es suficiente para activar el gate. Listo para RevenueCat.

#### SetRow — Refactor visual

- **Distinción clara** entre estados:
  - **Completed**: bg `surfaceAlt` (gris atenuado), check verde lima.
  - **Active** (próximo a hacer): bg transparente, **border `colors.ink` 1.5px** — visible y contrastado.
  - **Planned** (futuro con valores prefijados): bg transparente, border `accentEdge` 1px sutil.
  - **PR**: wrapper accentSoft + border accentEdge.
- **Props nuevas**: `hasNotes`, `onNotePress`, `onCheckLongPress`.
- **Fix de PR detection** (causa raíz documentada): `getMaxWeightForExercise` ahora acepta `excludeSessionId`. En `active.tsx` se pasa `session.id` para que el max sea histórico real, no contamine con la sesión en curso. La condición pasó de `>=` a `>` — igualar el max no es PR.

### Cambios al modelo de datos

- **`PersistedState.schemaVersion: number`** — versionado explícito (versión actual: `2`).
- **`migrate(state, fromVersion)`** — función de migración encadenada. v1 → v2 agrega `notes: []` si falta.
- **`PersistedState.notes: SessionNote[]`** — nuevo array.
- **`UserProfile.featureDiscoveries?: FeatureDiscoveryState[]`** — nuevo campo para tracking de discovery.
- **Nuevos mutators en `IronLogContext`**:
  - `addNote`, `updateNote`, `deleteNote`, `resolveNote`, `unresolveNote`, `clearAllNotes`.
  - `getNoteById`, `getNotesForSession`, `getNotesForSet`, `getNotesForExercise`.
  - `setDiscoveryStatus`, `snoozeDiscovery`, `resetAllDiscoveries`.

### Settings y privacy

- **Nueva sección "Notas y reflexión"** en `app/settings.tsx`:
  - Toggle "Recap al cerrar sesión" (lee/escribe `featureDiscoveries[recap].status`).
  - Toggle "Preflight al iniciar".
  - Botón "Resetear descubrimientos" — vuelve todos los `status` a `unseen` para volver a ofrecer.
  - Botón "Borrar todas las notas" con confirmación + count actual.
- **Componente reutilizable `FeatureToggleRow`** con switch animado.

### Decisiones documentadas (D-1 a D-20)

20 decisiones formales documentadas en `notes-system.md` §3, cada una con razón, alternativas descartadas y trade-offs:

- **D-1**: Notas como entidad propia (no campo de `CompletedSet`).
- **D-2**: `bodyPart` enum cerrado (~17 valores), no texto libre.
- **D-3**: `severity` 1–10 stored, bucketeada en UI.
- **D-4**: `exerciseId` denormalizado en notas con `setId`.
- **D-5**: `resolved` flag por nota, no por zona.
- **D-6**: `source` distingue cómo se capturó la nota.
- **D-7**: Notas en `PersistedState.notes` (mismo blob de AsyncStorage por ahora).
- **D-8**: Recap y Preflight skipeables siempre.
- **D-9**: Chips frecuentes evolutivos sobre defaults curados.
- **D-10**: Quick-add via long-press en el check del set.
- **D-11**: Discovery progresivo por threshold (no upfront).
- **D-12**: Premium gating preparado, inactivo en v1.
- **D-13**: `BodyPart` enum mínimo (17 zonas), expandible additive.
- **D-14**: Body map = silueta SVG abstracta unisex frontal+posterior.
- **D-15**: Chip evolutivo: 3 usos en últimas 20 sesiones.
- **D-16**: Recap reabrible 24h desde `endedAt`.
- **D-17**: `recapCompletionRate` computable on-demand (sin estado extra).
- **D-18**: Notas preflight transaccionales con `startWorkout()`.
- **D-19**: `severity` numérica universal, UI traduce por categoría.
- **D-20**: `UserContext` (cut/bulk/lesión) deferido a ROADMAP §5.15 atado al AI Coach.

### Feature fixes encontrados durante validación (FX-1 a FX-4)

Documentados en `feature-fixes.md`:

- **FX-1** (info): `CategoryChips` no reusa `<Chip>` base — desviación intencional porque el base no soporta ícono.
- **FX-2** (bug): tap en `edit-2` con set que ya tiene notas no mostraba existentes. Resuelto con modo `list` en `NoteSheet` con cards tappables + "Agregar otra nota".
- **FX-3** (info): highlights del summary ahora agrupa por categoría con headers + count, en orden canónico.
- **FX-4** (info): discovery branching en `summary` y `home` ahora usa el helper centralizado `getEligibleDiscoveries()` en lugar de duplicar la lógica de thresholds.

### Documentación nueva

#### En `artifacts/ironlog/`

- **`notes-system.md`** (~1300 líneas) — fuente de verdad del diseño. 16 secciones + 20 decisiones (D-1 a D-20) + 9 preguntas resueltas (Q-1 a Q-10) + 11 steps tildados de implementación + tracker de progreso completo.
- **`deuda-tecnica.md`** — 12 entradas de decisiones tomadas en auto-piloto durante implementación, con severidad, archivos afectados, recomendaciones.
- **`feature-fixes.md`** — 4 fixes encontrados durante validación, cada uno con causa, resolución, archivos.
- **`feature-discovery.md`** — catálogo central del sistema de discovery progresivo: tipos, helpers, surfaces, premium hints, anti-patterns.
- **`future-onboardings.md`** — backlog v2 polish para reemplazar prompts simples con onboardings ricos animados (O-1 a O-4).

#### En la raíz del repo

- **`db_system.md`** (24 secciones, ~750 líneas) — combina contenido de `db.md` (estado actual del storage) + `backend.md` (plan local-first DB) + **evaluación detallada de Turso (libSQL) como opción de sync** con free tier, trade-offs y comparativa contra PowerSync/ElectricSQL.
- **`state_mang_system.md`** (12 secciones, ~430 líneas) — plan separado para Zustand UI state. Independiente del plan de DB. Incluye criterios para clasificar state (efímero vs persistente), patrones de uso, plan de migración Fase 4, ADR-004.
- **Eliminados**: `db.md` y `backend.md` (su contenido se redistribuyó entre los dos nuevos).

### Cambios al ROADMAP

- **§4.3** — sistema de notas estructuradas (foundation, ahora implementado).
- **§4.13** — recap reflexivo (implementado).
- **§4.14** — preflight Factor X (implementado).
- **§4.15** — voice notes (foundation lista, implementación pendiente).
- **§4.16** — health timeline / body map (foundation lista, pendiente).
- **§4.17 (nuevo)** — smart reminder de recap a las 2h post-workout para usuarios recurrentes (≥60% completion rate). Documentado completo, sin implementar.
- **§5.15 (nuevo)** — períodos de usuario (cut, bulk, injury_recovery, etc.) atado al AI Coach 5.13.

### Componentes nuevos

`components/notes/` — 9 componentes:

- `BodyMapMini.tsx` — silueta SVG con 17 zonas tappables, frontal/posterior tabbeable, severity-based fill.
- `BodyPartChips.tsx` — chips de zonas corporales con top 6 + "ver todas" (17 total).
- `CategoryChips.tsx` — chips de categorías con ícono Feather + label.
- `FactorXChips.tsx` — exporta `PillGroup`, `MultiSelectChips` y catálogos `SLEEP_OPTIONS` / `ENERGY_OPTIONS` / `FACTOR_OPTIONS` con sus mappings de texto y severity.
- `FeatureDiscoveryPrompt.tsx` — bottom sheet de discovery (modal v1; reemplazable por onboarding rico v2).
- `MoodSelector.tsx` — 5 emojis con animación.
- `NoteCard.tsx` — display de una nota con ícono por categoría, label de body part, severity bucketeada, fecha relativa.
- `NoteSheet.tsx` — sheet completo con 3 modos (list / edit / create), backdrop dismiss, InputAccessoryView keyboard-close, integración con discovery.
- `QuickNoteMenu.tsx` — popover de chips top frecuentes para captura en 2 acciones.
- `SeveritySlider.tsx` — slider 1–10 con bucketing visual (color cambia según rango).

### Servicios nuevos

`services/`:

- `entitlements.ts` — stub premium gating. `hasEntitlement(profile, name)` siempre `true` en v1. Listo para conectar a RevenueCat.
- `featureDiscovery.ts` — helpers de discovery progresivo. Funciones puras: `getEligibleDiscoveries`, `nextDiscovery`, `isFeatureActive`, `withDiscoveryStatus`, `snoozeDiscovery`, `resetAllDiscoveries`.

### Constantes nuevas

`constants/`:

- `bodyParts.ts` — labels (largo/corto), top 6, mapping a vista frontal/posterior.
- `featureCatalog.ts` — catálogo central de features descubribles.
- `noteChips.ts` — defaults por categoría + labels + íconos Feather.

### Utils nuevos

`utils/notes.ts` — helpers puros:

- `severityBucket3<L>` (genérico) + `painBucket`, `effortBucket`, `energyBucket`.
- `MOOD_EMOJIS`, `MOOD_VALUES`, `moodEmoji`.
- `severityToLabel(category, severity)` — mapping universal.
- `notesForSession`, `notesForSet`, `notesForExercise`.
- `activePainNotes`, `notesByBodyPart`.
- `recapCompletionRate(sessions, notes, windowSize=10)`.
- `canStillRecap(session, notes, now)` — ventana 24h de D-16.
- `frequentChips(notes, sessions, category, options)` — algoritmo de chips evolutivos.
- `inferCategoryFromText(text)` — clasificador liviano para 4.15.

### Forward compat (4.15 + 4.16) — sembrado, no implementado

#### 4.15 (voice notes)

- ✅ `NoteSource = "chip" | "text" | "voice" | "recap" | "preflight"`.
- ✅ `SessionNote.audioUri?: string`.
- ✅ `inferCategoryFromText(text)` para clasificar transcripts automáticos.
- ✅ `NoteCard` renderiza notas de voz sin error.

#### 4.16 (health timeline / body map full)

- ✅ Enum `BodyPart` cerrado de 17 zonas → mappea 1:1 a SVG.
- ✅ `severity` numérica para colorear intensidad.
- ✅ `resolved` flag + `resolvedAt` para timeline temporal.
- ✅ `activePainNotes()`, `notesByBodyPart()` listos.
- ✅ Componente `BodyMapMini` reusable (`mode: "select" | "view"` props).

### Limitaciones conocidas (registradas en `deuda-tecnica.md`)

12 entradas registradas. Las que vale repasar:

- **DT-1** (revisar): body map SVG hecho a mano — minimalista, funcional, mejorable cuando haya tiempo de asset profesional.
- **DT-2** (revisar): QuickNoteMenu posicionado como modal abajo, no popover real sobre el botón origen. Refactorable con `ref.measure()` si se siente desconectado en uso real.
- **DT-7** (revisar): banner "Agregar reflexión" en detalle de sesión histórica no implementado por falta de pantalla de detalle persistido. Helper `canStillRecap()` listo cuando se cree esa screen.
- **DT-11** (revisar): migración blob v1 → v2 testeada solo en código, no con blob real. Validar al primer launch en device con datos previos.

### Conocidas decisiones de arquitectura (ADRs sembrados)

- **ADR-001**: SQLite + Drizzle como storage local (vs MMKV vs WatermelonDB). Documentado en `db_system.md`.
- **ADR-002**: Op-log con LWW como sync inicial (vs CRDT) — o saltarse a Turso Embedded Replicas.
- **ADR-003**: UUID v7 generado en cliente como primary key.
- **ADR-004**: Zustand para UI efímera. Documentado en `state_mang_system.md` §11.
- **ADR-005**: Auth con código de recuperación anónimo en V1.
- **ADR-006** (nuevo): Turso (libSQL) vs Vercel Postgres como DB del backend — comparativa con free tier, lock-in, latencia.

### Limitaciones conocidas (siguen vigentes desde v1.1.0)

- Datos solo locales (sin sync ni backup).
- Re-render global del Context — mitigado por la nueva separación entre state efímero y persistente, pero el plan de SQLite (cf. `db_system.md`) lo resuelve definitivamente.
- Sin tests automatizados.
- Sin CI/CD configurado.
- No publicada en App Store ni Play Store.

### Próximos pasos sugeridos

1. **Validación manual en iOS device** — los 10 checkboxes de `notes-system.md` §14.2 (test transversal). Migración v1 → v2 con blob real.
2. **Implementar 4.15 (voice notes)** — el schema ya está listo. Sumar `expo-speech-recognition`, FAB en active, permisos de mic.
3. **Implementar 4.16 (health timeline screen)** — extender `BodyMapMini` a vista full, agregar timeline + filtros + export PDF.
4. **Migrar a SQLite + Drizzle** (cf. `db_system.md` §18) — reemplaza el blob de AsyncStorage. Prioridad alta cuando empiece a haber > 200 sesiones.
5. **Migrar UI state a Zustand** (cf. `state_mang_system.md` §8) — Fase 4 del plan general. Independiente.
6. **Lanzar a Play Store** — cf. `release-android.md` (de v1.1.0). Lanzar v1 sin running primero para evitar form de permisos sensibles.

### Compatibilidad

- iOS 15.1+ (req mínimo de Expo SDK 54).
- Android 7.0+ (Nougat) / API level 24+.
- Node.js 24 + pnpm 10.12.1 para desarrollo.

### Stats

- **37 archivos modificados** desde v1.1.0.
- **+7324 líneas / −526 líneas**.
- **9 componentes nuevos** en `components/notes/`.
- **2 servicios nuevos** en `services/`.
- **3 constantes nuevas** en `constants/`.
- **1 archivo de utilities** nuevo (`utils/notes.ts`, ~210 LOC).
- **2 pantallas nuevas** (`app/workout/recap.tsx`, `app/workout/preflight.tsx`).
- **5 docs nuevos** en `artifacts/ironlog/` + 2 docs en raíz reemplazando 2 antiguos.
- **20 decisiones formales** + **9 preguntas de diseño resueltas** + **4 feature-fixes** + **12 entradas de deuda técnica**.

### Contribuyentes

- Juan Frank (`@JuaniFrank`).
- Asistencia con Claude Code para diseño, refactors, validación y documentación.

<!-- RELEASE_NOTES_END -->

---

## Notas internas (no van en el release)

- HEAD del tag: `03cbd8b` (Merge PR #2 from feat/notes-prework-recap a main).
- Predecesor: `v1.1.0` apuntando a `37060f6`.
- Convención semver: minor bump (1.1 → 1.2) porque suma features sin breaking changes.
- Próximo bump natural: `v1.3.0` cuando se sume voice notes (4.15) o health timeline (4.16).
- Si se hace migración a SQLite, considerar bump major (`v2.0.0`) por el cambio fundamental de storage.
