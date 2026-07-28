import type { BodyPart } from "@/types";

/** Labels en español argentino. */
export const BODY_PART_LABEL: Record<BodyPart, string> = {
  shoulder_left: "Hombro izquierdo",
  shoulder_right: "Hombro derecho",
  elbow_left: "Codo izquierdo",
  elbow_right: "Codo derecho",
  wrist_left: "Muñeca izquierda",
  wrist_right: "Muñeca derecha",
  neck: "Cuello",
  upper_back: "Espalda alta",
  lower_back: "Lumbar",
  chest: "Pecho",
  abs: "Abdomen",
  hip_left: "Cadera izquierda",
  hip_right: "Cadera derecha",
  knee_left: "Rodilla izquierda",
  knee_right: "Rodilla derecha",
  ankle_left: "Tobillo izquierdo",
  ankle_right: "Tobillo derecho",
};

/** Versión corta para chips. */
export const BODY_PART_SHORT_LABEL: Record<BodyPart, string> = {
  shoulder_left: "Hombro I",
  shoulder_right: "Hombro D",
  elbow_left: "Codo I",
  elbow_right: "Codo D",
  wrist_left: "Muñeca I",
  wrist_right: "Muñeca D",
  neck: "Cuello",
  upper_back: "Espalda alta",
  lower_back: "Lumbar",
  chest: "Pecho",
  abs: "Abdomen",
  hip_left: "Cadera I",
  hip_right: "Cadera D",
  knee_left: "Rodilla I",
  knee_right: "Rodilla D",
  ankle_left: "Tobillo I",
  ankle_right: "Tobillo D",
};

/** Top 6 zonas más comunes — primeras chips visibles en BodyPartChips antes
 *  de "ver todas". Orden basado en frecuencia clínica de molestias en gym. */
export const TOP_BODY_PARTS: BodyPart[] = [
  "shoulder_right",
  "shoulder_left",
  "knee_right",
  "knee_left",
  "lower_back",
  "wrist_right",
];

/** Vista frontal: zonas que aparecen en la silueta frontal del body map. */
export const FRONT_BODY_PARTS: BodyPart[] = [
  "shoulder_left",
  "shoulder_right",
  "elbow_left",
  "elbow_right",
  "wrist_left",
  "wrist_right",
  "neck",
  "chest",
  "abs",
  "hip_left",
  "hip_right",
  "knee_left",
  "knee_right",
  "ankle_left",
  "ankle_right",
];

/** Vista posterior: zonas que aparecen en la silueta posterior del body map. */
export const BACK_BODY_PARTS: BodyPart[] = [
  "shoulder_left",
  "shoulder_right",
  "elbow_left",
  "elbow_right",
  "wrist_left",
  "wrist_right",
  "neck",
  "upper_back",
  "lower_back",
  "hip_left",
  "hip_right",
  "knee_left",
  "knee_right",
  "ankle_left",
  "ankle_right",
];
