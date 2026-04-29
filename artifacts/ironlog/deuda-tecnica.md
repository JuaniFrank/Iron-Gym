# IronLog — Deuda técnica del sprint de Notes

> Bitácora de decisiones que tomé en auto-piloto durante la implementación
> de las features de `notes-system.md` (4.3 + 4.13 + 4.14 + discovery system).
>
> Cada entrada incluye: contexto, decisión que tomé, alternativas, archivos
> afectados. Para revisión + posibles cambios después.

---

## Convenciones

- **DT-N · título**: deuda técnica registrada con ID secuencial.
- **Severidad**: `info` (FYI no urgente) · `revisar` (vale ojo del user) · `bloqueante` (no completé algo y tengo que volver).
- **Archivos**: ruta(s) relevantes para que se haga rápido revisarlo o cambiarlo.

---

## Resumen del sprint

✅ **11 de 12 tareas completas** sin pendientes bloqueantes. Todo el typecheck pasa.

Steps completados de `notes-system.md` §11:
- Step 0 — schema versioning (v1 → v2 con migrate())
- Step 1 — tipos, utils, context plumbing, entitlements stub
- Step 2 — componentes base (CategoryChips, BodyPartChips, SeveritySlider, NoteCard, MoodSelector, BodyMapMini, FactorXChips, QuickNoteMenu)
- Step 3 — NoteSheet integrado a active.tsx
- Step 4 — Quick-add via long-press en check del set
- Step 5 — Display en summary y exercise-detail
- Step 6 — Recap post-workout
- Step 7 — Preflight Factor X
- Step 8 — Chips evolutivos
- Step 9 — Forward-compat verification (smoke test mental + grep)
- Step 10 — Settings y privacy
- Discovery system (D-11) — FeatureDiscoveryPrompt + integración en summary y home

---

## Entradas

### DT-1 · Body map: silueta SVG abstracta hecha a mano

- **Severidad**: `revisar` (visual review).
- **Contexto**: D-14 pidió silueta SVG abstracta. No existía asset, así que escribí los paths a mano.
- **Decisión**: 17 zonas como `<Circle>` / `<Rect>` / `<Ellipse>` simples sobre un viewBox 100×220. Cabeza + brazos + piernas decorativos como `<Path>` sin interactividad.
- **Resultado**: funciona y es tappable, pero estéticamente es muy minimalista — más "wireframe" que "diseño final". Se ve respetuoso pero no especialmente lindo.
- **Recomendación**: cuando llegue tiempo, contratar/pedir un SVG anatómico tipo Strong/Hevy y reemplazar `BodyMapMini.tsx` manteniendo la misma API. La feature funciona desde ya.
- **Archivos**: `components/notes/BodyMapMini.tsx`.

### DT-2 · QuickNoteMenu: posición no está sobre el botón origen

- **Severidad**: `revisar`.
- **Contexto**: D-10 dice "menú radial sobre el botón check". Implementé como modal centrado abajo en lugar de popover real sobre el origen.
- **Razón**: para posicionar realmente sobre el botón origen necesito medir refs (View.measure) en el SetRow y pasar coordenadas globales al menú. Eso requiere refactor más invasivo de SetRow.
- **Resultado actual**: el menú aparece como modal pequeño en el bottom-right de la pantalla con backdrop translúcido. Funciona pero no es exactamente el "menú radial sobre el botón".
- **Recomendación**: si la UX se siente desconectada del botón en device real, refactorizar para usar `ref.measure()` y posicionar absoluto. Es trabajo de ~30 min cuando se evalúe en sim.
- **Archivos**: `components/notes/QuickNoteMenu.tsx`, `components/workout/SetRow.tsx`, `app/workout/active.tsx`.

### DT-3 · SeveritySlider: no soporta drag continuo en Web

- **Severidad**: `info`.
- **Contexto**: implementé el slider con `Pressable` + `onResponderMove`. Funciona en iOS/Android. En web puede no responder al drag.
- **Razón**: la app es mobile-first; web es secundario. Usar una lib externa para slider (ej. `@react-native-community/slider`) era introducir dep.
- **Recomendación**: si web pasa a ser primary, considerar lib externa. Por ahora suficiente.
- **Archivos**: `components/notes/SeveritySlider.tsx`.

### DT-4 · Bypass de typed routes con `as never`

- **Severidad**: `info`.
- **Contexto**: expo-router tiene typed routes y a veces no detecta archivos nuevos hasta correr metro. Para `/workout/recap` y `/workout/preflight` tuve que usar `as never` para que typecheck pase.
- **Decisión**: seguir el mismo patrón que ya existe en el repo (`router.push("..." as never)`) en vez de regenerar tipos.
- **Recomendación**: en algún momento correr `pnpm exec expo-router typegen` o reload de Metro con cache clean para que las nuevas rutas queden tipadas. No bloquea nada.
- **Archivos**: `app/workout/summary.tsx` (2 sitios), `app/(tabs)/index.tsx` (1 sitio).

### DT-5 · NoteSheet: validación de "guardar" un poco laxa

- **Severidad**: `info`.
- **Contexto**: el botón Guardar se habilita siempre que haya `category` seleccionada. Permite guardar notas con texto vacío + sin severity + sin bodyPart si es categoría que no las requiere (ej. "technique" sin chip).
- **Decisión**: dejar laxo — el usuario puede preferir guardar "agarre cambiado" como chip puro sin texto adicional. Las notas vacías de utilidad las puede borrar.
- **Recomendación**: monitorear en uso real. Si aparecen muchas notas vacías ruidosas, agregar validación más estricta (al menos uno de: text non-empty, chip seleccionado, severity).
- **Archivos**: `components/notes/NoteSheet.tsx` (función `handleSave`).

### DT-6 · Recap reabrir: detección heurística "isReopened"

- **Severidad**: `info`.
- **Contexto**: el header del recap dice "Reflexioná sobre tu sesión" si la sesión terminó hace > 30 segundos, "¿Cómo te fue hoy?" si es post-workout inmediato.
- **Decisión**: 30s como threshold para evitar que el flow normal (summary → recap) muestre el copy "reopened".
- **Recomendación**: si parece corto, subir a 5 min. Es solo cosmético.
- **Archivos**: `app/workout/recap.tsx` (línea con `isReopened`).

### DT-7 · Banner "Agregar reflexión" en detalle de sesión NO implementado

- **Severidad**: `revisar`.
- **Contexto**: D-16 menciona un banner "Agregar reflexión" en el detalle de la sesión (`app/workout/[id].tsx` o equivalente). En el sprint NO implementé esto porque no encontré una pantalla de "detalle de sesión histórica" en el repo (la app actual va summary → home, sin un detalle persistido independiente).
- **Lo que sí hay**: si el usuario llega a `/workout/recap?sessionId=X` con una sesión pasada, el screen verifica `canStillRecap()` y permite agregar (o muestra "ventana cerrada"). El acceso a esa URL hoy es solo programático — no hay UI que lleve ahí desde el detalle de sesión.
- **Recomendación**: cuando exista una pantalla de detalle de sesión histórica (no veo una actualmente), agregar el banner CTA "Agregar reflexión" usando el helper `canStillRecap(session, notes)` ya disponible en `utils/notes.ts`.
- **Archivos**: `utils/notes.ts:canStillRecap` (helper listo), `app/workout/recap.tsx` (consume URL param).

### DT-8 · Discovery prompt en summary: lógica un poco entrelazada

- **Severidad**: `revisar` (UX flow).
- **Contexto**: el botón "Listo" del summary tiene 3 estados según el discovery state del recap: "Reflexionar" (activated), "Continuar" (offered+pending), "Volver al inicio" (skipped/dismissed). El primer click de "Continuar" abre el prompt; el de "Reflexionar" va directo al recap; el de "Volver al inicio" cierra todo.
- **Razón**: quería un solo botón en el footer, no dos columnas (recap + close). Esto mantiene el UX consistente con el resto del summary.
- **Recomendación**: probar en sim. Si la doble lógica del botón confunde, separar en dos botones explícitos ("Reflexionar" / "Listo").
- **Archivos**: `app/workout/summary.tsx` (Button del bottom).

### DT-9 · Preflight skip: arranca sesión igual

- **Severidad**: `info`.
- **Contexto**: cuando el user toca "Saltar" en el preflight, el comportamiento actual es: arrancar la sesión sin notas y navegar a `/workout/active`. NO se cancela el flow.
- **Razón**: el user tocó "Empezar entreno" desde home con la intención de entrenar — saltar el preflight no debería abortar esa intención.
- **Recomendación**: confirmar que es el comportamiento esperado. Si querés que "Saltar" simplemente vuelva a home sin entrenar, cambiar `handleSkip()` en `app/workout/preflight.tsx`.
- **Archivos**: `app/workout/preflight.tsx:handleSkip`.

### DT-10 · `chest`/`abs` están en frontal pero no posterior; `upper_back`/`lower_back` solo posterior

- **Severidad**: `info`.
- **Contexto**: la silueta del body map muestra `chest`+`abs` en vista frontal, y `upper_back`+`lower_back` en posterior. No hay overlap. Esto es geométricamente correcto.
- **Edge case**: el helper `activePainNotes()` y queries por bodyPart no distinguen vista — devuelven todas las notas de la zona. Si el usuario abre el recap y la zona afectada está en la vista que NO está visible, no la ve seleccionada (pero la nota está guardada).
- **Recomendación**: si en uso real el feedback es "no veo la nota seleccionada", agregar lógica que cuando se abre el recap con notas previas en bodyPart, abra automáticamente la vista correspondiente.
- **Archivos**: `components/notes/BodyMapMini.tsx`.

### DT-11 · Migration v1 → v2 testeada solo en código, no con blob real

- **Severidad**: `revisar`.
- **Contexto**: agregué `migrate()` en `IronLogContext` que detecta `schemaVersion < 2` y agrega `notes: []`. Funciona en código pero no validé con un blob viejo real.
- **Recomendación**: cuando arranques la app por primera vez en sim con datos previos, verificar que no rompe. Si lo hace, debugear `migrate()` viendo qué llega en `parsed`. Caso típico: blob viejo no tiene `schemaVersion` → cae en branch `fromVersion = 1` → se agrega `notes: []`. Debería ser seguro.
- **Cómo probar**: instalar app con código viejo (sin schemaVersion), entrenar 2 sesiones, después instalar este código y verificar que las sesiones siguen ahí.
- **Archivos**: `contexts/IronLogContext.tsx:migrate`.

### DT-12 · Discovery se gatilla desde 0 sesiones si user importa data

- **Severidad**: `info`.
- **Contexto**: el trigger `sessions_completed >= 3` para recap usa el conteo total de sesiones del state. Si un usuario importa backup con 50 sesiones, el discovery se gatilla inmediatamente al abrir summary de la primera sesión nueva.
- **Razón**: esto es coherente — el user con historial demuestra hábito y debería ver el feature.
- **Recomendación**: si en algún momento implementás import/restore, considerar resetear o ajustar el discovery state. No es bloqueante.
- **Archivos**: `services/featureDiscovery.ts:triggerMet`.

---

## Cosas que NO están implementadas (de notes-system.md)

Las marco para que las tengas presente:

1. **`audio_notes/` directory creation**. Cuando se implemente 4.15, el path donde guardar audios (`FileSystem.documentDirectory + "audio_notes/"`) hay que crearlo en el primer launch. Hoy no existe.
2. **Action button del iPhone 15 Pro+** (atajo a voice note) — anotado en notes-system.md §11 step "voice notes" como out of scope v1.
3. **Body map full screen (4.16)** — es feature aparte, no tocada.
4. **Smart reminder de 2h post-workout (ROADMAP §4.17)** — feature futura, infra base ya existe (`recapCompletionRate`).

---

## Validaciones manuales pendientes

Estas vale hacerlas en sim antes de considerar el sprint cerrado:

- [ ] Iniciar nueva sesión, completar 1 set, tap edit-2 → NoteSheet abre.
- [ ] En NoteSheet: seleccionar pain → aparecen body parts → severity slider responde al drag.
- [ ] Long-press en check del set 1 → QuickNoteMenu aparece con chips de "effort".
- [ ] Tap chip "fácil" → nota guardada, badge "•" aparece en check.
- [ ] Terminar 3 sesiones (para gatillar trigger). En la 3ra, summary debe ofrecer recap discovery.
- [ ] Activar recap → navega a `/workout/recap`. Mood selector funciona. Body map: tap en hombro derecho → severity slider aparece debajo.
- [ ] Después de la 5ta sesión, home → "Empezar entreno" → debe ofrecer preflight discovery.
- [ ] Activar preflight → navega a `/workout/preflight`. Selección de sleep/energy/factors funciona. "Empezar entreno" arranca sesión + agrega notas.
- [ ] Settings → "Notas y reflexión": toggles activan/desactivan recap y preflight. "Resetear descubrimientos" funciona.
- [ ] Settings → "Borrar todas las notas": muestra count correcto, borra.

---

## Estado del typecheck

Final: `pnpm exec tsc -p tsconfig.json --noEmit` exit 0. Todo verde.
