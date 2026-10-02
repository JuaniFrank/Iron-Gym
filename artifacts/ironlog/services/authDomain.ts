const FIREBASE_HOSTING_SUFFIXES = [".web.app", ".firebaseapp.com"];

/**
 * On web, redirect sign-in must be same-origin (COOP same-origin breaks
 * cross-origin popups/opener). When the app is served from Firebase Hosting,
 * use the current host as authDomain; otherwise keep the configured one.
 */
export function resolveAuthDomain(
  envDomain: string,
  hostname: string | undefined,
): string {
  if (
    hostname &&
    FIREBASE_HOSTING_SUFFIXES.some(
      (suffix) => hostname.endsWith(suffix) && hostname.length > suffix.length,
    )
  ) {
    return hostname;
  }
  return envDomain;
}
