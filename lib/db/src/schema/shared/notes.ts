// Closed-set unions for the `session_notes` table.
//
// Stored as `text` columns (DB-level constraint is loose — validation is at
// the mutator boundary). These unions are reused by the queries layer to
// type filter inputs (e.g. `useNotesByCategory(category: NoteCategory)`).

export type NoteCategory =
  | "pain"
  | "effort"
  | "technique"
  | "equipment"
  | "energy"
  | "mood"
  | "other";

/**
 * Closed enum of body zones (cf. D-13). 17 zones in v1; expansions are
 * additive. Free-form text continues to live in `session_notes.text`.
 */
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
