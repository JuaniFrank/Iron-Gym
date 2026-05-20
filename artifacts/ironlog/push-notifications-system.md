# IronLog — Push Notifications + Rest Timer Background (diseño + plan)

> Doc de trabajo para implementar el **RestTimer en background**, **push
> notification al terminar el descanso**, **botón pin sticky** y los
> **settings asociados** (sonido, tipo de notificación).
>
> Fuera del scope del batch de "feature-fixes" actual — se trackeó acá
> porque es la feature más grande de esa lista y conviene tener su propio
> doc operativo.
>
> Fuente de verdad del diseño. Si retomamos en otra sesión, leyendo este
> doc se puede continuar sin contexto previo. Cuando la feature esté
> shipped, este doc se borra (convención `*-system.md` / `*-integration.md`
> = soporte operativo, no archivo histórico).

---

## Índice

1. [Contexto y problema actual](#1-contexto-y-problema-actual)
2. [Scope](#2-scope)
3. [Decisiones resueltas](#3-decisiones-resueltas)
4. [Decisiones abiertas](#4-decisiones-abiertas)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Arquitectura](#6-arquitectura)
7. [UX y pantallas](#7-ux-y-pantallas)
8. [Plan de implementación](#8-plan-de-implementación)
9. [Edge cases](#9-edge-cases)
10. [Testing](#10-testing)

---

## 1. Contexto y problema actual

`components/workout/RestTimer.tsx` usa `useState(durationSeconds)` + `setInterval(r → r-1)`. Tres problemas:

1. **No corre en background.** Cuando el user minimiza la app o bloquea el teléfono, el `setInterval` se pausa (React Native no garantiza ejecución JS en background). Al volver a foreground, el contador retoma desde donde quedó — no desde el tiempo real transcurrido.
2. **No avisa cuando termina.** Si el user está fuera de la app, no se entera de que terminó el descanso. Tiene que estar mirando.
3. **No es sticky.** El RestTimer vive dentro del `ScrollView` de la sesión activa (`active.tsx:305-313`). Si el user scrollea para mirar el próximo ejercicio, pierde la vista del timer.

## 2. Scope

**Dentro del scope:**

- Timer basado en `endsAt` timestamp (no n−1 por segundo).
- AppState listener: al volver de background, recalcular `remaining` con `Date.now()`.
- Local notification (sonido + opcional banner) scheduled al iniciar el rest.
- Botón **pin** al lado de la X del header del RestTimer; cuando está pinneado, el timer queda flotando arriba (sticky).
- Pantalla **Settings → Descanso**:
  - Toggle "Notificación al terminar descanso" (default ON).
  - Picker "Tipo de notificación" (solo sonido / sonido + banner).
  - Picker "Sonido" (default iOS / "Tira" / 2-3 más).
- Permisos: `Notifications.requestPermissionsAsync()` la primera vez que se inicia un rest después de instalar la feature. Si denied → fallback a solo animación visual.

**Fuera del scope (para futuro):**

- Sonidos custom externos (.caf grabados por el user).
- Notificaciones cuando termina la sesión completa.
- Smartwatch / Live Activity (iOS).
- Sincronización del estado del timer entre devices.

## 3. Decisiones resueltas

| ID | Decisión | Razón |
|----|----------|-------|
| PN-1 | `endsAt` timestamp como fuente de verdad, no `remaining` por segundo. | Sobrevive background/foreground sin acumular drift. |
| PN-2 | `expo-notifications` (no `expo-task-manager` / background fetch). | Suficiente para schedule+fire. Background tasks son innecesarias acá. |
| PN-3 | Cancelar el schedule cuando el user cierra el timer o completa el siguiente set. | Evitar notificaciones zombi. |
| PN-4 | Si la app está en foreground y el timer está visible → no banner, solo sonido + pulse animation. | Evitar ruido visual cuando el user ya está mirando. |
| PN-5 | Settings live en `app/settings.tsx` (linked desde `(tabs)/more.tsx`). | Ruta existente. |
| PN-6 | Pin state es ephemeral (per-session, no persiste). | El user pin/unpin según necesidad de la serie. |
| PN-7 | Si el user pin-uea con timer corriendo y luego cierra el timer, el state de pin se mantiene para el próximo rest. | Asume preferencia por el resto de la sesión. |

## 4. Decisiones abiertas

| ID | Pregunta | Estado |
|----|----------|--------|
| PN-Q1 | ¿Cuáles son los 3-5 sonidos default? "Tira" mencionada por user, los demás TBD. | Pendiente — investigar qué presets razonables hay y qué se puede shipear sin licencias raras. |
| PN-Q2 | Cuando el user denies permisos, ¿offer reintento desde Settings? | Pendiente — probablemente sí (link a Settings system con `Linking.openSettings()`). |
| PN-Q3 | ¿El pin sticky usa `position: absolute` con z-index sobre el scroll, o `stickyHeaderIndices` del ScrollView? | Pendiente — probar ambos; el primero es más simple, el segundo más nativo. |

## 5. Modelo de datos

### Nueva tabla `user_profile` extension (o `key_value` row)

Persistir config en una sola row. Schema sugerido:

```ts
// schema/sqlite/user_profile.ts — añadir columnas:
restNotificationEnabled: integer("rest_notification_enabled", { mode: "boolean" }).default(true).notNull(),
restNotificationType: text("rest_notification_type").default("sound_only").notNull(), // "sound_only" | "rich"
restNotificationSound: text("rest_notification_sound").default("default").notNull(),
```

Migration aditiva (`0002_*.sql`). Default values garantizan que usuarios existentes no rompan nada.

### State runtime (no persiste)

```ts
// app/workout/active.tsx
const [restingEndsAt, setRestingEndsAt] = useState<number | null>(null);
const [restingPinned, setRestingPinned] = useState(false);
const restingNotifIdRef = useRef<string | null>(null);
```

## 6. Arquitectura

### RestTimer.tsx (refactor)

```ts
interface RestTimerProps {
  endsAt: number;              // timestamp absoluto
  onComplete?: () => void;
  onClose?: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  // paused/resume: si el user pausa, congelar endsAt con pausedDelta
}

// Internals:
const [now, setNow] = useState(Date.now());
const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

useEffect(() => {
  const id = setInterval(() => setNow(Date.now()), 250);  // 250ms para UI smooth
  return () => clearInterval(id);
}, []);

useEffect(() => {
  const sub = AppState.addEventListener("change", (s) => {
    if (s === "active") setNow(Date.now());
  });
  return () => sub.remove();
}, []);

// onComplete trigger — fire una sola vez cuando remaining === 0
const firedRef = useRef(false);
useEffect(() => {
  if (remaining === 0 && !firedRef.current) {
    firedRef.current = true;
    onComplete?.();
  }
}, [remaining, onComplete]);
```

### active.tsx (orchestration)

```ts
const handleLogSet = (w, r, rpe, row) => {
  logSet(...);
  if (!row.isWarmup) {
    const endsAt = Date.now() + restSeconds * 1000;
    setRestingEndsAt(endsAt);
    scheduleRestNotification(endsAt, restConfig).then(id => restingNotifIdRef.current = id);
  }
};

const handleRestComplete = () => {
  // pulse animation visual si está en foreground
  // sonido fire (notification handler en foreground lo deja sonar)
  setRestingEndsAt(null);
};

const handleCloseRest = () => {
  if (restingNotifIdRef.current) {
    Notifications.cancelScheduledNotificationAsync(restingNotifIdRef.current);
    restingNotifIdRef.current = null;
  }
  setRestingEndsAt(null);
};
```

### services/notifications.ts (nuevo)

```ts
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: AppState.currentState !== "active",
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status: requested } = await Notifications.requestPermissionsAsync();
  return requested === "granted";
}

export async function scheduleRestNotification(
  endsAt: number,
  config: RestNotificationConfig,
): Promise<string | null> {
  if (!config.enabled) return null;
  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  const secondsUntil = Math.max(1, Math.round((endsAt - Date.now()) / 1000));
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Descanso terminado",
      body: "A la siguiente serie",
      sound: config.sound === "default" ? "default" : `${config.sound}.caf`,
    },
    trigger: { seconds: secondsUntil },
  });
}
```

### Sticky pin (active.tsx)

Cuando `restingPinned && restingEndsAt`, montar el RestTimer FUERA del ScrollView en un `View` con position absolute (top: insets.top + 70 aprox, debajo del header). Cuando no pinneado, queda inline en el scroll (como hoy).

## 7. UX y pantallas

### Settings → Descanso

Sección nueva en `app/settings.tsx`:

```
DESCANSO
├── Notificación al terminar  [Toggle ON]
├── Tipo de notificación      [Solo sonido ▼]
└── Sonido                    [Default ▼]
```

Si toggle OFF → ocultar los dos sub-pickers.

### Botón pin en RestTimer

Header row actual: `[· DESCANSO]                          [X]`.
Después: `[· DESCANSO]               [pin] [X]`.

Ícono `Feather name="pin"` (no pinneado) / `"pin"` rotado o `"bookmark"` (pinneado). Color sutil, igual que la X actual.

### Animación on-complete (foreground)

Pulse: `Animated.sequence([scale(1.04, 120ms), scale(1, 180ms)])` repetido 2 veces. Border del container cambia de transparente a `colors.accent` durante la animación.

## 8. Plan de implementación

- [ ] **PN-1.** Instalar `expo-notifications` (`pnpm expo install expo-notifications`).
- [ ] **PN-2.** `services/notifications.ts` con setHandler, ensurePermissions, schedule, cancel.
- [ ] **PN-3.** Schema migration (`user_profile` columnas) + mutator `updateRestNotificationConfig` + query `useRestNotificationConfig`.
- [ ] **PN-4.** Refactor `RestTimer.tsx` a timestamp-based + AppState listener.
- [ ] **PN-5.** Integrar schedule/cancel en `active.tsx` (`handleLogSet`, `handleCloseRest`).
- [ ] **PN-6.** Pin button en RestTimer header + state `restingPinned` en active.tsx.
- [ ] **PN-7.** Sticky overlay rendering cuando pinned.
- [ ] **PN-8.** Pulse animation on-complete cuando foreground.
- [ ] **PN-9.** Section "Descanso" en `app/settings.tsx`.
- [ ] **PN-10.** Permission request flow + fallback denied.
- [ ] **PN-11.** Testing manual en device físico (notifs no funcionan en simulador iOS).

## 9. Edge cases

- App killed (force-quit) durante un rest → la notification scheduled SIGUE disparando (es a nivel OS). Al reabrir la app, el `restingEndsAt` se perdió (no persistimos active session state). Decisión: aceptable — el user igual recibió el aviso. Si querés ser estricto, persistir `restingEndsAt` en `key_value` y restaurar al boot.
- Multiple rests acumulados (user marca varias series rápido) → cancelar el schedule anterior antes de hacer schedule nuevo.
- Permisos denied → no schedule, solo pulse + sonido in-app (via `expo-av` o haptic fuerte como fallback).
- Phone en modo silencio → iOS respeta el switch; el sonido no se reproduce. Workaround: `priority: "high"` en el trigger + haptic. Documentar como limitación.
- User pausa el timer con +15/−15 ajustes → recalcular `endsAt` y rescheduler la notificación.

## 10. Testing

Manual (no automatable porque depende del OS):

1. Iniciar serie, dejar app abierta → al final: sonido + pulse, NO banner.
2. Iniciar serie, minimizar → al final: banner + sonido en home screen.
3. Iniciar serie, force-quit la app → al final: banner + sonido (notification persistió).
4. Pin → scroll → timer sigue visible arriba.
5. Toggle off en Settings → no banner, no sonido (solo haptic).
6. Settings → cambiar sonido a "Tira" → siguiente rest usa ese sonido.
7. Denied permisos → fallback OK, no crashes.

## 11. Tracker

Status: `[ ]` design done, `[~]` impl en progreso, `[x]` shipped.

`[ ]` Todo lo de §8 PN-1..PN-11.

Cuando todo esté en `[x]` y el user lo haya probado en su iPhone real, **este doc se elimina**.
