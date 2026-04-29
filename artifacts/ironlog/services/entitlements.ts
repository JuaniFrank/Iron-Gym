import type { UserProfile } from "@/types";

/**
 * Premium entitlements gateway (cf. D-12).
 *
 * En v1 esta función SIEMPRE devuelve `true` — todos los features están
 * disponibles para todos los usuarios. La firma queda lista para v2 cuando
 * sumemos IAP via RevenueCat: ahí cachearemos los entitlements activos en
 * memoria y validaremos contra ese cache.
 *
 * IMPORTANTE: cualquier feature que en el futuro sea premium-gated tiene que
 * llamar a esta función ANTES de mostrar la activación. La integración v2
 * cambia solo el cuerpo de esta función — los call-sites quedan iguales.
 */
export function hasEntitlement(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  profile: UserProfile,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  name: string,
): boolean {
  // v1: todo libre.
  // v2: leer de profile.entitlements (cache de RevenueCat) y comparar.
  return true;
}

/** Conveniencia: si una feature def declara `requiresEntitlement`, valida.
 *  Si la feature no requiere nada, también devuelve `true`. */
export function canActivateFeature(
  profile: UserProfile,
  requiresEntitlement?: string,
): boolean {
  if (!requiresEntitlement) return true;
  return hasEntitlement(profile, requiresEntitlement);
}
