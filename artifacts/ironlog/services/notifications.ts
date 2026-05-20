/**
 * Local notifications service — STUB temporal.
 *
 * Estado actual: deshabilitado. El módulo nativo `ExpoPushTokenManager`
 * (que expo-notifications carga automáticamente al import) no se está
 * registrando en el binary de iOS pese a estar el pod `EXNotifications`
 * instalado. Es un mismatch conocido de expo-notifications 0.32 + new
 * architecture + Hermes. Cualquier camino que termine importando
 * `expo-notifications` (incluido dynamic `import()`, que Metro a veces
 * hoist-ea a static) crashea con "Cannot find native module
 * 'ExpoPushTokenManager'" sin posibilidad de catch desde JS.
 *
 * Mientras tanto el RestTimer sigue funcionando 100% local — haptic
 * (`Haptics.notificationAsync`) + animación de pulse al llegar a 0.
 * Lo único que se pierde es el banner cuando la app está cerrada.
 *
 * Plan de re-habilitación: cf. `push-notifications-system.md` §
 * "Re-habilitar push" (a documentar). Pasos probables:
 *   - Investigar por qué ExpoPushTokenManager no se registra.
 *   - Posibles: downgrade a expo-notifications 0.31, desactivar new arch
 *     temporalmente, o switchear a `@notifee/react-native`.
 *   - Una vez resuelto, reemplazar este stub por la implementación real
 *     (commit anterior la tiene en git history).
 */

const DISABLED_REASON =
  "[notifications] STUB — feature deshabilitada (ver services/notifications.ts)";

export interface RestNotificationConfig {
  enabled: boolean;
  type: "sound_only" | "rich";
  sound: "default" | "silent";
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function getNotificationPermissionStatus(): Promise<
  "granted" | "denied" | "undetermined"
> {
  return "undetermined";
}

export async function scheduleRestNotification(
  _endsAt: number,
  _config: RestNotificationConfig,
): Promise<string | null> {
  void DISABLED_REASON;
  return null;
}

export async function cancelRestNotification(
  _notificationId: string | null | undefined,
): Promise<void> {
  return;
}
