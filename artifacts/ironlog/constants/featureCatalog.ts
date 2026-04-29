import type { FeatureDiscoveryDef } from "@/types";

/**
 * Catálogo central de features con descubrimiento progresivo (cf. D-11 +
 * `feature-discovery.md`). Hardcoded — los `featureId` son contrato con datos
 * persistidos del usuario, NUNCA renombrar después de release.
 *
 * Solo features disponibles en v1 están acá. Voice notes (4.15) y Body Map
 * full (4.16) se agregan cuando se implementen.
 */
export const FEATURE_CATALOG: FeatureDiscoveryDef[] = [
  {
    featureId: "recap",
    title: "Recap reflexivo",
    tagline: "30 segundos para mejorar tus entrenos",
    description:
      "Después de cada sesión te preguntamos cómo te sentiste, si tuviste " +
      "alguna molestia, y algo que quieras recordar. Vamos viendo tus " +
      "patrones para que entrenes mejor.",
    trigger: { kind: "sessions_completed", count: 3 },
    surface: "modal",
    activationRoute: "/workout/recap",
    settingsKey: "recap",
  },
  {
    featureId: "preflight",
    title: "Factor X pre-entreno",
    tagline: "10 segundos antes de empezar",
    description:
      "Cómo dormiste, qué energía tenés, si hay algo distinto hoy. Después " +
      "vas a ver qué factores hacen tus mejores sesiones.",
    trigger: { kind: "sessions_completed", count: 5 },
    surface: "modal",
    activationRoute: "/workout/preflight",
    settingsKey: "preflight",
  },
];

/** Lookup rápido por featureId. */
export function getFeatureDef(
  featureId: string,
): FeatureDiscoveryDef | undefined {
  return FEATURE_CATALOG.find((f) => f.featureId === featureId);
}
