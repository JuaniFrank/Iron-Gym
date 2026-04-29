# IronLog — Feature Discovery (catálogo central)

> Catálogo central de **descubrimiento progresivo de features**. Define qué
> features tienen prompt opt-in, cuándo se muestran (trigger), cómo se
> muestran (surface) y si requieren entitlement de premium.
>
> Decisión arquitectónica original: `notes-system.md` D-11 + D-12.
>
> Doc complementario: `future-onboardings.md` (versión rica v2 de los
> prompts).

---

## Por qué descubrimiento progresivo

Tres problemas que el patrón resuelve:

1. **Onboarding sobrecargado**. Si en la primera sesión preguntamos "¿activar
   recap?", "¿activar preflight?", "¿activar voice notes?", "¿activar body
   map?", el usuario abandona o dice no a todo por reflejo. Cada decisión es
   ruido cuando el contexto para valorar la feature todavía no existe.
2. **Adopción real vs decisión apurada**. Un user que ya hizo 5 sesiones tiene
   evidencia de que la app le sirve y vocabulario para entender qué es un
   "recap". El mismo prompt puesto al día 1 vs al día 7 tiene tasas de
   activación radicalmente distintas.
3. **Acoplamiento natural a premium gating**. Cada prompt puede mutar
   transparentemente a "Disponible en Pro" sin tocar la lógica de la app.
   Cuando llegue IAP (cf. conversaciones previas sobre RevenueCat), la
   transición es flip de un campo en este catálogo.

---

## Tipos centrales

```ts
// types/index.ts — extensiones para discovery

export type DiscoveryTrigger =
  | { kind: "sessions_completed"; count: number }
  | { kind: "notes_count"; count: number }
  | { kind: "pain_notes_count"; count: number }
  | { kind: "exercise_count"; count: number }
  | { kind: "days_since_install"; days: number };

export type DiscoverySurface = "modal" | "banner";

export type DiscoveryStatus =
  | "unseen"      // todavía no se cumplió el trigger o no se mostró
  | "shown"       // se mostró, esperando decisión
  | "activated"   // user dijo sí
  | "dismissed"   // user dijo no, no preguntar más
  | "snoozed";    // user dijo "más tarde", reintenta en N días

export interface FeatureDiscoveryState {
  featureId: string;
  status: DiscoveryStatus;
  shownAt?: number;
  decidedAt?: number;
  /** Si "snoozed": cuándo volver a ofrecer. */
  snoozeUntil?: number;
}

/** Definición estática de un feature en el catálogo. Hardcoded en código. */
export interface FeatureDiscoveryDef {
  /** ID único, persistido. Nunca cambiar después de release. */
  featureId: string;
  /** Display name en el prompt. */
  title: string;
  /** Tagline corto debajo del título. */
  tagline: string;
  /** Body del prompt (1–2 párrafos). */
  description: string;
  /** Cuándo aparece. */
  trigger: DiscoveryTrigger;
  /** Cómo aparece. */
  surface: DiscoverySurface;
  /** Si requiere entitlement (v1: undefined siempre). */
  requiresEntitlement?: string;
  /** Pantalla a la que routear si user activa. */
  activationRoute?: string;
  /** Toggle key en settings. */
  settingsKey: string;
}
```

---

## Helpers (ubicación: `services/featureDiscovery.ts`)

```ts
import type {
  FeatureDiscoveryDef,
  FeatureDiscoveryState,
  UserProfile,
  WorkoutSession,
  SessionNote,
} from "@/types";
import { FEATURE_CATALOG } from "@/constants/featureCatalog";

/** Devuelve features que cumplen trigger y `status === "unseen"`. */
export function getEligibleDiscoveries(
  profile: UserProfile,
  sessions: WorkoutSession[],
  notes: SessionNote[],
): FeatureDiscoveryDef[] {
  return FEATURE_CATALOG.filter((def) => {
    const state = getStateFor(profile, def.featureId);
    if (!isPending(state)) return false;
    return triggerMet(def.trigger, sessions, notes);
  });
}

/** El primero pendiente — para mostrar uno a la vez. */
export function nextDiscovery(
  profile: UserProfile,
  sessions: WorkoutSession[],
  notes: SessionNote[],
): FeatureDiscoveryDef | null {
  return getEligibleDiscoveries(profile, sessions, notes)[0] ?? null;
}

function getStateFor(
  profile: UserProfile,
  featureId: string,
): FeatureDiscoveryState {
  return (
    profile.featureDiscoveries?.find((d) => d.featureId === featureId) ?? {
      featureId,
      status: "unseen",
    }
  );
}

function isPending(state: FeatureDiscoveryState): boolean {
  if (state.status === "unseen") return true;
  if (state.status === "snoozed" && state.snoozeUntil && Date.now() >= state.snoozeUntil) {
    return true;
  }
  return false;
}

function triggerMet(
  trigger: DiscoveryTrigger,
  sessions: WorkoutSession[],
  notes: SessionNote[],
): boolean {
  switch (trigger.kind) {
    case "sessions_completed":
      return sessions.filter((s) => s.endedAt).length >= trigger.count;
    case "notes_count":
      return notes.length >= trigger.count;
    case "pain_notes_count":
      return notes.filter((n) => n.category === "pain").length >= trigger.count;
    case "exercise_count": {
      const uniqueExercises = new Set(
        sessions.flatMap((s) => s.sets.map((set) => set.exerciseId)),
      );
      return uniqueExercises.size >= trigger.count;
    }
    case "days_since_install": {
      const installDate = profile.onboardedAt ?? Date.now();
      return (Date.now() - installDate) / (1000 * 60 * 60 * 24) >= trigger.days;
    }
  }
}
```

---

## Premium gating (D-12)

El gate es centralizado en `services/entitlements.ts`:

```ts
export function hasEntitlement(profile: UserProfile, name: string): boolean {
  // v1: todo free.
  // v2: integrar con RevenueCat. Cache local en profile.entitlements.
  return true;
}
```

En el prompt:

```ts
import { hasEntitlement } from "@/services/entitlements";

function FeatureDiscoveryPrompt({ def, profile }: Props) {
  if (def.requiresEntitlement && !hasEntitlement(profile, def.requiresEntitlement)) {
    return <PremiumLockedPrompt def={def} />;
  }
  return <RegularDiscoveryPrompt def={def} />;
}
```

Esto significa que cuando llegue IAP, el único cambio es:

1. Implementar `hasEntitlement` real (chequeo de RevenueCat + cache).
2. Marcar `requiresEntitlement: "pro"` en las defs del catálogo que correspondan.

Cero cambios en sitios de uso.

---

## Surfaces

### Modal (alto valor)

Aparece como bottom sheet (estilo de los sheets actuales del repo, ej. `BulkColumnSheet`):

```
┌───────────────────────────────────┐
│  ▔▔▔                               │
│                                     │
│  ✨  DESCUBRÍ                       │
│                                     │
│  Recap reflexivo                    │
│  30 segundos para mejorar           │
│  tus entrenos                       │
│                                     │
│  Después de cada sesión te          │
│  preguntamos cómo te sentiste,      │
│  si tuviste alguna molestia, y      │
│  algo que querés recordar.          │
│  Vamos viendo tus patrones.         │
│                                     │
│  [ Más tarde ]   [   Activar  ]    │
│                                     │
│         No mostrar más              │
└───────────────────────────────────┘
```

Bloquea el flujo. Aparece después de cerrar la pantalla relevante (post-summary para recap, post-tap "Empezar" para preflight).

### Banner (descubrimiento secundario)

Card pequeña en home, dismissible, no bloquea:

```
┌─────────────────────────────────────┐
│  ✨  Descubrí Voice Notes →         │
│      Grabá notas durante tu serie    │
└─────────────────────────────────────┘
```

Tap en la card → modal con detalles + CTA. Tap en X → dismissed.

---

## Catálogo de features

Hardcoded en `constants/featureCatalog.ts`:

```ts
export const FEATURE_CATALOG: FeatureDiscoveryDef[] = [
  {
    featureId: "recap",
    title: "Recap reflexivo",
    tagline: "30 segundos para mejorar tus entrenos",
    description:
      "Después de cada sesión te preguntamos cómo te sentiste, si tuviste " +
      "alguna molestia, y algo que querés recordar. Vamos viendo tus " +
      "patrones.",
    trigger: { kind: "sessions_completed", count: 3 },
    surface: "modal",
    activationRoute: "/workout/recap",
    settingsKey: "recapEnabled",
  },
  {
    featureId: "preflight",
    title: "Factor X pre-entreno",
    tagline: "10 segundos antes de empezar",
    description:
      "Cómo dormiste, qué energía tenés, si hay algo distinto hoy. " +
      "Después te mostramos qué factores hacen tus mejores sesiones.",
    trigger: { kind: "sessions_completed", count: 5 },
    surface: "modal",
    activationRoute: "/workout/preflight",
    settingsKey: "preflightEnabled",
  },
  {
    featureId: "voice_notes",
    title: "Voice Notes",
    tagline: "Hablá lo que sentís entre series",
    description:
      "Activá el botón de micrófono durante la sesión. La grabación queda " +
      "en tu teléfono, nunca se sube. Más rápido que tipear con manos " +
      "sudadas.",
    trigger: { kind: "notes_count", count: 10 },
    surface: "banner",
    settingsKey: "voiceNotesEnabled",
  },
  {
    featureId: "body_map",
    title: "Mapa de molestias",
    tagline: "Tu cuerpo, en datos",
    description:
      "Visualizá todas tus molestias en un mapa interactivo. Útil para vos " +
      "y para llevar al kine. Filtrable por fecha y zona.",
    trigger: { kind: "pain_notes_count", count: 3 },
    surface: "banner",
    activationRoute: "/health-timeline",
    settingsKey: "bodyMapEnabled",
  },
];
```

---

## Reglas

1. **Un prompt a la vez**. Si dos triggers se cumplen el mismo día, mostrar
   solo el primero del array. El segundo aparece la próxima vez que el helper
   se consulte.
2. **Nunca dos modals consecutivos**. Si user acaba de decidir un modal,
   esperar al menos 1 sesión antes de ofrecer el siguiente.
3. **Snooze por default 7 días**. "Más tarde" agenda 7 días al futuro. Si
   user lo dismiseó 3 veces, marcar como `dismissed`.
4. **`featureId` es contrato**. Una vez en producción, no cambiar. Los IDs
   están en datos persistidos del usuario.
5. **Settings siempre tiene override**. Toggle por feature + "Resetear
   descubrimientos". El user que rechazó algo tiene que poder revertir sin
   reinstalar.
6. **Premium check antes de surface**. Si `requiresEntitlement` aplica y user
   no lo tiene, mostrar variante "Disponible en Pro" en vez del prompt
   normal.

---

## Cómo agregar un feature al catálogo

Cuando aparezca una feature nueva opt-in:

1. Definir su entrada en `constants/featureCatalog.ts`.
2. Asegurar que el componente que renderiza la feature consulta el estado:
   ```ts
   const featureActive = profile.featureDiscoveries?.find(
     (d) => d.featureId === "miFeature",
   )?.status === "activated";
   if (!featureActive) return null;
   ```
3. Sumar entrada a `future-onboardings.md` con su versión rica para v2.
4. Sumar toggle al `settings.tsx` correspondiente.
5. Si requiere entitlement futuro, dejar el campo definido (con valor real
   cuando el plan de monetización esté).

---

## Anti-patterns

- ❌ Hardcodear thresholds dispersos en componentes ("si sessions >= 3
  mostrar..."). Centralizar en el catálogo siempre.
- ❌ Mostrar más de un prompt por sesión. Diluye atención.
- ❌ Renombrar `featureId` después de release. Los datos persistidos del user
  no encuentran el match y "olvidan" su decisión.
- ❌ Marcar features como `requiresEntitlement` antes de tener el plan de
  monetización definido. Es prematuro y crea expectativas raras.
- ❌ Ofrecer un feature como "premium" sin tener forma de pagarlo. Si
  marcamos algo `requiresEntitlement: "pro"`, el paywall tiene que existir.
- ❌ Pedir permisos del SO (mic, location) **dentro** del prompt. Eso va
  después de "Activar" — separación entre consentimiento de feature vs
  permiso técnico.
- ❌ Triggers basados solo en tiempo (`days_since_install`) sin condición de
  uso. Un user que instaló y no abrió la app no debería recibir prompts.
  Combinar tiempo con uso si hace falta.

---

## Roadmap del catálogo

| Cuándo | Acción |
|---|---|
| Step 1 implementación notes (cf. notes-system.md) | Definir tipos + helpers + catálogo con 4 entries básicas. |
| Step 6 (recap) | Activar entry `recap`. Probar surface modal. |
| Step 7 (preflight) | Activar entry `preflight`. |
| Cuando se haga 4.15 (voice notes) | Activar entry `voice_notes`. Probar surface banner. |
| Cuando se haga 4.16 (body map) | Activar entry `body_map`. |
| Cuando llegue IAP | Implementar `hasEntitlement` real. Marcar las features que correspondan. Crear `PremiumLockedPrompt`. |
| Cuando llegue v2 polish | Reemplazar prompts por onboardings ricos (cf. `future-onboardings.md`). |
