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
| PN-4 | Si la app está en foreground → handler suprime banner y `shouldPlaySound=false`. El RestTimer hace pulse + haptic in-app. | Evitar ruido visual y doble-sonido cuando el user ya está mirando. |
| PN-5 | Settings live en `app/settings.tsx` (linked desde `(tabs)/more.tsx`). | Ruta existente. |
| PN-6 | Pin state es ephemeral (per-session, no persiste). | El user pin/unpin según necesidad de la serie. |
| PN-7 | Si el user pin-uea con timer corriendo y luego cierra el timer, el state de pin se mantiene para el próximo rest. | Asume preferencia por el resto de la sesión. |
| PN-8 | Sticky overlay = `position: absolute` con `zIndex: 10`, fuera del ScrollView. ScrollView aplica `paddingTop: 240` cuando hay timer pinned. | Más simple que `stickyHeaderIndices`; no condiciona la estructura del ScrollView. |
| PN-9 | Pause/resume y ±15 ajustan `effectiveEndsAt` interno y llaman `onReschedule(newEndsAt)` al parent, que cancela el push viejo y schedule el nuevo. | Una sola fuente de verdad temporal entre RestTimer y push schedule. |
| PN-10 | v1 ship con 2 opciones de sonido: "Sistema" (default del OS) y "Silencioso" (sin sonido, solo haptic + pulse). | MVP — la librería de tonos custom queda para PN-Q1 (deferred). |
| PN-11 | Copy de la notificación rica: título "¡Vamos!", body "Toca la siguiente serie 💪". Solo sonido: título "Descanso terminado" sin body. | Tono motivacional elegido por el user. |
| PN-12 | Migration aditiva en `user_profile` (`rest_notification_enabled` default true, `rest_notification_type` default "rich", `rest_notification_sound` default "default"). | Sin breaking changes. Usuarios existentes obtienen defaults razonables al primer boot post-migration. |

## 4. Decisiones abiertas

| ID | Pregunta | Estado |
|----|----------|--------|
| PN-Q1 | Librería de sonidos custom (3-5 .wav royalty-free) para el picker en Settings. | DEFERRED — arquitectura lista. Pasos: (1) sourcear .wav CC0, (2) ubicar en `assets/sounds/`, (3) agregar al plugin de `app.json`: `["expo-notifications", { "sounds": ["./assets/sounds/chime.wav", ...] }]`, (4) extender el enum `restNotificationSound` y la SegmentedControl en `settings.tsx`. Migration aditiva si se agregan nuevos valores enum. |

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

- [x] **PN-1.** Instalado `expo-notifications ~0.32.17` + plugin entry en `app.json` con `icon` + `color`.
- [x] **PN-2.** `services/notifications.ts` con `setNotificationHandler` (suprime banner en foreground), `ensureNotificationPermissions`, `getNotificationPermissionStatus`, `scheduleRestNotification`, `cancelRestNotification`. Android channel `rest-timer` con `HIGH` importance.
- [x] **PN-3.** Migration `0003_tricky_hulk.sql` aditiva: `rest_notification_enabled`, `rest_notification_type`, `rest_notification_sound`. Mutator `updateRestNotificationConfig` en `profile/mutators.ts`. Query `useRestNotificationConfig` en `profile/queries.ts`.
- [x] **PN-4.** `RestTimer.tsx` refactorizado: props `endsAt` + `durationSeconds`, AppState listener para snap `now` al volver de background, internal `effectiveEndsAt` para pause+adjust shifts.
- [x] **PN-5.** `startRest`, `closeRest`, `rescheduleRest` en `active.tsx`. `onLogSet → startRest(restSeconds)`.
- [x] **PN-6.** Botón pin (MaterialCommunityIcons `pin` / `pin-outline`) en el header del RestTimer al lado de la X. State `restingPinned` en active.tsx.
- [x] **PN-7.** Sticky overlay: cuando `restingPinned && restingEndsAt`, el `<RestTimer />` se renderiza fuera del ScrollView con `position: absolute, top: insets.top + 60, zIndex: 10`. ScrollView aplica `paddingTop: 240` cuando hay pin activo.
- [x] **PN-8.** Pulse animation con `Animated.Value` (scale 1 → 1.04 → 1 → 1.04 → 1) + glow border interpolation. Solo dispara si `AppState.currentState === "active"`.
- [x] **PN-9.** Sección "NOTIFICACIÓN AL TERMINAR" dentro del card "Descanso por defecto" en `app/settings.tsx`. Toggle enabled + SegmentedControl tipo + SegmentedControl sonido.
- [x] **PN-10.** Permission flow: chequeo on-mount via `getNotificationPermissionStatus`. Botón "Pedir permisos ahora" si undetermined; CTA "Abrir ajustes del sistema" via `Linking.openSettings()` si denied.
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

Status: `[!]` BLOQUEADO por limitación del **free Apple ID provisioning** usado vía AltStore sideload. PN-1..PN-10 implementados en código, pero el flow de runtime se cae con "Cannot find native module 'ExpoPushTokenManager'".

### Causa real (diagnóstico correcto 2026-05-20)

Free Apple ID provisioning **NO permite el entitlement `aps-environment`** (requerido para que Apple emita un push token via APNs). expo-notifications, al cargar su JS, inicializa `ExpoPushTokenManager` unconditionally — y el módulo nativo falla al registrarse cuando el entitlement no está presente. Eso lanza el error desde código interno del propio expo-notifications, NO desde nuestro `import()`, por eso no se podía catchear con try/catch desde JS.

Limitaciones del free Apple ID provisioning (relevantes acá):
- Sin `aps-environment` → sin push notifications.
- Sin iCloud, Associated Domains, In-App Purchases, varios capabilities premium.
- Builds expiran a los 7 días (vs 1 año con cuenta paga).

### Mitigación aplicada

`services/notifications.ts` es ahora un STUB que devuelve null/false para todo (cf. cabecera del archivo). La feature de push queda OFF. El RestTimer sigue funcionando 100% local — haptic + pulse animation al llegar a 0. Lo único que se pierde es el banner cuando la app está en background.

PN-11 (testing manual en device de push real) queda pendiente hasta resolver el provisioning.

## 12. Re-habilitar push (cuando lo retomemos)

Tres caminos, de menor a mayor friction:

### Opción A — Switchear a `@notifee/react-native` (sin Apple Developer pago)

Notifee es lib dedicada de **local notifications** (no toca remote push / APNs). No requiere `aps-environment`, por ende anda con free Apple ID. Trade-off:
- Otra dep nativa más → rebuild full.
- Refactorear `services/notifications.ts` — pero las 4 funciones públicas (`schedule`, `cancel`, `ensurePerms`, `getStatus`) se mantienen igual, solo cambia el cuerpo.
- Compat con new arch + iOS + Android, mantenido activamente.

Probablemente es la opción correcta para este caso (app personal, sideloaded).

### Opción B — Apple Developer Program (USD 99/año)

Te emite certs con `aps-environment` válido → expo-notifications anda out-of-the-box. También:
- Builds duran 1 año en lugar de 7 días (no más sideload semanal).
- TestFlight como alternativa a AltStore.
- EAS Build → `.ipa` listo sin tocar Xcode.

Si la app evoluciona a algo "para más gente", esta opción se justifica sola.

### Opción C — Quedarnos sin push

El RestTimer ya funciona con haptic + pulse. El push solo serviría si querés saber que terminó el descanso con la app cerrada o el teléfono bloqueado. Si no es crítico para el uso diario, dejar el stub indefinidamente es válido.

**Cuando se reactive**: la implementación real está en git history del commit que introdujo el stub — `git show <commit>:artifacts/ironlog/services/notifications.ts` para recuperarla y adaptar a la nueva lib si fue A.

Cuando PN-11 se valide en device físico y la librería de sonidos PN-Q1 se ship-ee, **este doc se elimina**.

## 12. Cómo extender (próxima iteración)

### Agregar 3-5 sonidos custom

1. **Sourcear** 3-5 archivos `.wav` (cortos, < 2s, formato 44.1 kHz PCM) CC0 desde Pixabay/Freesound. Naming sugerido: `chime.wav`, `ding.wav`, `pulse.wav`.
2. **Ubicar** en `artifacts/ironlog/assets/sounds/`.
3. **Configurar** en `app.json`:
   ```json
   ["expo-notifications", {
     "icon": "./assets/images/icon.png",
     "color": "#D7FF5F",
     "sounds": ["./assets/sounds/chime.wav", "./assets/sounds/ding.wav", "./assets/sounds/pulse.wav"]
   }]
   ```
4. **Extender el enum** `restNotificationSound` en `lib/db/src/schema/sqlite/user_profile.ts`:
   ```ts
   text("rest_notification_sound").$type<"default" | "silent" | "chime" | "ding" | "pulse">()
   ```
5. **Generar migration** con `pnpm --filter @workspace/db db:generate:sqlite` (no necesita data migration, solo el tipo).
6. **Actualizar** el `SegmentedControl` en `app/settings.tsx` con las nuevas opciones — considerar reemplazar SegmentedControl por un Picker/Sheet si hay más de 4-5 opciones.
7. **Pasar el sound name** en `services/notifications.ts` → `scheduleNotificationAsync({ content: { sound: "chime" } })`. Android lee el channel sound, iOS lee el `sound` field directamente (sin extensión). El plugin de Expo se encarga del bundling.

### Persistir el pin state

Si el user pidiera que el pin sea persistente entre sesiones, añadir una row en `key_value` con clave `rest_pin_default` (bool). Leerla en active.tsx al mount inicial del RestTimer; setear cada toggle.
