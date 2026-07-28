# IronLog — Onboardings ricos pendientes

> Lista de features que en v1 se activan vía un **prompt simple** (modal o
> banner según importancia, ver `feature-discovery.md`) y que en v2 deberían
> pasar a un **onboarding visual con animaciones** (coach marks, microcopy
> persuasivo, preview de la feature en uso).
>
> Doc complementario: `feature-discovery.md` (catálogo central de qué se
> ofrece, cuándo y cómo en v1).
>
> Este doc es el backlog de **v2 polish**. Cuando llegue ese sprint, esta
> lista es el plan.

---

## Cómo funciona la dualidad popup → onboarding

En v1, cualquier feature opt-in que requiera consentimiento informado del usuario muestra un **popup minimal**:

```
┌────────────────────────────────────────┐
│   ¿Querés activar [feature]?           │
│                                         │
│   [explicación breve de 2 líneas]      │
│                                         │
│   [ Más tarde ]      [ Activar ]       │
└────────────────────────────────────────┘
```

El usuario decide y la decisión se guarda en `Profile`.

En v2, ese popup se reemplaza por un **onboarding visual** dedicado: pantalla(s) con animaciones que muestran la feature en acción, coach marks señalando elementos en pantallas reales, microcopy que vende el valor antes de pedir el sí.

**El switch entre v1 y v2 es trivial** si lo planeamos bien:

- El trigger se centraliza en `shouldPromptForFeature(profile, feature)` que devuelve `true | false`.
- Cuando `true`, se renderiza el popup (v1) o el onboarding (v2). El sitio que lo invoca no cambia.
- Estado guardado en `Profile.notesPrefs.<feature>Enabled` (o equivalente por familia de features).
- Flag `<feature>PromptSeen` para no preguntar dos veces si declinó.

Eso es lo que se debe **diseñar desde v1** para que v2 sea un swap, no un refactor.

---

## Convenciones del onboarding rico (v2)

Cuando hagamos los onboardings ricos, todos respetan estas convenciones:

1. **Skipeable siempre**. Botón "Más tarde" o cerrar gesture. Imponer es anti-patrón.
2. **Máximo 3 pantallas / 30 segundos de leer**. Si no entra en eso, la feature es demasiado compleja para opt-in y tiene que ser core.
3. **Animación con propósito**. No animaciones decorativas — coach marks que apuntan a elementos reales, transiciones que muestran un cambio de estado, preview que ejecuta la feature en miniatura.
4. **Microcopy en 1ra persona del usuario**, no del producto. "Quiero recordar cómo me sentí" en vez de "IronLog te ayuda a registrar reflexiones".
5. **Cerrar con un CTA claro**. "Activar" o "Más tarde". Sin opciones intermedias.
6. **Idempotente**. Si el usuario completa pero no decide, el estado queda como "no preguntado todavía" — la próxima oportunidad legítima vuelve a aparecer.
7. **Reversible desde settings**. Sea cual sea la decisión, settings tiene un toggle para cambiarla.
8. **Localizable**. Aunque hoy solo esté en español, el copy va en constantes — no hardcoded en JSX.

---

## Convención de archivos

- Cada onboarding rico vive en `app/onboarding/feature/<feature-id>.tsx`.
- Su popup v1 vive en `components/<area>/<Feature>OptInPopup.tsx` (ej. `components/notes/RecapOptInPopup.tsx`).
- Componentes reutilizables (highlight de zona, coach mark, slide indicator) van a `components/onboarding/`.
- Tracking de "qué vio el usuario" en `Profile.onboardingsSeen?: string[]`.

---

## Backlog de features para onboarding rico

### O-1 · Recap reflexivo post-workout

**Origen**: `notes-system.md` D-11.
**Feature**: ROADMAP §4.13.

**v1 (popup)**:

- Trigger: después de la **primera sesión completada**.
- Copy: *"¿Querés que después de cada entreno te haga 3 preguntas rápidas para registrar cómo te sentiste? Tarda menos de 30 segundos y te ayuda a ver patrones (energía vs PRs, dolor vs ejercicios)."*
- CTAs: `Activar` / `Más tarde`.
- Estado: `Profile.notesPrefs.recapEnabled`, `Profile.notesPrefs.recapPromptSeen`.

**v2 (onboarding rico)**:

- 2 pantallas:
  1. **"Lo que se pierde sin recap"** — animación que muestra una sesión cerrándose sin captura. Texto: "Tu energía, dolor, satisfacción se van con la sesión." Ilustración fade-out.
  2. **"Lo que el recap te da"** — preview en vivo: usuario virtual completa el recap, después se muestra un mini-insight ("tus mejores sesiones son con energía 'alta'"). Texto: "30 segundos hoy = data útil mañana."
- CTA final: `Activar recap` / `Más tarde`.
- Animaciones: Reanimated 3, transiciones slide horizontal entre pantallas, fade del texto encadenado.

**Trade-off conocido**: la versión v2 va a tomar 2-3 días de trabajo entre diseño + animaciones. Solo justifica si en v1 vemos que la adopción del feature es baja (<30%) y queremos empujarla.

---

### O-2 · Pre-workout Factor X

**Origen**: `notes-system.md` D-11 (extensión de Q-2 cuando se cierre).
**Feature**: ROADMAP §4.14.

**v1 (popup)**:

- Trigger: antes del **primer entreno** post-instalación.
- Copy: *"¿Te preguntamos cómo dormiste y cuánta energía tenés antes de cada entreno? 10 segundos. Te muestra después qué factores hacen tus mejores sesiones."*
- CTAs: `Activar` / `Más tarde`.
- Estado: `Profile.notesPrefs.preflightEnabled`, `Profile.notesPrefs.preflightPromptSeen`.

**v2 (onboarding rico)**:

- 2 pantallas:
  1. **"El factor invisible"** — animación: dos sesiones idénticas (mismo plan, mismos pesos) con resultados distintos. Texto: "¿Por qué un día le metés y otro no?"
  2. **"Factor X revela el patrón"** — preview de 5 sesiones acumuladas con sus respuestas pre-workout, después un insight: "Tus PRs de squat son con sueño 'bien' y energía 'alta' (89% vs 23%)."
- CTA: `Activar Factor X` / `Más tarde`.

---

### O-3 · Voice notes (cuando se haga 4.15)

**Origen**: ROADMAP §4.15.
**Feature**: voice notes hands-free durante la sesión.

**v1 (popup)**:

- Trigger: primera vez que el usuario abre el NoteSheet completo después de tener 4.15 disponible.
- Copy: *"¿Te dejamos grabar notas de voz durante la sesión? Más rápido que tipear con manos sudadas. La grabación queda en tu teléfono, nunca se sube."*
- CTAs: `Activar voz` / `Más tarde`.
- Permiso de mic queda asociado al opt-in.

**v2 (onboarding rico)**:

- 1 pantalla con preview animado: el botón flotante 🎙 aparece con highlight, simulación de hold-to-record con waveform, transcript automático apareciendo. Texto: *"Decí lo que sentís entre series. Sin teclado."*
- CTA: `Activar` / `Más tarde`.

**Trade-off**: voice tiene fricción de permiso adicional (mic). El onboarding v2 puede ayudar a reducir el rechazo del permiso explicándolo antes de que iOS lo pida.

---

### O-4 · Health timeline (cuando se haga 4.16)

**Origen**: ROADMAP §4.16.
**Feature**: body map de molestias activas + timeline.

**v1 (popup)**:

- Trigger: primera vez que el usuario alcanza ≥3 notas de pain en su data.
- Copy: *"Detectamos que llevás registradas algunas molestias. ¿Querés ver el resumen visual? Mapa del cuerpo + timeline. Útil para vos y para llevar al kine."*
- CTAs: `Ver` (lleva a la pantalla) / `Más tarde`.

**v2 (onboarding rico)**:

- 1 pantalla con preview del body map en vivo (con la data del propio usuario), zoom-in a la zona más mencionada, timeline animada de severity over time. Texto: *"Tu cuerpo, en datos."*
- CTA: `Abrir mapa` / `Más tarde`.

**Particularidad**: este onboarding **necesita data real** para ser efectivo. Si el usuario tiene 0 notas, el onboarding está vacío. Por eso se dispara recién con ≥3 notas — el onboarding muestra **lo del usuario**, no un demo genérico.

---

## Cómo agregar un nuevo onboarding a este doc

Cuando aparezca otra feature opt-in que merezca este tratamiento:

1. Agregar entrada `O-N` siguiendo la plantilla:

   ```
   ### O-N · <nombre>

   **Origen**: <doc o decisión que lo motivó>.
   **Feature**: ROADMAP §X.Y.

   **v1 (popup)**:
   - Trigger: ...
   - Copy: ...
   - CTAs: ...
   - Estado: ...

   **v2 (onboarding rico)**:
   - <N pantallas con descripción>
   - CTA final: ...
   ```

2. Asegurar que el helper `shouldPromptForFeature(profile, "<feature-id>")` cubre el nuevo trigger.
3. Reservar el espacio en `Profile.notesPrefs` (o el namespace correspondiente) con los flags de estado.
4. En el doc de la feature original, dejar referencia cruzada (`cf. future-onboardings.md O-N`).

---

## Anti-patterns a evitar

- ❌ Forzar el onboarding sin botón "Más tarde". Convierte la app en hostil.
- ❌ Onboarding de 5+ pantallas. La gente lo skipea entero. Si tu feature requiere 5 pantallas para venderse, la feature es el problema.
- ❌ Animaciones "de adorno" sin propósito comunicativo. Burnea ciclos de batería para nada.
- ❌ Pedir permisos del SO (mic, location) **dentro** del onboarding sin pre-explicación. Bumpea el rechazo del permiso. Mejor: onboarding → CTA "Activar" → recién ahí el SO pide permiso.
- ❌ Onboarding que muestra data genérica cuando el usuario ya tiene la suya. Usar la data real del usuario siempre que sea posible.
- ❌ Dos onboardings consecutivos en la misma sesión. Diluye atención. Espaciar.
