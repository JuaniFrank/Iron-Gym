import type { Routine } from "@/types";

export type EditorLoad =
  | { status: "loading" }
  /** New empty routine (no template, or the template no longer exists). */
  | { status: "blank" }
  | { status: "template"; routine: Routine }
  | { status: "edit"; routine: Routine }
  | { status: "missing" };

/**
 * What the routine editor should do with the live routine list. Local draft
 * state is seeded once, so it must only be seeded from fully loaded data:
 * until `loaded`, nothing is decided (and "not found" is never shown).
 */
export function resolveEditorLoad(args: {
  isNew: boolean;
  id?: string;
  templateId?: string;
  loaded: boolean;
  routines: readonly Routine[];
}): EditorLoad {
  const { isNew, id, templateId, loaded, routines } = args;
  if (isNew && !templateId) return { status: "blank" };
  if (!loaded) return { status: "loading" };
  if (isNew) {
    const template = routines.find((r) => r.id === templateId);
    return template ? { status: "template", routine: template } : { status: "blank" };
  }
  const routine = routines.find((r) => r.id === id);
  return routine ? { status: "edit", routine } : { status: "missing" };
}
