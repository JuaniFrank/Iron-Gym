import type {
  DiscoveryStatus,
  DiscoveryTrigger,
  FeatureDiscoveryDef,
  FeatureDiscoveryState,
  SessionNote,
  UserProfile,
  WorkoutSession,
} from "@/types";
import { FEATURE_CATALOG, getFeatureDef } from "@/constants/featureCatalog";
import { canActivateFeature } from "./entitlements";

// ---------------------------------------------------------------------------
// Lookup del estado de discovery en el profile

export function getDiscoveryState(
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

export function isFeatureActive(
  profile: UserProfile,
  featureId: string,
): boolean {
  return getDiscoveryState(profile, featureId).status === "activated";
}

// ---------------------------------------------------------------------------
// Eligibility — qué prompts mostrar ahora

function isPending(state: FeatureDiscoveryState, now: number): boolean {
  if (state.status === "unseen") return true;
  if (
    state.status === "snoozed" &&
    state.snoozeUntil != null &&
    now >= state.snoozeUntil
  ) {
    return true;
  }
  return false;
}

function triggerMet(
  trigger: DiscoveryTrigger,
  sessions: WorkoutSession[],
  notes: SessionNote[],
  profile: UserProfile,
  now: number,
): boolean {
  switch (trigger.kind) {
    case "sessions_completed":
      return sessions.filter((s) => s.endedAt != null).length >= trigger.count;
    case "notes_count":
      return notes.length >= trigger.count;
    case "pain_notes_count":
      return notes.filter((n) => n.category === "pain").length >= trigger.count;
    case "exercise_count": {
      const unique = new Set<string>();
      for (const s of sessions) {
        for (const set of s.sets) unique.add(set.exerciseId);
      }
      return unique.size >= trigger.count;
    }
    case "days_since_install": {
      // No tenemos `installedAt` explícito. Aproximamos con la fecha de la
      // primera sesión completada — para apps sin sesiones, no aplica.
      const earliest = sessions
        .filter((s) => s.endedAt != null)
        .reduce<number | null>(
          (acc, s) => (acc == null || s.startedAt < acc ? s.startedAt : acc),
          null,
        );
      if (earliest == null) return false;
      return (now - earliest) / (1000 * 60 * 60 * 24) >= trigger.days;
    }
  }
}

/** Devuelve features que cumplen trigger, no fueron decididas y el profile
 *  tiene entitlement (o la feature no requiere). */
export function getEligibleDiscoveries(
  profile: UserProfile,
  sessions: WorkoutSession[],
  notes: SessionNote[],
  now = Date.now(),
): FeatureDiscoveryDef[] {
  return FEATURE_CATALOG.filter((def) => {
    const state = getDiscoveryState(profile, def.featureId);
    if (!isPending(state, now)) return false;
    if (!triggerMet(def.trigger, sessions, notes, profile, now)) return false;
    return canActivateFeature(profile, def.requiresEntitlement);
  });
}

/** Primera feature elegible — para mostrar uno a la vez. */
export function nextDiscovery(
  profile: UserProfile,
  sessions: WorkoutSession[],
  notes: SessionNote[],
  now = Date.now(),
): FeatureDiscoveryDef | null {
  return getEligibleDiscoveries(profile, sessions, notes, now)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Helpers para mutar el estado (usados por el context)

export function withUpdatedDiscovery(
  profile: UserProfile,
  featureId: string,
  patch: Partial<FeatureDiscoveryState>,
): UserProfile {
  const existing = profile.featureDiscoveries ?? [];
  const idx = existing.findIndex((d) => d.featureId === featureId);
  const base: FeatureDiscoveryState =
    idx >= 0 ? existing[idx] : { featureId, status: "unseen" };
  const next: FeatureDiscoveryState = { ...base, ...patch };
  const list = [...existing];
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  return { ...profile, featureDiscoveries: list };
}

export function withDiscoveryStatus(
  profile: UserProfile,
  featureId: string,
  status: DiscoveryStatus,
  extra: Partial<FeatureDiscoveryState> = {},
): UserProfile {
  return withUpdatedDiscovery(profile, featureId, {
    status,
    decidedAt: Date.now(),
    ...extra,
  });
}

export const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function snoozeDiscovery(
  profile: UserProfile,
  featureId: string,
  durationMs = SNOOZE_DURATION_MS,
): UserProfile {
  return withUpdatedDiscovery(profile, featureId, {
    status: "snoozed",
    decidedAt: Date.now(),
    snoozeUntil: Date.now() + durationMs,
  });
}

/** Resetea todos los discoveries a "unseen". Usado por settings. */
export function resetAllDiscoveries(profile: UserProfile): UserProfile {
  return { ...profile, featureDiscoveries: [] };
}

export { getFeatureDef };
