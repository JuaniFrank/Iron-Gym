# IronLog — State management efímero

> Plan para separar el state efímero de UI (sheets abiertos, drafts, filtros)
> de los datos persistentes del dominio. Adopción de **Zustand** como store
> liviano por feature.
>
> **Ámbito**: este doc cubre UI state y patrones reactivos del lado cliente.
> Para la capa de datos persistente (SQLite + Drizzle, sync, backend) ver
> `db_system.md`.
>
> Doc vivo. ADR breve por decisión arquitectónica.

---

## Índice

1. [Concepto: state efímero vs persistente](#1-concepto-state-efímero-vs-persistente)
2. [Estado actual](#2-estado-actual)
3. [Por qué Zustand](#3-por-qué-zustand)
4. [Stack propuesto](#4-stack-propuesto)
5. [Patrones de uso](#5-patrones-de-uso)
6. [Cuándo Zustand vs DB](#6-cuándo-zustand-vs-db)
7. [Estructura de carpetas (state-relevant)](#7-estructura-de-carpetas-state-relevant)
8. [Plan de migración (Fase 4)](#8-plan-de-migración-fase-4)
9. [Testing](#9-testing)
10. [Advertencias y trade-offs](#10-advertencias-y-trade-offs)
11. [ADR-004 · Zustand para UI efímera](#11-adr-004--zustand-para-ui-efímera)
12. [Glosario](#12-glosario)

---

## 1. Concepto: state efímero vs persistente

Cualquier app tiene dos tipos de estado:

### Persistente (va a la DB)

Datos del dominio que sobreviven al cierre de la app y forman la "verdad" del usuario:

- Sets logueados, sesiones, rutinas.
- Notas, reflexiones, body measurements.
- Profile, goals macros, períodos.
- `activeWorkoutId` (si la app se cierra, querés recuperar la sesión en curso).

Este state vive en **SQLite + Drizzle** (cf. `db_system.md`). Reactivo vía `useLiveQuery`.

### Efímero (NO va a la DB)

Estado de UI que muere cuando el usuario sale de la pantalla o cierra la app:

- ¿Está abierto el `DaySwapSheet`?
- ¿Cuál es el ejercicio cuyo action sheet está abierto?
- Texto de un input mientras el usuario tipea (antes de submit).
- Estado de un wizard multi-paso (paso actual, datos parciales).
- Filtros activos en `progress.tsx`.
- Toggle "ver historial" en una card.
- Highlights / focus state en componentes complejos.

Este state hoy vive en `useState` local o, peor, dentro del `IronLogContext` mezclado con datos del dominio. La propuesta: moverlo a stores de **Zustand** por feature.

### Regla mental para clasificar

> **¿Si la app se cierra forzosamente, querés recuperar este dato? → DB.**
>
> Si la respuesta es "no, da igual" → Zustand o `useState` local.

---

## 2. Estado actual

### Cómo funciona hoy

- **Estado mezclado** en `IronLogContext`: `activeWorkoutId` (debería persistir, va a DB) coexiste con cosas que **deberían ser efímeras** (no las hay tanto en el context, pero el patrón se está armando ahí mal).
- **`useState` local** en componentes para sheets, modales, drafts, filtros. Funciona pero:
  - Genera prop drilling cuando el state se necesita en un componente lejano.
  - No hay separación clara de la "API" de UI state por dominio.
  - Componentes raíz como `(tabs)/index.tsx` se llenan de `useState` para coordinar sheets de sub-componentes.

### Ejemplos concretos en el repo (a 2026-04)

- `app/(tabs)/index.tsx` tiene `useState(swapOpen)` que pasa a `DaySwapSheet` por props.
- `app/workout/active.tsx` tiene varios `useState` para action sheets (`actionForExId`, `noteSheet`, `quickMenu`).
- `app/workout/summary.tsx` tiene `recapOffered`, `celebrate`, `shownIds`.
- `app/workout/plan.tsx` tiene `bulk` (estado del bulk column sheet).

Todos esos están en `useState` local. Funcionan, pero:
1. La lógica de "qué sheet está abierto" se acopla al componente raíz.
2. Si en el futuro otro componente quiere triggerear el mismo sheet, no puede sin refactor.
3. La testabilidad es nula — `useState` no se puede testear sin React.

---

## 3. Por qué Zustand

[Zustand](https://github.com/pmndrs/zustand) es una librería de ~500 LOC, sin Provider, basada en hooks. Características:

- **Sin Provider**: no contamina el árbol de componentes. Importás el hook y listo.
- **Selectors granulares**: cada componente se subscribe solo al slice que le interesa. Re-render fine-grained.
- **Sin boilerplate**: nada de actions/reducers. Mutaciones directas con `set()`.
- **Tipado completo en TS** sin generics complejos.
- **Compatible con DevTools** y middleware (persist, immer, etc.).

### Comparativa rápida

| | Context API | Redux Toolkit | Jotai | Zustand |
|---|---|---|---|---|
| Boilerplate | Bajo | Medio | Bajo | Muy bajo |
| Re-render granular | No (todos los consumers) | Sí (selectors) | Sí (atom-level) | Sí (selectors) |
| Provider | Sí | Sí | Sí | **No** |
| Testeabilidad sin React | Difícil | Sí | Difícil | **Sí** |
| Curva | Plana | Empinada | Media | **Plana** |
| Persist middleware | Manual | Vía addon | Manual | **Built-in** |
| Tamaño | n/a (built-in) | ~12 KB | ~3 KB | **~1 KB** |

Para IronLog: **Zustand encaja perfecto** — necesitamos stores chicas por feature, sin Provider hell, fáciles de testear.

---

## 4. Stack propuesto

| Pieza | Hoy | Propuesta |
|---|---|---|
| UI state efímero (sheets, modales, drafts) | `useState` local + Context global | **Zustand** stores chicas por feature |
| Coordinación entre features | Prop drilling o Context | **Zustand** o eventos custom (raros) |
| Persistencia de UI (rare cases) | n/a | **Zustand persist middleware** (ej. recordar última tab activa) |

### Dependencia a sumar

```bash
pnpm --filter @workspace/ironlog add zustand
```

A 2026, Zustand v4.x es estable. Sin dependencias transitivas. ~1 KB minified.

---

## 5. Patrones de uso

### 5.1 Store básico por feature

```ts
// domains/workout/ui.ts
import { create } from "zustand";

interface WorkoutUIStore {
  actionSheetExerciseId: string | null;
  swapSheetOpen: boolean;
  openActionSheet: (exId: string) => void;
  closeActionSheet: () => void;
  openSwapSheet: () => void;
  closeSwapSheet: () => void;
}

export const useWorkoutUI = create<WorkoutUIStore>((set) => ({
  actionSheetExerciseId: null,
  swapSheetOpen: false,
  openActionSheet: (exId) => set({ actionSheetExerciseId: exId }),
  closeActionSheet: () => set({ actionSheetExerciseId: null }),
  openSwapSheet: () => set({ swapSheetOpen: true }),
  closeSwapSheet: () => set({ swapSheetOpen: false }),
}));
```

### 5.2 Uso en componente con selector granular

```tsx
// Componente que solo necesita ABRIR el sheet:
const open = useWorkoutUI((s) => s.openActionSheet);

// Componente que solo necesita LEER el id activo:
const id = useWorkoutUI((s) => s.actionSheetExerciseId);

// Re-renderiza ÚNICAMENTE cuando el slice elegido cambia.
// Si otra parte del store muta (ej. swapSheetOpen), este componente no parpadea.
```

### 5.3 Selectors compuestos

Cuando necesitás múltiples slices, usá `useShallow` para comparación shallow:

```tsx
import { useShallow } from "zustand/react/shallow";

const { swapOpen, actionId } = useWorkoutUI(
  useShallow((s) => ({
    swapOpen: s.swapSheetOpen,
    actionId: s.actionSheetExerciseId,
  })),
);
```

### 5.4 Stores con persist (uso raro)

Para UI state que sí querés que sobreviva relaunches (ej. última tab activa, último filtro de progress):

```ts
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useProgressUI = create<ProgressUIStore>()(
  persist(
    (set) => ({
      timeRange: "30d",
      setTimeRange: (range) => set({ timeRange: range }),
    }),
    {
      name: "progress-ui",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

> **Cuidado**: este uso de AsyncStorage **no compite con la migración a SQLite**. Las preferencias de UI son pequeñas (KB), aceptables como key-value persistente. Los datos del dominio sí van a SQLite (cf. `db_system.md`).

### 5.5 Coordinación entre stores (cuando hace falta)

Zustand permite que un store lea otro. Útil para handlers que cruzan dominios:

```ts
import { useWorkoutUI } from "@/domains/workout/ui";

export const useNutritionUI = create<NutritionUIStore>((set) => ({
  // ...
  openFoodSheetAndCloseWorkoutAction: (foodId) => {
    useWorkoutUI.getState().closeActionSheet();
    set({ foodSheetOpen: true, activeFoodId: foodId });
  },
}));
```

Usar con cuidado — la regla es: **stores aislados por feature**. Coordinación cross-feature es señal de que la lógica debería estar en un mutator de dominio, no en UI state.

---

## 6. Cuándo Zustand vs DB

| Tipo de dato | Zustand | DB | Comentario |
|---|---|---|---|
| Sheet abierto / modal flag | ✓ | ✗ | Efímero por definición. |
| Filtro activo en progress | ✓ | ✗ (a menos que el user pida persistirlo) | Sobrevive a navegar entre tabs, muere al cerrar app. |
| Texto de un input mientras tipea | ✓ | ✗ | Drafts. La submit-action lo manda al mutator. |
| Tab activo de un segmented control | ✓ | ✗ | Salvo "última tab" como pref persistente con `persist`. |
| Set logueado | ✗ | ✓ | Dato del dominio. |
| Profile del usuario | ✗ | ✓ | Persistente y sync-relevant. |
| `activeWorkoutId` | ✗ | ✓ | Si crashea la app, querés recuperar la sesión. |
| Preferencia "rest timer auto-iniciar" | ✗ | ✓ (en `user_profile`) | Settings persistente, va a DB. |
| Estado de un wizard multi-paso | ✓ | ✗ | Si abandona, descartar. Si finaliza, los datos van al mutator → DB. |
| Toggle "ver historial" en una card | ✓ | ✗ | UX. |
| Wizard de onboarding (paso actual) | ✓ | ✗ | Los datos finales van a DB; el paso actual no. |

### Regla operativa

Si dudás:
1. ¿Si cerrás la app y la abrís 5 minutos después, querés ver el mismo valor? → DB.
2. ¿Si la app crashea, ese dato es importante recuperarlo? → DB.
3. Caso contrario → Zustand o `useState` local.

---

## 7. Estructura de carpetas (state-relevant)

Una sub-vista de la estructura completa propuesta en `db_system.md` §14, enfocada en state:

```
artifacts/ironlog/
  app/                       # rutas (sin lógica de negocio)
  components/                # UI puro, no importa de domains/<area>/ui
  domains/
    workout/
      queries.ts             # ← cf. db_system.md (DB layer)
      mutators.ts            # ← cf. db_system.md
      ui.ts                  # zustand store efímero (ESTE DOC)
      types.ts
    nutrition/
      ui.ts
    body/
      ui.ts
    schedule/
      ui.ts
    notes/
      ui.ts                  # ej. estado de NoteSheet/QuickMenu si se globaliza
    progress/
      ui.ts                  # filtros activos
    profile/
      ui.ts                  # ej. estado de wizards de onboarding
  contexts/
    ThemeContext.tsx         # queda — usa Context API (es UI puro y simple)
```

### Regla de imports

- `components/` y `app/` **pueden** importar de `domains/<area>/ui`.
- `domains/<area>/ui` **no debe** importar de `lib/db/` ni de mutators (los mutators son llamados desde la pantalla, no desde la UI store).
- Cross-feature (ej. `domains/workout/ui` lee `domains/nutrition/ui`): permitido pero raro. Si pasa seguido, es señal de que la lógica debería ir a un mutator de dominio.

---

## 8. Plan de migración (Fase 4)

Esta es la **Fase 4** del plan general (cf. `db_system.md` §18). Independiente de las fases 0-3 (DB) — se puede hacer en paralelo o después.

### Pre-condiciones

- No es bloqueante a la migración SQLite. Se puede hacer **antes**, **después** o **en paralelo**.
- Si se hace antes que la DB: el `IronLogContext` sigue siendo la fuente de datos persistentes; Zustand reemplaza solo el UI state.
- Si se hace después: limpieza de los `useState` que quedaron tras la migración a hooks de queries.

### Recomendación

Hacela **después** de la fase 3 (mutators tipados). Razones:

1. Cuando ya están los mutators, el `IronLogContext` se elimina. En ese momento lo que quedaba como "state global" (que no eran datos del dominio) hay que rehubicarlo — Zustand es el lugar natural.
2. Hacerla antes mezcla dos refactors grandes en el mismo PR. Riesgoso.

### Pasos

#### Step 1 — Setup (1-2 horas)

- [ ] `pnpm --filter @workspace/ironlog add zustand`.
- [ ] Crear `domains/<area>/ui.ts` por feature donde haga falta. Empezar por `workout/ui.ts` (la más compleja).

#### Step 2 — Migrar sheets/modales por feature (1-2 días por feature)

- [ ] Identificar los `useState` que viven en componentes raíz coordinando sheets de hijos. Ejemplos:
  - `(tabs)/index.tsx`: `swapOpen`, `preflightOffer`.
  - `workout/active.tsx`: `actionForExId`, `noteSheet`, `quickMenu`.
  - `workout/summary.tsx`: `recapOffered`, `celebrate`.
  - `workout/plan.tsx`: `bulk`.
- [ ] Mover cada uno al store correspondiente (`workout/ui.ts`, etc.).
- [ ] Reemplazar los `useState` por hooks granulares del store.
- [ ] Verificar manualmente que el flujo sigue funcionando.

#### Step 3 — Drafts y wizards (1 día)

- [ ] Migrar drafts de inputs largos (ej. NoteSheet draft text mientras tipea, recap progress) a Zustand.
- [ ] Migrar el state interno de wizards (paso actual, datos parciales) a Zustand.
- [ ] Verificar que cancelar/abandonar el wizard limpia el store.

#### Step 4 — Filtros y prefs UI persistentes (medio día)

- [ ] Decidir cuáles filtros/prefs deben sobrevivir relaunches.
- [ ] Implementar `persist` middleware para esos casos puntuales.
- [ ] Convención: stores con persist usan key prefix `ironlog-ui-<feature>`.

#### Step 5 — Cleanup (medio día)

- [ ] Eliminar prop drilling residual.
- [ ] Validar que ningún state efímero quedó en `IronLogContext` (si sigue existiendo).
- [ ] Documentar en cada `domains/<area>/ui.ts` qué slices contiene y cuándo usarlos.

### Criterio de salida

- [ ] Ningún componente raíz (`app/(tabs)/*.tsx`, `app/workout/*.tsx`) declara `useState` para coordinar sheets de hijos.
- [ ] Cada feature con UI compleja tiene su `ui.ts` documentado.
- [ ] Test manual: ningún flow se rompió.
- [ ] (Opcional) Tests unitarios de stores complejos con `vitest`.

### Rollback

Por feature. Si un store rompe algo, revertir el commit y volver a `useState` local. Bajo riesgo porque cada feature es aislada.

---

## 9. Testing

### Unit (Vitest)

Zustand stores son funciones puras de TS — testeables sin React.

```ts
// domains/workout/ui.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useWorkoutUI } from "./ui";

beforeEach(() => {
  useWorkoutUI.setState({
    actionSheetExerciseId: null,
    swapSheetOpen: false,
  });
});

describe("workoutUI", () => {
  it("opens and closes action sheet", () => {
    useWorkoutUI.getState().openActionSheet("ex-1");
    expect(useWorkoutUI.getState().actionSheetExerciseId).toBe("ex-1");

    useWorkoutUI.getState().closeActionSheet();
    expect(useWorkoutUI.getState().actionSheetExerciseId).toBeNull();
  });

  it("opens swap sheet without affecting action sheet", () => {
    useWorkoutUI.getState().openActionSheet("ex-1");
    useWorkoutUI.getState().openSwapSheet();
    expect(useWorkoutUI.getState().actionSheetExerciseId).toBe("ex-1");
    expect(useWorkoutUI.getState().swapSheetOpen).toBe(true);
  });
});
```

### React (con Testing Library)

Para flows complejos donde un componente lee y muta el store, mockeo via `setState`:

```tsx
// renderiza componente, verifica que abre/cierra correctamente
import { render, fireEvent } from "@testing-library/react-native";
import { useWorkoutUI } from "@/domains/workout/ui";

it("opens action sheet on long press", () => {
  const { getByTestId } = render(<ExerciseRow exerciseId="ex-1" />);
  fireEvent(getByTestId("exercise-row"), "longPress");
  expect(useWorkoutUI.getState().actionSheetExerciseId).toBe("ex-1");
});
```

---

## 10. Advertencias y trade-offs

### Cosas a evitar

- **No metas datos del dominio en Zustand.** Si te tienta poner `sessions` ahí, parate y pensá: ¿es UI state o datos persistentes? Si lo dudás, va a DB.
- **No uses `persist` para todo.** Es un parche fácil pero termina recreando el problema del blob de AsyncStorage. Solo para preferencias chicas y específicas.
- **No mezcles Context API con Zustand para UI state.** Elegí uno por feature. La excepción es `ThemeContext` que es app-wide y simple — ese se queda con Context.
- **No uses Zustand para coordinar mutaciones del dominio.** Eso es trabajo del mutator. Zustand es solo UI.

### Trade-offs aceptados

- **Una API más por dominio.** Cada feature tiene su `queries.ts`, `mutators.ts`, **y** `ui.ts`. Más archivos, pero mejor separación.
- **Curva de aprendizaje suave pero existe.** Si alguien que conoce solo `useState` se suma al equipo, hay que explicar el patrón. Compensa rápido.
- **Stores globales tienen riesgos.** Olvidar limpiar un draft al cerrar un sheet puede dejar basura. Convención: `closeX` siempre limpia el state asociado.

---

## 11. ADR-004 · Zustand para UI efímera

**Status**: Proposed
**Date**: 2026-04-29

### Contexto

`IronLogContext` mezcla state persistente (sesiones, notas, perfil) con state que en otra arquitectura sería puramente de UI. Los componentes raíz acumulan `useState` para coordinar sheets de hijos, generando prop drilling. Cuando empiece la migración a SQLite + Drizzle (cf. `db_system.md`), el state persistente se va a la DB — pero queda el efímero, que necesita un hogar claro.

### Decisión

Adoptar **Zustand** como librería para UI state efímero. Una store por feature en `domains/<area>/ui.ts`. Sin Provider. Selectors granulares para re-render fine-grained.

### Alternativas consideradas

1. **Context API**: rechazada porque re-renderiza todos los consumers en cada cambio. Para state global con muchos slices, performance pobre. Sí queda para casos simples y app-wide como `ThemeContext`.
2. **Redux Toolkit**: rechazado por boilerplate excesivo (slices, reducers, dispatch). Demasiado para state efímero chico.
3. **Jotai**: alternativa válida, atom-level reactivity. Más fragmentado que stores por feature; preferimos stores compactos.
4. **Solo `useState` local**: insuficiente. Genera prop drilling para state que cruza componentes lejanos del mismo dominio.

### Consecuencias

#### Positivas
- Separación clara entre datos del dominio (DB) y UI state.
- Re-render fine-grained sin Provider hell.
- Stores testeables sin montar React.
- Bundle minimal (~1 KB).
- Patrón uniforme en todo el código.

#### Negativas
- Una librería más en el stack (mitigado por su tamaño y simplicidad).
- Convenciones a respetar (`closeX` limpia state asociado, no meter datos persistentes, etc.).
- Si se abusa con `persist`, recreás el problema del blob.

---

## 12. Glosario

- **State efímero**: estado que no necesita sobrevivir al cierre de la app. Sheets abiertos, drafts, filtros, paso actual de un wizard.
- **State persistente**: estado del dominio que va a la DB. Sesiones, notas, perfil, etc. (Cf. `db_system.md`.)
- **Selector**: función que extrae un slice del store. En Zustand, cada componente se subscribe vía un selector.
- **Re-render granular**: re-renderizar solo los componentes cuyo slice del store cambió, no todos los consumers. Lo opuesto a Context API.
- **Provider hell**: anidar múltiples Providers de Context en la raíz del árbol. Zustand evita esto al no necesitar Provider.
- **Persist middleware**: utility de Zustand para persistir un store automáticamente en un storage configurable (AsyncStorage, MMKV, etc.). Útil para preferencias chicas.
- **Prop drilling**: pasar el mismo prop por varios niveles de componentes solo para que un descendiente lo use. Síntoma típico de state mal ubicado.

---

## Notas de mantenimiento

- Cada nueva feature con UI compleja arranca con su `domains/<feature>/ui.ts`.
- Las decisiones que rompan con este doc abren un ADR nuevo en `docs/adr/`.
- Si una store crece más allá de ~100 LOC, considerá partirla en sub-stores o mover lógica a domain layer (mutators / queries).
