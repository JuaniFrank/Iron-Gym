# IronLog — Sistema de Notas (diseño + plan de implementación)

> Doc de trabajo para diseñar e implementar las features **4.3 (Sistema de
> notas estructuradas)**, **4.13 (Recap reflexivo post-workout)** y
> **4.14 (Pre-workout Factor X)** del `ROADMAP.md`, dejando armada toda la
> base para integrar después **4.15 (Voice notes)** y **4.16 (Health timeline
> / body map)** sin romper schema ni rehacer componentes.
>
> Este archivo es la **fuente de verdad** del diseño. Cualquier decisión que
> se tome durante la implementación se registra acá. Si retomamos en otra
> sesión, leyendo este doc se puede continuar sin contexto previo.

---

## Índice

1. [Propósito y cómo usar este doc](#1-propósito-y-cómo-usar-este-doc)
2. [Resumen de features cubiertas](#2-resumen-de-features-cubiertas)
3. [Decisiones resueltas](#3-decisiones-resueltas)
4. [Decisiones abiertas](#4-decisiones-abiertas)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Almacenamiento y migración a SQLite](#6-almacenamiento-y-migración-a-sqlite)
7. [Forward compatibility con 4.15 y 4.16](#7-forward-compatibility-con-415-y-416)
8. [Inventario de componentes](#8-inventario-de-componentes)
9. [Inventario de pantallas y rutas](#9-inventario-de-pantallas-y-rutas)
10. [Flujos UX detallados](#10-flujos-ux-detallados)
11. [Plan de implementación step-by-step](#11-plan-de-implementación-step-by-step)
12. [Edge cases a manejar](#12-edge-cases-a-manejar)
13. [Anti-patterns a evitar](#13-anti-patterns-a-evitar)
14. [Testing strategy](#14-testing-strategy)
15. [Tracker de progreso](#15-tracker-de-progreso)
16. [Glosario](#16-glosario)

---

## 1. Propósito y cómo usar este doc

### Qué es

Un **design doc vivo** que cubre todo el sistema de notas: tipos, almacenamiento, UI, edge cases, plan de implementación. Está pensado para que:

- Cualquiera (vos, otro dev, una sesión nueva de Claude) pueda retomar el trabajo sin contexto previo.
- Las decisiones de diseño queden documentadas con su justificación.
- El plan de implementación tenga checkboxes accionables.
- Las preguntas abiertas tengan un lugar definido para resolverse.

### Qué NO es

- No es un substituto del `ROADMAP.md`. El ROADMAP define **qué** features existen y **por qué**. Este doc define **cómo** se construyen las relacionadas a notas.
- No es documentación final del código. Cuando los componentes existan, el código + sus comentarios son la verdad operativa. Este doc puede quedar desactualizado y eso está bien — su rol termina cuando la feature está shipped.

### Convenciones del doc

- `[ ]` pendiente · `[~]` en progreso · `[x]` listo (igual que ROADMAP).
- **DECISIÓN:** decisión resuelta con razón.
- **PREGUNTA:** decisión abierta esperando input.
- **NOTA:** observación importante que no es decisión.
- **TODO:** acción pendiente fuera del flujo principal.

---

## 2. Resumen de features cubiertas

Tres features que se implementan **juntas** porque comparten la fundación de datos:

| Feature                                | ROADMAP | Esfuerzo | Rol en el sistema                                                |
| -------------------------------------- | ------- | -------- | ---------------------------------------------------------------- |
| **4.3 Sistema de notas estructuradas** | §4.3    | M        | Fundación — define tipos, contexto, UI base de captura.          |
| **4.13 Recap reflexivo post-workout**  | §4.13   | S        | Productor de notas estructuradas via UI guiada al cerrar sesión. |
| **4.14 Pre-workout Factor X**          | §4.14   | S        | Productor de notas de contexto pre-sesión.                       |

Y dos features que **se construirán encima** de esta misma fundación más adelante. Toda decisión de diseño tomada acá tiene que dejarlas habilitadas:

| Feature                             | ROADMAP | Lo que requiere de esta fundación                                           |
| ----------------------------------- | ------- | --------------------------------------------------------------------------- |
| **4.15 Voice notes hands-free**     | §4.15   | `source: "voice"` + `audioUri` ya en el schema. UI específica de grabación. |
| **4.16 Health timeline / body map** | §4.16   | Queries por `bodyPart`, `severity`, `resolved`. Body map SVG.               |

---

## 3. Decisiones resueltas

Decisiones de diseño que ya tomamos. Cada una con su razón. Si revertimos alguna, actualizar acá explicando por qué.

### D-1 · Notas son entidad propia, no campos sueltos en `CompletedSet`

**DECISIÓN**: crear `SessionNote` como tipo top-level con `id` propio y referencias opcionales a `sessionId` / `setId` / `exerciseId`.

**Razón**: una nota puede aplicar a un set específico, a un ejercicio entero, o a la sesión completa. Si fuera campo del set, no podríamos representar "hoy me sentí cansado" sin elegir un set arbitrario. Y la migración a SQLite se vuelve trivial — una tabla, foreign keys.

**Alternativa descartada**: `CompletedSet.note?: string` (era la propuesta original del ROADMAP §4.3). Es más simple pero limita el modelo y no soporta 4.13/4.14/4.16.

### D-2 · `bodyPart` es enum cerrado, no texto libre

**DECISIÓN**: `BodyPart` es un union type acotado (~17 valores). Texto libre va en `text`.

**Razón**: el body map de 4.16 necesita campos discretos para mappear zonas SVG. Texto libre rompe la utilidad estructural. La IA puede razonar sobre ambos — el enum le da precisión, el texto le da matiz.

**Trade-off conocido**: el usuario no puede decir "dolor en el aductor" si `aductor` no está en el enum. Tiene que elegir `hip_left/right` y dejar el detalle en `text`. Aceptable por ahora — si emerge un patrón, agregamos al enum.

### D-3 · `severity` se guarda como número 1–10, se muestra bucketeado

**DECISIÓN**: campo `severity?: number` (1–10). En la UI mostrar 3 niveles ("leve / molesta / fuerte") mapeados como 1–3 / 4–6 / 7–10.

**Razón**: la IA y los gráficos quieren resolución alta (números). El usuario no quiere pensar "esto es 6 o 7?". Bucketear en UI da lo mejor de los dos mundos sin cambiar schema después.

**Implementación**: helper `severityBucket(n: number): "leve" | "molesta" | "fuerte"` en `utils/notes.ts`.

### D-4 · `exerciseId` se denormaliza

**DECISIÓN**: si una nota tiene `setId`, también guardamos `exerciseId` (derivado del set). No depender de joins.

**Razón**: queries como "todas las notas de press banca" son las más comunes. Sin denormalizar, requieren join `notes → sets → exerciseId`. Con denormalizar, es un filtro directo.

**Riesgo**: inconsistencia (set y exerciseId desincronizados). Mitigado: la denormalización solo ocurre al crear, vía función helper. Set y exerciseId nunca se editan independientemente.

### D-5 · `resolved` es flag por nota, no por zona

**DECISIÓN**: cada `SessionNote` tiene su propio `resolved?: boolean`. No agregamos un estado global "el hombro está resuelto".

**Razón**: distintas notas en la misma zona pueden ser molestias distintas (ej. "tendinitis hombro" vs "rigidez post-press"). Marcar la zona entera resolvería ambas erróneamente. Por nota es más granular.

**UX en 4.16**: el botón "Marcar todas como resueltas" en el body map sheet itera sobre todas las notas activas de esa zona y las cierra individualmente. Cosmético al usuario, granular en datos.

### D-6 · `source` distingue cómo se capturó la nota

**DECISIÓN**: `source: "chip" | "text" | "voice" | "recap" | "preflight"`.

**Razón**: útil para analytics ("el 70% de las notas vienen del recap") y para filtrar en UI ("mostrarme solo lo que dije a mano"). Adelanta 4.15 al incluir `voice` desde ahora.

### D-7 · Notas se guardan en `PersistedState.notes: SessionNote[]` (hoy)

**DECISIÓN**: array nuevo en el blob existente de AsyncStorage. Sin separar en otra clave.

**Razón**: el hot path de la app sigue siendo el mismo blob. Separar en `ironlog:notes` agrega complejidad de hidratación sin beneficio en v1. Cuando migremos a SQLite (cf. `backend.md`), todas las entidades se separan a la vez.

**Costo**: el blob crece más rápido. Notas son chicas (~200 bytes cada una). 10 notas/sesión × 200 sesiones = 400 KB. Manejable.

### D-8 · Recap y Preflight son skipeables

**DECISIÓN**: ambas pantallas tienen botón "Saltar" prominente. No bloquean el flujo principal.

**Razón**: fricción obligatoria → usuarios desactivan el feature mentalmente y al final no lo usan. Mejor opt-in implícito por valor percibido. El tracker en settings muestra cuántas veces saltaste vs completaste — si saltás 5 seguidas, ofrece desactivar el feature.

### D-9 · Chips frecuentes empiezan con defaults curados, evolucionan con uso

**DECISIÓN**: cada categoría tiene 3–6 chips default hardcoded. A medida que el usuario crea notas con texto libre o repite chips no-default, los más usados graduán al top.

**Razón**: cold start sin chips es UX pobre. Sistema rígido sin evolución es UX limitado. La evolución la maneja un helper que cuenta usos en últimas N sesiones.

**Algoritmo**: top 6 por categoría = max(default chips, chips con uso ≥ 3 en últimas 20 sesiones). Default chips no caen del top hasta tener evidencia de no-uso (uso 0 en últimas 50 sesiones).

### D-10 · Quick-add via long-press en el check del set

**DECISIÓN**: además del botón `edit-2` que abre el sheet completo, **long-press en el botón "✓" del set** abre un menú radial con los 4 chips más frecuentes para ese ejercicio. Tap → nota guardada en 1 acción.

**Razón**: 80% de las notas son simples ("fácil", "duro", "rom completo"). Forzar el sheet completo es fricción innecesaria. Quick-add cubre el camino feliz; sheet cubre el detallado.

**Adelanta 4.15**: el sheet completo tiene un botón 🎙 que en 4.15 abre voice mode.

### D-11 · Descubrimiento progresivo de features (no upfront)

**DECISIÓN**: ningún feature opt-in (recap, preflight, voice notes, health timeline) se le ofrece al usuario en sus primeras interacciones. Cada uno tiene un **trigger de descubrimiento** — una condición que se cumple después de cierta evidencia de uso (N sesiones completadas, N notas creadas, primer pain registrado, etc.). Cuando el trigger se cumple por primera vez, aparece un prompt **"Descubrí <feature>"** con explicación + CTA de activación. El usuario decide: activar, "más tarde", o "no mostrar más".

**Razón**: tres ventajas combinadas.

1. **No abruma al onboarding inicial**. La primera sesión es para entrenar, no para configurar features secundarios. La carga cognitiva en el primer uso queda baja.
2. **El prompt aparece cuando el usuario ya invirtió** en la app. Adoption rate sube — el usuario que ya hizo 3 sesiones tiene contexto para valorar "30 segundos de recap me sirven".
3. **Se acopla naturalmente al gating premium futuro** (cf. D-12). Cada prompt puede mutar a "Disponible en Pro" sin cambiar el flujo.

**Razón (la opción D propuesta en Q-2)**: descartamos opción A (ON por default, fricción permanente), B (OFF en settings, nadie lo descubre) y C (ON + tracking saturación) por las razones de arriba. El descubrimiento por threshold es la síntesis.

**Modelo del trigger**:

```ts
type DiscoveryTrigger =
  | { kind: "sessions_completed"; count: number }
  | { kind: "notes_count"; count: number }
  | { kind: "pain_notes_count"; count: number }
  | { kind: "exercise_count"; count: number };

interface FeatureDiscovery {
  featureId: string; // "recap" | "preflight" | "voice_notes" | "body_map"
  trigger: DiscoveryTrigger;
  surface: "modal" | "banner"; // modal = interruptivo, banner = card pasiva en home
  requiresEntitlement?: string; // null/undefined = free; "pro" cuando aplique (cf. D-12)
}
```

**Surface**:

- **Modal**: para features de **alto valor** (recap, preflight). Aparece después de cerrar la pantalla relevante (post-summary para recap, post-home-tap para preflight). Bloquea atención hasta que el user decide.
- **Banner**: para features **secundarios** (voice notes, body map). Card pequeña en home, siempre dismissible, no bloquea.

**Estado guardado en `Profile`**:

```ts
interface FeatureDiscoveryState {
  featureId: string;
  status: "unseen" | "shown" | "activated" | "dismissed" | "snoozed";
  shownAt?: number;
  decidedAt?: number;
  /** Si "snoozed": cuándo volver a ofrecer. */
  snoozeUntil?: number;
}

interface UserProfile {
  // ... campos existentes
  featureDiscoveries?: FeatureDiscoveryState[];
}
```

**Triggers iniciales por feature** (revisable cuando tengamos data):

| Feature                     | Trigger                        | Surface                                            |
| --------------------------- | ------------------------------ | -------------------------------------------------- |
| Notes (4.3, captura básica) | Inmediato (es core, no opt-in) | —                                                  |
| Recap (4.13)                | Sesiones completadas ≥ 3       | modal                                              |
| Preflight (4.14)            | Sesiones completadas ≥ 5       | modal                                              |
| Voice notes (4.15)          | Notas creadas ≥ 10             | banner                                             |
| Health timeline (4.16)      | Pain notes ≥ 3                 | banner (con la data del propio user en el preview) |

**Implementación v1**:

- Helper centralizado `getEligibleDiscoveries(profile, sessions, notes)` que devuelve la lista de features cuyo trigger se cumple y `status === "unseen"`.
- Componente `FeatureDiscoveryPrompt` que renderiza modal o banner según `surface`.
- En home / post-summary / etc., consultar el helper en cada render relevante y mostrar el primero pendiente. **Nunca dos prompts a la vez**.
- Settings tiene un toggle por feature para activar/desactivar manualmente, y un botón "Resetear descubrimientos" para volver a ofrecerlos.

**Implementación futura (v2)**:

- El modal/banner se reemplaza por **onboarding rico** con animaciones (cf. `future-onboardings.md`). El swap es local al componente — el helper de eligibility sigue siendo el mismo.

**Catálogo central**: `feature-discovery.md` (nuevo) lista todos los triggers, copy, surfaces, y premium hints en un solo lugar.

### D-12 · Arquitectura de premium gating (preparada, inactiva en v1)

**DECISIÓN**: cada feature opt-in tiene un campo `requiresEntitlement?: string` en su definición de discovery (cf. D-11). En v1 todos los valores son `undefined` (todo free). La lógica del prompt verifica el entitlement antes de ofrecer activar — si el user no lo tiene, en lugar de "Activar" muestra "Disponible en Pro" + CTA al paywall.

**Razón**: el plumbing es trivial de armar ahora, costoso de retrofittear después. El día que agreguemos IAP (cf. conversaciones previas sobre RevenueCat) solo cambiamos los valores de `requiresEntitlement` en el catálogo de `feature-discovery.md`, y los gates ya funcionan en toda la app sin tocar UI.

**Lo que NO decidimos hoy**: cuáles features serán premium. Ninguna marcada como tal hasta que el modelo de monetización esté definido. Es decisión de producto, no técnica.

**Hooks a sembrar en v1**:

```ts
// services/entitlements.ts
export function hasEntitlement(profile: UserProfile, name: string): boolean {
  // v1: always true (everything free).
  // v2: consultar RevenueCat / cache local de entitlements.
  return true;
}

// En FeatureDiscoveryPrompt:
const required = discovery.requiresEntitlement;
if (required && !hasEntitlement(profile, required)) {
  return <PremiumLockedPrompt feature={discovery} />;
}
```

**Premium-locked prompt** (placeholder en v1, no se renderiza nunca porque `hasEntitlement` siempre devuelve `true`): muestra el feature + "Disponible en Pro" + CTA a paywall. Cuando llegue v2, esto vive y funciona sin más cambios.

### D-13 · `BodyPart` enum mínimo en v1, expandible después

**DECISIÓN**: enum cerrado de **17 zonas** para v1: `shoulder_left/right`, `elbow_left/right`, `wrist_left/right`, `neck`, `upper_back`, `lower_back`, `chest`, `abs`, `hip_left/right`, `knee_left/right`, `ankle_left/right`. Sin distinguir cuádriceps/isquios/aductores/dorsales/etc. — el detalle va en `text` libre.

**Razón**: la mayoría de las molestias se sienten en zonas grandes ("me duele la rodilla", "molesta el hombro"). Sub-zonas como "cuádriceps" o "tendón patelar" son ruido para el 80% de los users. Empezar grande deja: (a) SVG inicial simple, (b) NLP del campo `text` puede aprender qué sub-zonas emergen como patrón en datos reales, (c) expandir el enum es no-breaking.

**Trade-off conocido (cf. counter en Q-3)**: pierde alineación 1:1 con `MUSCLE_GROUP_LABELS` del sistema de volume tracking. Cuando llegue 4.16 y querramos cruzar "volumen en cuádriceps vs molestias en cuádriceps", vamos a tener que decidir cómo mappear `knee` → grupos musculares (heurística + texto libre). Aceptamos la deuda — si emerge patrón de "los users escriben mucho 'cuádriceps' en el text de notas con `bodyPart: knee_*`", expandimos el enum.

**Cómo expandir más adelante (cuando se justifique)**:

1. Agregar valores nuevos al enum (ej. `quad_left`, `quad_right`).
2. Migración de datos: opcional. Las notas viejas con `bodyPart: knee_left` no se reasignan automáticamente — el usuario las ve igual, y el body map también. Las nuevas pueden usar la zona específica si el usuario lo elige.
3. Cero changes a queries existentes — el enum es additive.

### D-14 · Body map renderizado como silueta SVG abstracta unisex

**DECISIÓN**: el body map (mini en 4.13, full en 4.16) se renderiza como **silueta SVG abstracta tipo emergency room**, vista frontal + posterior tabbeable. Sin anatomía detallada, sin músculos visibles. Solo contorno + zonas tappables que mappean al enum de D-13.

**Razón**: alineado con D-13 (enum mínimo de 17 zonas). Una silueta abstracta tiene exactamente la resolución que el enum permite — clickás "rodilla", se rellena la región rodilla. No hay desalineación entre lo que se ve y lo que se guarda. Implementable en SVG manual (1 día de trabajo) sin asset comprado ni dependencia de ilustrador.

**Trade-off conocido**: visualmente menos "lindo" que el estilo Strong/Hevy con anatomía coloreable. Pero ese estilo requiere asset profesional + sub-zonas que no tenemos en el enum.

**Implementación técnica**:

- Componente `BodyMapMini` (recap, 4.13) y `BodyMap` (full, 4.16) comparten la misma silueta SVG base. Diferencia: tamaño, interactividad, info adicional (timeline en el full).
- 17 `<Path>` clickables, uno por `BodyPart`. Cada path tiene `fill` reactivo según severity de notas activas en esa zona.
- Tab Frontal/Posterior en componente padre — switchea qué silueta se muestra.
- Heurística de mapeo: zonas que aparecen en ambas vistas (rodillas, hombros) se renderizan en las dos. Zonas exclusivas de espalda (lower_back, upper_back) solo en posterior. Pecho/abs solo en frontal.

**Reusabilidad**: el mismo componente sirve para 4.13 (mini, sin timeline) y 4.16 (full, con timeline + filtros). Diferencias se exponen vía props (`mode: "select" | "view"`, `showSeverity?: boolean`).

### D-15 · Threshold de chip evolutivo: 3 usos en últimas 20 sesiones

**DECISIÓN**: un texto libre se gradúa a chip frecuente cuando el usuario lo escribió **idéntico (case-insensitive, trim) ≥ 3 veces dentro de las últimas 20 sesiones completadas**. Ventana basada en sesiones, no en tiempo calendario.

**Razón**:

- **3 usos** = señal genuina de hábito, no accidente. 1–2 son ruido.
- **20 sesiones** = ventana corta que se adapta al ritmo de cada usuario (alguien que entrena 1×/semana vs 5×/semana). Mantiene la lista relevante a hábitos actuales — si dejaste de usar un chip, sale del top.
- **Identidad case-insensitive + trim** = "Barra rebotó", "barra rebotó", " barra rebotó " cuentan como el mismo chip. Evita fragmentar.

**Implementación** (en `utils/notes.ts`, ya esquematizado en step 8):

```ts
export function frequentChips(
  notes: SessionNote[],
  sessions: WorkoutSession[],
  category: NoteCategory,
): string[] {
  const recentSessions = sessions
    .filter((s) => s.endedAt)
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, 20)
    .map((s) => s.id);
  const recentSet = new Set(recentSessions);

  const counts = new Map<string, number>();
  for (const note of notes) {
    if (note.category !== category) continue;
    if (!recentSet.has(note.sessionId)) continue;
    const key = note.text.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const evolved = Array.from(counts.entries())
    .filter(([, count]) => count >= 3)
    .sort(([, a], [, b]) => b - a)
    .map(([text]) => text);

  // Defaults curados primero, luego evolutivos no-duplicados, top 6.
  const defaults = DEFAULT_CHIPS[category];
  const dedupedEvolved = evolved.filter(
    (text) => !defaults.some((d) => d.toLowerCase() === text),
  );
  return [...defaults, ...dedupedEvolved].slice(0, 6);
}
```

**Edge cases**:

- Sin historia: solo defaults aparecen.
- Más de 6 chips entre defaults + evolutivos: priorizamos los defaults curados, después los evolutivos por count desc, cap a 6.
- Default y evolved con el mismo texto (case-insensitive): se considera duplicado, default gana posición.

**Cuándo revisar**: si emerge en data real que 3/20 da pocos chips evolutivos (gente no repite vocabulario), bajamos a 2/20. Si emerge ruido (chips raros), subimos a 4/20 o agrandamos la ventana.

### D-16 · Recap reabrible hasta 24h después de `endedAt`

**DECISIÓN**: si una sesión terminó hace ≤ 24 horas (`Date.now() - session.endedAt <= 24h`) **y** no tiene notas con `source === "recap"`, en el detalle de la sesión aparece un CTA "Agregar reflexión" que abre la pantalla de recap normal. Pasadas las 24h, el CTA desaparece y la sesión queda cerrada para recap.

**Razón**:

- 24h es ventana corta donde la memoria del entreno está fresca pero permite el "se me pasó cerrarlo" legítimo (apuro, llamada, hambre).
- Más allá de 24h, los datos del recap se vuelven sesgados retroactivamente (lo que pasó al día siguiente contamina lo que decís sobre el entreno). Eso ensucia las correlaciones para la IA.
- Recap ya completado **no se edita** — convención de inmutabilidad. Si cambiás de opinión, agregás otra nota normal con `source: "text"`.

**Implementación**:

- Pantalla `app/workout/[id].tsx` (detalle de sesión) consulta:
  ```ts
  const canStillRecap =
    session.endedAt != null &&
    Date.now() - session.endedAt <= 24 * 60 * 60 * 1000 &&
    !notes.some((n) => n.sessionId === session.id && n.source === "recap");
  ```
- Si `canStillRecap`, banner accent en el header del detalle: "Reflexionar sobre este entreno → " (CTA).
- Tap → routea a `/workout/recap?sessionId=<id>` con el recap funcionando como si fuera post-workout normal.
- En el recap mismo, header dinámico: "Reflexión de hoy" / "Reflexión de ayer" según la diferencia.

### D-17 · Tracking de recurrencia de recap (data sin estado extra; reminder = feature futuro)

**DECISIÓN**: la tasa de uso de recap se computa **on-demand** desde los datos existentes (no agregamos estado persistido para esto). Helper:

```ts
// utils/notes.ts
export function recapCompletionRate(
  sessions: WorkoutSession[],
  notes: SessionNote[],
  windowSize = 10,
): number {
  const recent = sessions
    .filter((s) => s.endedAt != null)
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, windowSize);
  if (recent.length === 0) return 0;
  const withRecap = recent.filter((s) =>
    notes.some((n) => n.sessionId === s.id && n.source === "recap"),
  );
  return withRecap.length / recent.length;
}
```

**Razón**: cero estado extra, función pura testeable. La data ya existe — `SessionNote.source === "recap"` es el ground truth de "completaste el recap en esta sesión".

**Para qué sirve hoy**:

- Mostrar en settings: "Completás recap en X% de tus sesiones".
- Habilitar el botón "No mostrar más" del modal de discovery con justicia (si saltás 5 sesiones seguidas con tasa < 20%, sugerimos desactivar).

**Para qué sirve a futuro (cf. ROADMAP §4.17)**:

- Smart reminder a las 2h post-`endedAt` si `recapCompletionRate >= 0.6` (60%) y no hay recap registrado todavía.
- Documentado como feature separado en ROADMAP §4.17 — no es scope de Step 1–10 de este doc.

**Threshold del 0.6 es default tentativo**. Cuando se implemente 4.17, revisar con data real (puede ser 0.5 o 0.7).

### D-18 · Notas de preflight se persisten junto con la creación de la sesión

**DECISIÓN**: las respuestas del preflight (4.14) se guardan **dentro del mismo flow transaccional** que crea la `WorkoutSession`. El preflight no persiste nada hasta que el usuario confirma "Empezar entreno" — en ese momento se crea la sesión + las N `SessionNote`s con `sessionId` poblado. Si el usuario cancela, las respuestas se descartan.

**Razón**:

- **Schema clean**: `SessionNote.sessionId` queda `required` en el tipo. No abrimos la puerta a notas huérfanas.
- **Sin heurísticas frágiles**: el linkeo por timestamp (opción B descartada) tendría edge cases molestos — usuario hace preflight, cierra app, vuelve 3 horas después y empieza otra sesión, ¿se linkean? No vale la complejidad.
- **Pérdida aceptable**: si el usuario completa el preflight pero cancela el inicio, las respuestas eran sobre una sesión hipotética. No tienen valor predictivo sin la sesión real.

**Implementación**:

```ts
// app/workout/preflight.tsx
function handleStart(answers: PreflightAnswers) {
  const session = startWorkout(routineId, dayId);
  for (const answer of answers) {
    addNote({
      sessionId: session.id,
      category: "energy",
      text: answer.text,
      source: "preflight",
    });
  }
  router.replace("/workout/active");
}

function handleCancel() {
  // No persistimos nada. Estado local del preflight se descarta al unmount.
  router.back();
}
```

**Trade-off conocido (no scope v1)**: perdemos data de "intención vs ejecución" — los días que el usuario registra "energía baja + cansancio" y termina cancelando podrían ser insight útil para detectar burnout. Si llega a ser interesante en v2, se agrega como feature aparte (`AbandonedPreflight` u otro tipo separado), no como hack en `SessionNote`.

### D-19 · `severity` numérica universal, traducida a texto/emojis por categoría en UI

**DECISIÓN**: el campo `SessionNote.severity?: number` (1–10) aplica a **todas las categorías** que necesiten escala. Internamente siempre se guarda el número. La UI traduce a representación apropiada según la categoría — el usuario nunca ve un slider de 10 puntos.

**Razón**:

- **Schema único habilita queries simples y AI-ready**. Correlaciones cross-categoría (ej. "¿RPE subjetivo correlaciona con mood pre-entreno?") solo funcionan con datos numéricos comparables.
- **Forward-compat con AI Coach (cf. ROADMAP §5.13)**. El coach necesita data cuantitativa para razonar sobre patrones — strings semánticos rompen la utilidad analítica.
- **Costo cero de implementación**. `severity?: number` ya estaba en el tipo (D-3). Solo se extiende qué categorías lo usan.

**Mapping de UI a número** (en `utils/notes.ts`):

```ts
type SeverityUI = {
  pain: {
    kind: "buckets3";
    labels: ["leve", "molesta", "fuerte"];
    ranges: [[1, 3], [4, 6], [7, 10]];
  };
  effort: {
    kind: "buckets3";
    labels: ["fácil", "medio", "duro"];
    ranges: [[1, 3], [4, 6], [7, 10]];
  };
  mood: {
    kind: "emojis5";
    emojis: ["😩", "😐", "🙂", "😄", "🔥"];
    values: [1, 3, 5, 7, 10];
  };
  energy: {
    kind: "buckets3";
    labels: ["baja", "media", "alta"];
    ranges: [[1, 3], [4, 6], [7, 10]];
  };
  technique: never; // sin severity, solo chips
  equipment: never; // sin severity, solo chips
  other: never;
};

export function severityToLabel(
  category: NoteCategory,
  severity: number | undefined,
): string {
  // Lookup en el mapping según categoría.
  // ...
}

export function labelToSeverity(
  category: NoteCategory,
  label: string,
): number | undefined {
  // Mapeo inverso para guardar el número canónico cuando el user selecciona un chip/emoji.
  // ...
}
```

**Convenciones de display por categoría**:

| Categoría                         | UI input                                                 | Cómo se renderiza la nota guardada                 |
| --------------------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| `pain`                            | Slider 1–10 + label dinámico ("leve / molesta / fuerte") | "Hombro derecho · molesta (5)"                     |
| `effort`                          | 3 chips (fácil / medio / duro)                           | "Fácil" o "Duro"                                   |
| `mood`                            | 5 emojis (😩 😐 🙂 😄 🔥)                                | El emoji correspondiente + número en hover/inspect |
| `energy`                          | 3 chips (baja / media / alta)                            | "Energía alta"                                     |
| `technique`, `equipment`, `other` | Solo chips/text, sin severity                            | Solo el `text`                                     |

**Trade-off**: la UI del slider para `pain` da más resolución (el user puede elegir 5 vs 6). Las otras categorías van directo a chips/emojis y guardan el valor central del bucket (chip "medio" → severity 5; emoji 🙂 → severity 5).

**Edge case**: si una nota se importa/migra con severity fuera de rango (ej. valor 0, NaN, > 10), el helper `severityToLabel` retorna `undefined` y la UI omite la label. La nota sigue siendo válida.

### D-20 · `UserContext` (períodos cut/bulk/lesión) postpuesto a feature futura

**DECISIÓN**: el concepto de "período del usuario" (cut, bulk, maintenance, injury recovery, travel, stressful period) **no se incluye en v1** del sistema de notas. Queda registrado como feature futura ROADMAP §5.15, atado al desarrollo del AI Coach (5.13) que es su consumidor natural.

**Razón**:

- **Sin consumidor, la data es metadata muerta**. Hoy nadie lee "estoy en un cut". El AI Coach (5.13) es quien lo aprovecharía para contextualizar todas las demás notas — sin él, capturar el contexto no rinde.
- **Scope creep para v1**. El sprint de 4.3 + 4.13 + 4.14 ya es ambicioso. Sumar UserContext + UI de creación + lógica de "período activo" infla 1–2 días sin payoff inmediato.
- **Migración trivial cuando llegue**. Es agregar un array `userContexts: UserContext[]` a `PersistedState`. No breaking, no cambia tipos existentes de notes.

**Costo conocido del deferral**: los usuarios early-adopters no van a tener historial retroactivo de períodos cuando llegue 5.15. Aceptamos eso — la alternativa (capturar data sin consumidor por meses) es peor.

**Cuándo retomar**: cuando se arranque la implementación de 5.13 (AI Coach). El AI Coach sin UserContext puede dar consejos descontextualizados ("comés poco, te falta proteína" cuando el user está en cut intencional). Por eso tienen que llegar juntos o casi.

---

## 4. Decisiones abiertas

Lo que falta resolver. Cada una tiene opciones + un lean (mi recomendación) — esperando input para cerrar.

### Q-1 · ¿Recap obligatorio en las primeras N sesiones para "educar" al usuario?

**Opciones**:

- A) Siempre skipeable desde día 1.
- B) Primeras 3 sesiones aparece sin botón "Saltar"; después se vuelve skipeable.
- C) Onboarding explícito que pregunta "¿activar recap post-workout?" sí/no.

**Resolución**: cerrada por **D-11**. Opción C. Implementación: popup sí/no la primera vez (v1), onboarding rico con animaciones (v2, documentado en `future-onboardings.md`).

### Q-2 · ¿Preflight ON por default o opt-in en settings?

**Opciones**:

- A) ON por default. Skipeable cada vez. Si saltás 5 veces seguidas, prompt "¿desactivar?".
- B) OFF por default. El usuario lo activa en settings cuando lo descubre.
- C) ON las primeras 5 sesiones, después se evalúa engagement.
- D) (Surgida en discusión) Popup opt-in análogo al recap.

**Resolución**: cerrada por **D-11** + **D-12**. Patrón unificado de discovery progresivo — preflight aparece como modal cuando el usuario completó ≥5 sesiones. Todo el plumbing premium-ready vía D-12.

### Q-3 · Granularidad del body part enum

**Opciones**:

- A) **Mínima** (~17 zonas): hombros, codos, muñecas, lower/upper back, caderas, rodillas, tobillos, cuello, pecho, abdomen.
- B) **Mediana** (~30 zonas): suma cuádriceps / isquios / pantorrillas / aductores / glúteos / dorsales / trapecios / bíceps / tríceps / deltoides ant-med-post.
- C) **Detallada** (~60 zonas): incluye distinciones tipo "tendón patelar" vs "rodilla".

**Resolución**: cerrada por **D-13**. Opción A. Si emerge patrón de uso que justifique sub-zonas, expandimos el enum sin migración (es additive).

### Q-4 · ¿La nota a nivel set también se asocia al ejercicio, o solo al set?

Caso: en set 2 de press banca anoto "barra rebotó". Esa nota:

- A) Solo aplica al set 2 (granularidad fina, riesgo de no encontrarla después).
- B) Se denormaliza con `exerciseId: <press_banca>` (cf. D-4).
- C) Se duplica como dos notas: una para el set, una para el ejercicio.

**Lean**: B (ya decidido en D-4). Una nota, dos referencias.

**Resolución**: cerrada por D-4.

### Q-5 · ¿Cómo se renderiza el body map en el recap (4.13)?

**Opciones**:

- A) **Silueta tipo emergency room** (vista frontal + posterior, abstracta, unisex).
- B) **Anatomía simplificada** estilo Strong app (vista frontal con grupos musculares coloreables).
- C) **Lista de chips** sin figura (más simple, menos visual).

**Resolución**: cerrada por **D-14**. Opción A. Reusable en 4.16 sin rediseño. Implementable en SVG manual sin lib externa.

### Q-6 · ¿Cuándo se considera "graduado" un chip evolutivo?

**Opciones**:

- A) Uso ≥ 3 en últimas 20 sesiones → entra al top.
- B) Uso ≥ 5 en últimos 30 días → entra al top.
- C) Top 6 por uso absoluto (sin ventana temporal).

**Resolución**: cerrada por **D-15**. Opción A. Algoritmo concreto + edge cases documentados ahí.

### Q-7 · ¿El recap se puede reabrir después?

Caso: el usuario cierra la sesión sin recap, después se acuerda y quiere agregarlo.

- A) NO. Solo en el momento.
- B) SÍ, desde el detalle de la sesión, hasta 24h después.
- C) SÍ siempre, cualquier momento.

**Resolución**: cerrada por **D-16** (24h window) + **D-17** (tracking de recurrencia para futuro smart reminder, cf. ROADMAP §4.17).

### Q-8 · ¿Las notas de pre-workout (4.14) se asocian a la sesión que arranca, o son independientes?

- A) Cada nota de preflight tiene `sessionId` apuntando a la sesión que se inicia inmediatamente después.
- B) Las notas de preflight se guardan sin `sessionId`; al iniciar la sesión, se "linkean" por timestamp (notas de las últimas 4h).

**Resolución**: cerrada por **D-18**. Opción A. Notas se persisten transaccionalmente con `startWorkout()`; si user cancela, se descartan.

### Q-9 · ¿Severity también para `effort` y `mood`, o solo para `pain`?

**Opciones**:

- A) Solo `pain` tiene severity numérica. Para `effort`/`mood` usamos chips ("fácil/medio/duro", emoji 1–5).
- B) Todas las categorías tienen severity 1–10 (canónico).

**Resolución**: cerrada por **D-19**. Opción B. Datos numéricos en backend, traducidos a chips/emojis en UI por categoría. Mapping completo documentado.

### Q-10 · ¿Notas a nivel "período" (cut, bulk, lesión activa)?

Out of scope para 4.3 estricto, pero lo discutimos en la idea original. ¿Lo metemos ya?

- A) Sí — agregar tipo `UserContext` con `startDate`, `endDate`, `type`, `notes`.
- B) No — postponer a una feature futura (5.x).

**Resolución**: cerrada por **D-20**. Opción B. Postponer a ROADMAP §5.15, atado al AI Coach (5.13). Migración trivial cuando llegue.

---

## 5. Modelo de datos

### 5.1 Tipos nuevos

A agregar en `artifacts/ironlog/types/index.ts`:

```ts
// ---------------------------------------------------------------------------
// Notes system

export type NoteCategory =
  | "pain"
  | "effort"
  | "technique"
  | "equipment"
  | "energy"
  | "mood"
  | "other";

export type BodyPart =
  | "shoulder_left"
  | "shoulder_right"
  | "elbow_left"
  | "elbow_right"
  | "wrist_left"
  | "wrist_right"
  | "neck"
  | "upper_back"
  | "lower_back"
  | "chest"
  | "abs"
  | "hip_left"
  | "hip_right"
  | "knee_left"
  | "knee_right"
  | "ankle_left"
  | "ankle_right";

export type NoteSource = "chip" | "text" | "voice" | "recap" | "preflight";

/**
 * Una nota estructurada asociada a una sesión (y opcionalmente a un set o
 * ejercicio específico).
 *
 * Contratos:
 * - `category` siempre presente.
 * - `text` siempre presente (mínimo string vacío). Si la nota viene de un
 *   chip puro, `text` es la label del chip.
 * - `bodyPart` solo se usa con `category === "pain"`. Para otras categorías
 *   se ignora aunque exista (nunca se debería setear).
 * - `severity` (1–10) se interpreta en UI según categoría (cf. Q-9 y D-3).
 * - Si `setId` está presente, `exerciseId` también debe estar
 *   (denormalizado, cf. D-4). El inverso no aplica: una nota puede tener
 *   `exerciseId` sin `setId` (nota a nivel ejercicio).
 * - `audioUri`: solo cuando `source === "voice"`. Path absoluto en
 *   `FileSystem.documentDirectory + "audio_notes/"`.
 */
export interface SessionNote {
  id: string;
  sessionId: string;
  setId?: string;
  exerciseId?: string;
  createdAt: number;
  category: NoteCategory;
  bodyPart?: BodyPart;
  severity?: number;
  resolved?: boolean;
  resolvedAt?: number;
  text: string;
  source: NoteSource;
  audioUri?: string;
}
```

### 5.2 Extensión a `PersistedState`

```ts
interface PersistedState {
  // ... existentes
  notes: SessionNote[];
}
```

`DEFAULT_STATE.notes = []`. Hidratación con merge de defaults — si un blob viejo no tiene `notes`, se inicializa vacío.

### 5.3 Helpers en `utils/notes.ts`

Funciones puras (sin React, testeables):

```ts
import type {
  SessionNote,
  NoteCategory,
  BodyPart,
  WorkoutSession,
} from "@/types";

/**
 * Severity bucketada para UI (cf. D-3).
 */
export type SeverityBucket = "leve" | "molesta" | "fuerte";

export function severityBucket(n: number): SeverityBucket {
  if (n <= 3) return "leve";
  if (n <= 6) return "molesta";
  return "fuerte";
}

/**
 * Filtros frecuentes — exponer como helpers para que cualquier pantalla
 * los use sin repetir lógica.
 */
export function notesForSession(
  notes: SessionNote[],
  sessionId: string,
): SessionNote[] {
  return notes.filter((n) => n.sessionId === sessionId);
}

export function notesForExercise(
  notes: SessionNote[],
  exerciseId: string,
): SessionNote[] {
  return notes.filter((n) => n.exerciseId === exerciseId);
}

export function activePainNotes(notes: SessionNote[]): SessionNote[] {
  return notes.filter((n) => n.category === "pain" && !n.resolved);
}

export function notesByBodyPart(
  notes: SessionNote[],
  bodyPart: BodyPart,
): SessionNote[] {
  return notes.filter((n) => n.bodyPart === bodyPart);
}

/**
 * Chips frecuentes evolutivos (cf. D-9 y Q-6).
 *
 * Devuelve top 6 chips por categoría, combinando defaults curados +
 * texto libre que el usuario repitió ≥3 veces en últimas 20 sesiones.
 */
export function frequentChips(
  notes: SessionNote[],
  sessions: WorkoutSession[],
  category: NoteCategory,
): string[] {
  // ... implementar en step 7
  return [];
}
```

### 5.4 Defaults de chips por categoría

En `constants/noteChips.ts`:

```ts
export const DEFAULT_CHIPS: Record<NoteCategory, string[]> = {
  pain: ["leve", "molesta", "fuerte"],
  effort: ["fácil", "duro", "RPE alto", "perdí tensión"],
  technique: [
    "form rota",
    "buena ejecución",
    "rom completo",
    "agarre cambiado",
  ],
  equipment: ["barra olímpica", "discos viejos", "rack chico", "sin spotter"],
  energy: ["dormí mal", "ayuno", "post-cardio", "stress laboral", "viaje"],
  mood: ["motivado", "sin ganas", "concentrado", "distraído"],
  other: [],
};
```

---

## 6. Almacenamiento y migración a SQLite

### 6.1 Estado actual (AsyncStorage)

Notas viven en `PersistedState.notes`, dentro del único blob `ironlog:v1` de AsyncStorage. Cada mutación reescribe el blob completo (cf. `db.md`).

**Costo de escritura**: O(N) por todas las notas en cada cambio. Para 1000 notas (~200 KB), serializar es ~10ms. Aceptable hasta varios miles.

### 6.2 Migración futura a SQLite

Cuando ejecutemos el plan de `backend.md`, las notas se vuelven una tabla. Schema target:

```sql
CREATE TABLE session_notes (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  set_id        TEXT REFERENCES completed_sets(id) ON DELETE SET NULL,
  exercise_id   TEXT REFERENCES exercises(id),
  created_at    INTEGER NOT NULL,
  category      TEXT NOT NULL,
  body_part     TEXT,
  severity      INTEGER,
  resolved      INTEGER NOT NULL DEFAULT 0,
  resolved_at   INTEGER,
  text          TEXT NOT NULL,
  source        TEXT NOT NULL,
  audio_uri     TEXT
);

CREATE INDEX idx_notes_session    ON session_notes(session_id);
CREATE INDEX idx_notes_exercise   ON session_notes(exercise_id);
CREATE INDEX idx_notes_created    ON session_notes(created_at DESC);
CREATE INDEX idx_notes_body_part  ON session_notes(body_part)
  WHERE body_part IS NOT NULL;

-- Partial index crítico para 4.16 (body map de molestias activas).
CREATE INDEX idx_notes_active_pain ON session_notes(body_part, severity, created_at)
  WHERE category = 'pain' AND resolved = 0;
```

### 6.3 Diseño defensivo para la migración

Tres reglas que respeto en v1 para que la migración a SQLite sea **mecánica**:

1. **No queries con joins implícitos en JS**. Cualquier filtrado se hace por el id explícito que ya tiene la nota (`sessionId`, `exerciseId`, `bodyPart`). En SQLite se vuelven queries sobre índices.
2. **No mutar notas en place**. Las funciones del context que actualizan notas (`updateNote`, `resolveNote`) crean nueva versión inmutable. En SQLite serán `UPDATE` simples.
3. **IDs string desde el día cero**. `uid()` ya está en `utils/id.ts`. SQLite acepta `TEXT PRIMARY KEY` sin friction.

### 6.4 Schema versioning

El blob de AsyncStorage no tiene versión todavía. Cuando agregamos `notes`, el merge `{ ...defaults, ...parsed }` lo cubre. Pero conviene agregar una key `schemaVersion: 2` en `PersistedState` ahora para futuras migraciones explícitas.

**TODO**: agregar `schemaVersion: number` a `PersistedState` en este sprint. Default 1. Cuando incluyamos `notes`, bumpear a 2 + función `migrate(oldState, oldVersion): PersistedState`.

---

## 7. Forward compatibility con 4.15 y 4.16

Esta sección demuestra explícitamente que el diseño actual deja habilitadas 4.15 y 4.16 sin cambios de schema.

### 7.1 4.15 — Voice notes

Lo que necesita 4.15 que **ya está** en el schema:

- ✅ `source: "voice"` en `NoteSource`.
- ✅ `audioUri?: string` en `SessionNote`.
- ✅ `text: string` siempre presente — guarda el transcript.
- ✅ `exerciseId` denormalizado para asociar al ejercicio en curso por timestamp.

Lo que tendrá que sumarse (no afecta a 4.3):

- Nuevo componente `components/notes/VoiceNoteRecorder.tsx`.
- Permiso de mic en `app.json`.
- Lib `expo-speech-recognition` o equivalente.
- Botón flotante 🎙 en `app/workout/active.tsx`.

**Confirmación**: 0 cambios al modelo de datos cuando llegue 4.15.

### 7.2 4.16 — Health timeline / body map

Lo que necesita 4.16 que **ya está** en el schema:

- ✅ `bodyPart` enum cerrado y limitado — mappea 1:1 a zonas SVG.
- ✅ `severity` numérica para colorear intensidad.
- ✅ `resolved` flag por nota — la cohorte "activa" se filtra trivialmente.
- ✅ `resolvedAt` para timeline temporal.
- ✅ Helper `activePainNotes()` ya planeado.

Lo que tendrá que sumarse:

- Componente `components/notes/BodyMap.tsx` (full size, vs `BodyMapMini` que se hace en 4.13).
- Pantalla `app/health-timeline.tsx`.
- Helper `painSummaryByBodyPart(notes)` en `utils/notes.ts`.
- Export PDF (opcional v2).

**Confirmación**: 0 cambios al modelo de datos cuando llegue 4.16.

### 7.3 Test mental: ¿qué pasa si llega un requirement nuevo?

Tres escenarios hipotéticos para validar robustez:

- **"Quiero notas con foto adjunta"** → agregar `photoUri?: string` a `SessionNote`. No-breaking. ✅
- **"Quiero notas con sentimientos múltiples"** → ya soportado: el usuario crea N notas separadas. ✅
- **"Quiero compartir una nota con mi entrenador"** → no requiere cambio de schema. UI suma botón "share" que serializa la nota. ✅

---

## 8. Inventario de componentes

### 8.1 A crear

| Componente       | Ruta                                  | Reusado por                        | Esfuerzo |
| ---------------- | ------------------------------------- | ---------------------------------- | -------- |
| `NoteSheet`      | `components/notes/NoteSheet.tsx`      | 4.3 (active.tsx, summary.tsx)      | M        |
| `CategoryChips`  | `components/notes/CategoryChips.tsx`  | 4.3 (NoteSheet)                    | S        |
| `BodyPartChips`  | `components/notes/BodyPartChips.tsx`  | 4.3 (NoteSheet), 4.13 (recap)      | S        |
| `SeveritySlider` | `components/notes/SeveritySlider.tsx` | 4.3, 4.13                          | S        |
| `MoodSelector`   | `components/notes/MoodSelector.tsx`   | 4.13                               | S        |
| `BodyMapMini`    | `components/notes/BodyMapMini.tsx`    | 4.13 (recap), 4.16 (full body map) | M        |
| `FactorXChips`   | `components/notes/FactorXChips.tsx`   | 4.14                               | S        |
| `NoteCard`       | `components/notes/NoteCard.tsx`       | summary.tsx, exercise-detail.tsx   | S        |
| `QuickNoteMenu`  | `components/notes/QuickNoteMenu.tsx`  | 4.3 (long-press en check)          | S        |

### 8.2 A modificar

| Archivo                       | Cambio                                                                                   | Esfuerzo |
| ----------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| `app/workout/active.tsx`      | Sumar botón `edit-2` por set + long-press en check + integrar NoteSheet + QuickNoteMenu. | M        |
| `app/workout/summary.tsx`     | Sumar sección "Highlights" con NoteCard listado.                                         | S        |
| `app/workout/index.tsx` (CTA) | Routear a preflight antes de active.                                                     | S        |
| `app/exercise-detail.tsx`     | Sumar timeline de notas históricas para ese ejercicio.                                   | S        |
| `contexts/IronLogContext.tsx` | Sumar `notes`, `addNote`, `updateNote`, `deleteNote`, `resolveNote`, getters.            | M        |
| `types/index.ts`              | Sumar `SessionNote`, `NoteCategory`, `BodyPart`, `NoteSource`.                           | S        |

### 8.3 A reusar tal cual

- `components/ui/Chip.tsx` — chips en NoteSheet, FactorXChips.
- `components/ui/Stack.tsx` (Row, Col) — layout.
- `components/ui/Text.tsx` — textos.
- `components/workout/BulkColumnSheet.tsx` — patrón base para `NoteSheet` (modal + backdrop dismiss + InputAccessoryView).

---

## 9. Inventario de pantallas y rutas

### 9.1 Nuevas

| Ruta                 | Archivo                     | Feature | Trigger                                       |
| -------------------- | --------------------------- | ------- | --------------------------------------------- |
| `/workout/preflight` | `app/workout/preflight.tsx` | 4.14    | CTA "Empezar entreno" desde home/workout tab. |
| `/workout/recap`     | `app/workout/recap.tsx`     | 4.13    | Después de `summary.tsx`, slide-up.           |

### 9.2 Modificadas

- `app/workout/index.tsx` (CTA "Empezar"): redirige a `/workout/preflight` si la sesión es training, salvo override de settings.

### 9.3 Sin cambios

`active.tsx`, `summary.tsx`, `exercise-detail.tsx` reciben **componentes** nuevos pero no son rutas distintas.

---

## 10. Flujos UX detallados

### 10.1 Captura rápida durante set (4.3 quick path)

```
Sesión activa, set 2 de press banca completado.
   ↓
Long-press en el botón ✓ del set
   ↓
QuickNoteMenu aparece sobre el botón:
  ┌───────────────────────┐
  │ [fácil]    [duro]     │
  │ [perdí tensión] [PR]  │
  │ — más opciones —      │
  └───────────────────────┘
   ↓
Tap en "fácil"
   ↓
addNote({
  category: "effort",
  setId: <set-2-id>,
  exerciseId: <press-banca-id>,
  text: "fácil",
  source: "chip",
  severity: 2,    // map "fácil" → 1-3 bucket
})
   ↓
Haptic light. El check del set adquiere un mini-badge "•" en la esquina
para mostrar que tiene nota.
```

### 10.2 Captura detallada durante set (4.3 deep path)

```
Tap en ícono edit-2 al lado del botón ✓
   ↓
NoteSheet aparece desde abajo:
  ┌─────────────────────────────────────┐
  │ ▔▔▔                                  │
  │  NOTA · Press banca · Set 2          │
  │                                       │
  │  CATEGORÍA                            │
  │  [pain] [effort] [tech] [equip]      │
  │  [energy] [mood] [other]              │
  │                                       │
  │  --- si "pain" --- ZONA               │
  │  [hombro D] [hombro I] [codo D]      │
  │  [+ ver todas]                        │
  │                                       │
  │  --- si severity aplica --- INTENSIDAD│
  │  ●━━━━○─────  molesta (5/10)         │
  │                                       │
  │  TEXTO (opcional)                     │
  │  ┌─────────────────────────┐          │
  │  │ matiz adicional...      │          │
  │  └─────────────────────────┘          │
  │                                       │
  │  [Cancelar]  [🎙]  [Guardar]         │
  └─────────────────────────────────────┘
```

`🎙` está disabled en v1 — placeholder para 4.15.

### 10.3 Recap post-workout (4.13)

```
Sesión finalizada. Summary aparece como hoy.
   ↓
Tap "Listo" en summary
   ↓
Slide-up de Recap:
  ┌─────────────────────────────────────┐
  │  ←        REFLEXIÓN        Saltar →  │
  │                                       │
  │  ¿CÓMO TE SENTISTE?                  │
  │   😩    😐    🙂    😄    🔥          │
  │   1     2     3     4     5           │
  │                                       │
  │  ¿ALGUNA MOLESTIA?                   │
  │  ┌─────────┐  ┌─────────┐             │
  │  │ frontal │  │posterior│             │
  │  └─────────┘  └─────────┘             │
  │     [silueta SVG con zonas tappables] │
  │                                       │
  │  → Si tap en zona, aparece debajo:   │
  │  Hombro D — intensidad:               │
  │  ●━━━○─────  leve                     │
  │  ┌─────────────────────────┐          │
  │  │ qué sentiste? (opcional)│          │
  │  └─────────────────────────┘          │
  │                                       │
  │  ALGO PARA RECORDAR                   │
  │  ┌─────────────────────────┐          │
  │  │ ...                     │          │
  │  └─────────────────────────┘          │
  │                                       │
  │           [    Listo    ]              │
  └─────────────────────────────────────┘
```

Genera 1–N `SessionNote`s con `source: "recap"`.

### 10.4 Preflight Factor X (4.14)

```
Tap "Empezar entrenamiento" en home
   ↓
Slide-up de Preflight (rápido, < 10 segundos):
  ┌─────────────────────────────────────┐
  │  ←        ANTES DE EMPEZAR  Saltar →│
  │                                       │
  │  ¿CÓMO DORMISTE ANOCHE?              │
  │  [  mal  ] [   ok   ] [  bien  ]     │
  │                                       │
  │  ¿ENERGÍA HOY?                       │
  │  [ baja  ] [ media  ] [  alta  ]     │
  │                                       │
  │  ¿ALGO DISTINTO? (opcional)          │
  │  [ayuno] [post-cardio] [stress]      │
  │  [viaje] [enfermedad] [vuelvo]       │
  │   ↑ multi-select                      │
  │                                       │
  │       [  Empezar entreno  ]           │
  └─────────────────────────────────────┘
```

Genera 1–3 `SessionNote`s con `source: "preflight"`, todas `category: "energy"`, vinculadas a la nueva session que se crea inmediatamente después.

---

## 11. Plan de implementación step-by-step

Cada step termina con la app **verde y funcionando**. Si algo se rompe, no avanzamos.

### Step 0 · Preparativos

`[x]` Schema versioning.

- Agregar `schemaVersion?: number` a `PersistedState`.
- Default value: `1`.
- Función `migrate(state, fromVersion): PersistedState` (esqueleto, no-op por ahora).
- Hidratación verifica versión y corre migrate si es menor a la versión actual.

**Done cuando**: typecheck pasa, app sigue arrancando con blob viejo y nuevo.

### Step 1 · Tipos y context plumbing

`[x]` Tipos y mutadores básicos.

1. Agregar a `types/index.ts`: `NoteCategory`, `BodyPart`, `NoteSource`, `SessionNote`.
2. Crear `utils/notes.ts` con `severityBucket`, `notesForSession`, `notesForExercise`, `activePainNotes`, `notesByBodyPart`.
3. Crear `constants/noteChips.ts` con `DEFAULT_CHIPS`.
4. Modificar `IronLogContext`:
   - Sumar `notes: SessionNote[]` al `PersistedState`.
   - `DEFAULT_STATE.notes = []`.
   - `addNote(input: Omit<SessionNote, "id" | "createdAt">): SessionNote`.
   - `updateNote(id: string, patch: Partial<SessionNote>): void`.
   - `deleteNote(id: string): void`.
   - `resolveNote(id: string): void` — setea `resolved: true, resolvedAt: now()`.
   - `getNotesForSession(sessionId)`, `getNotesForExercise(exerciseId)`.
5. Bumpear `schemaVersion` a 2. `migrate(state, 1)` añade `notes: []` si falta.

**Done cuando**: typecheck pasa, hidratación con blob viejo no rompe, manualmente desde DevTools podés llamar `addNote(...)` y verlo persistir.

### Step 2 · Componentes base de captura

`[x]` Componentes pequeños y testeables independientemente. Cf. `feature-fixes.md` FX-1 (desviación menor: chips custom en vez de reusar `<Chip>` base — el base no soporta ícono).

- `CategoryChips` — array de 7 chips. Acepta `value`, `onChange`. Reusa `Chip` existente.
- `BodyPartChips` — top 6 zonas + botón "Ver todas" que expande a las 17.
- `SeveritySlider` — 1–10 con bucketing visual. Etiqueta dinámica ("leve / molesta / fuerte"). Color del slider matchea bucket (lime / yellow / danger).
- `NoteCard` — display de una nota: ícono por categoría + texto + meta (set/ejercicio/sesión).

**Done cuando**: cada componente renderiza standalone con props mocked. Storybook-style screen oculta para developer (`app/_dev/notes-preview.tsx`) opcional.

### Step 3 · NoteSheet integrado a active.tsx

`[x]` Sheet completo + integración. Cf. `feature-fixes.md` FX-2 (modo "lista" cuando set tiene notas).

1. Crear `components/notes/NoteSheet.tsx`. Patrón heredado de `BulkColumnSheet`: backdrop dismiss + inner pressable que dismissa keyboard + InputAccessoryView con botón keyboard-close (iOS).
2. Sheet recibe `setId?`, `exerciseId?`, `sessionId`. Llama `addNote()` al guardar y cierra.
3. En `active.tsx`, sumar ícono `edit-2` muted al lado del check de cada set. Tap → abre NoteSheet con `setId` + `exerciseId` poblados.
4. Cuando un set tiene ≥1 nota, mostrar mini-badge "•" en el check. Tap en ícono `edit-2` ahora muestra nota existente (modo "ver" + botón "Editar/Eliminar/Agregar otra").

**Done cuando**: en simulator/device, abrís sesión, tocás el ícono de un set, llenás categoría + severity + texto, guardás. La nota persiste en `state.notes` y aparece el badge.

### Step 4 · Quick-add por long-press

`[x]` UX de captura rápida (cf. D-10). Cf. `deuda-tecnica.md` DT-2 (cosmético: menu como modal-abajo en vez de popover-sobre-botón).

1. `QuickNoteMenu` — popover/menu que aparece sobre el botón check.
2. En `active.tsx`, long-press del check (>500ms) → abre QuickNoteMenu con top 4 chips (defaults curados, evolutivos en step 7).
3. Tap en chip → addNote inmediato + haptic light + cerrar menu.
4. "— más opciones —" en el menu abre el NoteSheet completo.

**Done cuando**: long-press en check → menu → tap "fácil" → nota guardada en 2 acciones.

### Step 5 · Display de notas en summary y exercise-detail

`[x]` Lectura. Cf. `feature-fixes.md` FX-3 (highlights agrupado por categoría).

1. En `summary.tsx`: sección "Highlights" entre stats principales y secundarios. Lista las notas de la sesión que se acaba de cerrar, agrupadas por categoría con NoteCard.
2. En `exercise-detail.tsx`: sección "Notas históricas" abajo de las stats. Timeline desc por fecha, con click → expande detalle.

**Done cuando**: terminás una sesión con notas y aparecen en summary. Vas a exercise-detail de un ejercicio con notas históricas y las ves.

### Step 6 · Recap post-workout (4.13)

`[x]` Pantalla y componentes. Cf. `feature-fixes.md` FX-4 (discovery branching usa helper centralizado).

1. Crear `MoodSelector` — 5 botones emoji con ripple selection.
2. Crear `BodyMapMini` — silueta SVG frontal + posterior tabbeable. Cada zona tiene un `<Path>` con `onPress` que setea estado seleccionado. Cuando hay zonas seleccionadas, debajo aparece un `SeveritySlider` por zona + textbox opcional.
3. Crear `app/workout/recap.tsx` con los 3 bloques.
4. En `summary.tsx`, después del CTA "Listo":
   - Si `recap` está activado en `profile.featureDiscoveries` (status `"activated"`) → routear a `/workout/recap`.
   - Si está `"unseen"` y trigger se cumple (sesiones ≥ 3) → renderizar `FeatureDiscoveryPrompt` modal.
   - Si está `"dismissed"` o `"snoozed"` → skip.
   - Lógica resuelta vía helper `getEligibleDiscoveries(profile, sessions, notes)` (cf. D-11).
5. Recap "Listo" → `addNote()` por cada zona + mood + texto libre. Source: `"recap"`.

**Done cuando**: completás una sesión → summary → recap → guardás → notas con `source: "recap"` aparecen en `state.notes`.

### Step 7 · Preflight Factor X (4.14)

`[x]` Pantalla y componentes.

1. Crear `FactorXChips` — multi-select de chips de contexto.
2. Crear `app/workout/preflight.tsx` con sueño + energía + factores.
3. Modificar `home/index.tsx` (CTA "Empezar entreno"):
   - Si `preflight` está `"activated"` en `profile.featureDiscoveries` → routear a `/workout/preflight`.
   - Si está `"unseen"` y trigger se cumple (sesiones ≥ 5) → mostrar `FeatureDiscoveryPrompt` modal (cf. D-11).
   - Si está `"dismissed"` o `"snoozed"` → routear directo a `active.tsx`.
4. Preflight "Empezar entreno" → crear sesión + addNote por cada respuesta. Source: `"preflight"`. Después navega a `active.tsx`.

**Done cuando**: tap en "Empezar entreno" después de 5 sesiones → discovery prompt → activás → preflight → completás → notas guardadas + sesión activa arranca.

### Step 8 · Chips evolutivos

`[x]` Refinamiento de UX. (Wording del spec mencionaba `CategoryChips` pero el helper aplica a los chips de texto en `NoteSheet` + `QuickNoteMenu` — `CategoryChips` muestra las categorías, que no evolucionan.)

1. Implementar `frequentChips()` en `utils/notes.ts` con el algoritmo de D-9 (cf. Q-6 cuando se resuelva).
2. Reemplazar `DEFAULT_CHIPS` hardcoded en `CategoryChips` y `QuickNoteMenu` por llamadas a `frequentChips(notes, sessions, category)`.

**Done cuando**: si usás "barra rebotó" 3 veces, aparece como chip top en próxima nota.

### Step 9 · Forward-compat verification

`[x]` Validación final.

- Caso de prueba: simular 4.15 manualmente → llamar `addNote({ source: "voice", audioUri: "/tmp/foo.m4a", text: "transcript de ejemplo" })`. Confirmar que se guarda y muestra en NoteCard sin error.
- Caso de prueba: simular 4.16 manualmente → consultar `activePainNotes(notes)` → confirmar que devuelve solo `category === "pain" && !resolved`. Renderizar conteo agrupado por `bodyPart`.

**Done cuando**: ambos casos funcionan. Cero cambios al schema.

### Step 10 · Settings y privacy

`[x]` Toggles.

1. En `settings.tsx`, sección "Notas y reflexión":
   - Toggle "Recap al cerrar sesión" (lee/escribe `featureDiscoveries[recap].status`).
   - Toggle "Preflight al iniciar" (idem para preflight).
   - Botón "Resetear descubrimientos" — vuelve todos los `status` a `"unseen"` para volver a ofrecer las features.
   - Botón "Borrar todas las notas" con confirmación.
2. En `Profile`, agregar `featureDiscoveries?: FeatureDiscoveryState[]` (cf. D-11).
3. Implementar `services/entitlements.ts` con `hasEntitlement(profile, name)` que devuelve `true` siempre en v1 (cf. D-12). Stub listo para conectar a RevenueCat después.

**Done cuando**: el usuario puede desactivar ambos prompts y la app respeta los toggles.

---

## 12. Edge cases a manejar

| Caso                                                                | Handling                                                                                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Usuario abre NoteSheet pero cancela sin guardar**                 | Estado local del sheet se descarta al cerrar. Nada persiste.                                                                                                                                            |
| **Usuario guarda una nota y después borra el set**                  | El set se elimina pero `setId` queda dangling. Helper `notesForSession` sigue funcionando porque filtra por `sessionId`. UI de `NoteCard` muestra "Set eliminado" si el `setId` no existe en la sesión. |
| **Usuario borra una sesión con notas**                              | Eliminar la sesión también elimina sus notas (cascade en SQLite, manual en JS hoy). Mutador `deleteSession` itera y borra.                                                                              |
| **Recap se queda a medio llenar y app cierra**                      | Al reabrir, no recovery. Estado local del recap es ephemeral. (Si quisiéramos recovery, agregar `draftNote` a `PersistedState`.)                                                                        |
| **Preflight: usuario completa pero cancela el inicio de la sesión** | Notas asociadas se descartan (no hay `sessionId` válido). Si Q-8 → opción A, eso está cubierto: las notas no se guardan hasta que la sesión se inicia.                                                  |
| **Severity 0 o NaN**                                                | Validar antes de guardar: clampear 1–10. Si `category !== "pain" && severity == null`, no guardar `severity`.                                                                                           |
| **Body part no existe en enum (legacy data)**                       | Defensive: tratar como si no estuviera. NoteCard renderiza la nota sin label de zona.                                                                                                                   |
| **Audio URI roto** (anticipa 4.15)                                  | `audioUri` puede dejar de existir si se limpia el cache. Si el path no existe, deshabilitar play y mostrar "audio no disponible" sin crashear.                                                          |
| **Migration desde blob v1 sin `notes`**                             | `migrate(state, 1)` → `state.notes = []` y bumpea version.                                                                                                                                              |

---

## 13. Anti-patterns a evitar

- ❌ Guardar `bodyPart` como string libre. Romperá 4.16.
- ❌ Mutar notas in-place (`note.resolved = true`). Romperá la migración a SQLite y la inmutabilidad de React.
- ❌ Hacer `setState({ notes: [...prev.notes, newNote] })` en un loop sin batchear. La persistencia rescribe el blob entero por cada uno.
- ❌ Pedir `bodyPart` para categorías que no son `pain`. Confunde al usuario y ensucia la data.
- ❌ Cargar todo el array de notas en cada componente que muestre una sola nota. Usar selectors / `getNoteById`.
- ❌ Esconder errores de validación. Si `severity` es 0 al guardar, log + no guardar es mejor que guardar `{ severity: NaN }`.
- ❌ Hardcodear chips frecuentes sin habilitar evolución. Romperá D-9 después.
- ❌ Mezclar UI state efímero (sheet abierto, draft text) con `PersistedState`. Eso va en local component state.
- ❌ Llamar `addNote` desde un useEffect sin deps. Loops infinitos garantizados.

---

## 14. Testing strategy

Sin framework de tests automatizados todavía (cf. ROADMAP). Estrategia manual ordenada por step:

### 14.1 Tests manuales por step

Cada step tiene una sección "Done cuando". Eso son los tests manuales mínimos.

### 14.2 Casos de prueba transversales

Después del step 9, correr este flow completo en simulator:

1. App arranca con datos previos (no clean).
2. Tap "Empezar entreno" → preflight → completar sueño "OK" + energía "alta" + factor "ayuno" → empezar.
3. Hacer 3 sets de press banca. En set 2, long-press del check → "fácil". En set 3, ícono edit-2 → categoría "pain" → zona "shoulder_right" → severity 4 → texto "molesta al bajar".
4. Terminar entreno. En summary debe aparecer la nota de pain destacada.
5. Continuar al recap → mood 🙂 → tap zona "shoulder_right" en body map → severity 3 → texto "ya menos".
6. Volver a home. Ir a exercise-detail de press banca. Confirmar timeline con 2 notas históricas.
7. Cerrar y reabrir app. Confirmar que todo persistió.

### 14.3 Cuando entren tests automatizados

Las funciones puras de `utils/notes.ts` son los primeros candidatos. Schema validation con Zod (cuando se agregue) es el siguiente.

---

## 15. Tracker de progreso

> Actualizar este checklist a medida que se completa cada step. `[~]` para
> en-progreso. Comentar al lado del paso si hay decisiones tomadas en el
> momento.

### Decisiones abiertas (cf. §4)

- [x] Q-1 · Recap obligatorio en primeras N sesiones — resuelta por D-11
- [x] Q-2 · Preflight ON/OFF default — resuelta por D-11 + D-12 (discovery progresivo + premium-ready)
- [x] Q-3 · Granularidad body part (mínima/mediana/detallada) — resuelta por D-13 (mínima, 17 zonas)
- [x] Q-5 · Render del body map (silueta/anatomía/lista) — resuelta por D-14 (silueta SVG abstracta)
- [x] Q-6 · Threshold de chip evolutivo — resuelta por D-15 (3 usos en últimas 20 sesiones)
- [x] Q-7 · Recap reabrible después — resuelta por D-16 (24h) + D-17 (tracking recurrencia)
- [x] Q-8 · Notas preflight asociadas a sesión por ID — resuelta por D-18 (transaccional con startWorkout)
- [x] Q-9 · Severity para todas las categorías — resuelta por D-19 (numérica universal, UI traduce por categoría)
- [x] Q-10 · Notas a nivel "período" (cut/bulk/lesión) — resuelta por D-20 (deferida a ROADMAP §5.15)

### Implementación

- [x] Step 0 · Preparativos (schemaVersion + migrate esqueleto)
- [x] Step 1 · Tipos y context plumbing
- [x] Step 2 · Componentes base (CategoryChips, BodyPartChips, SeveritySlider, NoteCard)
- [x] Step 3 · NoteSheet integrado a active.tsx
- [x] Step 4 · Quick-add por long-press
- [x] Step 5 · Display de notas en summary y exercise-detail
- [x] Step 6 · Recap post-workout (4.13)
- [x] Step 7 · Preflight Factor X (4.14)
- [x] Step 8 · Chips evolutivos
- [x] Step 9 · Forward-compat verification
- [x] Step 10 · Settings y privacy

### Verificaciones finales

- [ ] Test transversal manual (cf. §14.2) pasó en iOS simulator
- [ ] Test transversal manual pasó en Android (cuando aplique)
- [x] Typecheck limpio en todos los steps
- [ ] Migración de blob v1 → v2 verificada con datos reales (cf. `deuda-tecnica.md` DT-11)
- [ ] No regresiones en las funciones de gym existentes

---

## 16. Glosario

- **Nota**: instancia de `SessionNote`.
- **Categoría**: uno de `pain | effort | technique | equipment | energy | mood | other`.
- **Body part**: zona corporal del enum `BodyPart`.
- **Severity**: número 1–10, bucketeado en UI.
- **Quick-add**: captura via long-press + chip menu.
- **Deep-add**: captura via ícono edit-2 + NoteSheet completo.
- **Recap**: pantalla post-workout con 3 prompts.
- **Preflight**: pantalla pre-workout con 3 chips de contexto.
- **Source**: cómo se capturó la nota (`chip | text | voice | recap | preflight`).
- **Bucketing**: mapeo de severity 1–10 a 3 niveles para UI.
- **Forward compat**: característica del diseño que permite agregar 4.15/4.16
  sin tocar el schema.

---

## Anexo A · Cómo retomar en una sesión nueva

Si retomamos en una conversación distinta:

1. Leer este doc completo (~10 min). Empezar por §3 (decisiones resueltas) y §15 (tracker).
2. Mirar qué step está en progreso o cuál es el próximo `[ ]`.
3. Si hay alguna `Q-X` resuelta entre sesiones, actualizar §4 con la decisión + razón.
4. Continuar desde el step indicado en §11.

Si surge una decisión nueva durante la implementación:

- Si se resuelve: agregar a §3 con ID `D-N` y razón breve.
- Si queda abierta: agregar a §4 con ID `Q-N` y opciones.

Si el diseño cambia drásticamente (ej. decidimos no hacer recap):

- Marcar el step relevante como `~~tachado~~` en §11 y §15.
- Agregar nota en §3 con la decisión y razón.
- No borrar contenido — la historia ayuda a entender por qué después.

claude --resume 5ef0b126-bf53-4c52-a93f-46ece04e1530
