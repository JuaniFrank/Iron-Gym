# IronLog — Feature fixes encontrados durante validación

> Bitácora de bugs/inconsistencias encontrados al validar la implementación
> de las features de `notes-system.md` punto por punto. Cada entrada incluye:
> qué falló, cómo se resolvió, archivos tocados.
>
> Cuando todas las entradas estén resueltas y los checks de §15 de
> `notes-system.md` estén verdes, el doc puede archivarse.

---

## Convenciones

- **FX-N · título**: fix con ID secuencial.
- **Estado**: `pendiente` · `resuelto`.
- **Severidad**: `info` (cosmético) · `bug` (rompe UX) · `bloqueante` (no funciona).

---

## Entradas

### FX-1 · CategoryChips no reusa `<Chip>` base — desviación intencional

- **Estado**: `resuelto` (sin acción).
- **Severidad**: `info`.
- **Step**: 2.
- **Contexto**: el spec dice "Reusa `Chip` existente". El componente `Chip` (`components/ui/Chip.tsx`) no soporta ícono Feather al lado del label — el diseño requiere ícono.
- **Decisión**: implementar `CategoryChip` inline dentro de `CategoryChips.tsx` con el shape correcto (Pressable + ícono + texto). Lo mismo se replicó en otros chips custom (BodyPart, FactorX) por consistencia visual. El `Chip` base sigue siendo el estándar para chips simples sin ícono (autofill chips, etc.).
- **Archivos**: `components/notes/CategoryChips.tsx`.
- **Resolución**: ninguna — la desviación está justificada y mantiene paridad visual con la paleta del repo.

### FX-2 · Tap en edit-2 con set que ya tiene notas no muestra existentes

- **Estado**: `resuelto`.
- **Severidad**: `bug` (gap funcional vs spec).
- **Step**: 3.
- **Contexto**: spec pide que el tap en `edit-2` para un set CON notas muestre las existentes con opciones Editar / Eliminar / Agregar otra. La implementación actual abre `NoteSheet` siempre en modo "crear nueva" — el usuario nunca puede editar ni eliminar una nota desde el flow del set.
- **Causa**: `NoteSheet` solo soporta `editingNote` como prop, no una lista de notas previas. La integración en `active.tsx` no checkea si hay notas existentes antes de abrir el sheet.
- **Resolución**: agregué prop `existingNotes?: SessionNote[]` a `NoteSheet`. Cuando se abre con notas previas, el sheet renderiza una sección "Notas de este set" arriba del editor con cards tappables. Tap en una card → el sheet pasa a modo edit de esa nota. Botón "Agregar nueva" (siempre visible cuando hay existentes) → resetea a modo crear. En `active.tsx`, el handler de `onNotePress` ahora pasa `existingNotes={notes.filter((n) => n.setId === completedSet.id)}` cuando hay notas.
- **Archivos**: `components/notes/NoteSheet.tsx`, `app/workout/active.tsx`.

### FX-3 · Highlights del summary no agrupa por categoría

- **Estado**: `resuelto`.
- **Severidad**: `info` (cosmético).
- **Step**: 5.
- **Contexto**: spec dice "Lista las notas de la sesión que se acaba de cerrar, **agrupadas por categoría** con NoteCard". Implementación previa: ordenadas solo por `createdAt`.
- **Resolución**: agrupé las notas por `category` y renderizo un mini-header (label de la categoría + count) por grupo. Dentro de cada grupo, las notas se ordenan por timestamp ascendente. El orden de los grupos sigue el orden canónico definido en `constants/noteChips.ts`.
- **Archivos**: `app/workout/summary.tsx`.

### FX-4 · Discovery branching duplica la lógica del helper

- **Estado**: `resuelto`.
- **Severidad**: `info` (refactor).
- **Step**: 6 + 7.
- **Contexto**: spec pide "Lógica resuelta vía helper `getEligibleDiscoveries(profile, sessions, notes)`". `summary.tsx` y `(tabs)/index.tsx` tenían el branching hardcoded — leían `profile.featureDiscoveries` y aplicaban thresholds a mano (`sessionsCompletedCount >= 3`, etc.). Esto duplica el algoritmo definido en `services/featureDiscovery.ts` y desconecta el catálogo de su efecto.
- **Resolución**: ambos call sites ahora usan `getEligibleDiscoveries(profile, sessions, notes)` para detectar features pendientes y `isFeatureActive(profile, "recap")` para chequear si está activada. Los thresholds quedan en una sola fuente: `constants/featureCatalog.ts`. Si querés cambiar el threshold del recap a 5 sesiones, editás un solo lugar.
- **Archivos**: `app/workout/summary.tsx`, `app/(tabs)/index.tsx`.
