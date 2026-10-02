import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithRedirect,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/services/firebase";
import { formatAuthError } from "@/contexts/AuthContext";

/**
 * Web variant (Metro picks `.web.ts` on web). COOP same-origin breaks the
 * popup flow used on native, so we use a full-page redirect. The signed-in user
 * is picked up by `onAuthStateChanged` in AuthContext.
 */
export function useGoogleAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let cancelled = false;
    getRedirectResult(auth).catch((err) => {
      if (!cancelled) setError(formatAuthError(err));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured) {
      setError("Firebase no está configurado en tu .env.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signInWithRedirect(auth, new GoogleAuthProvider());
    } catch (err: any) {
      setError(formatAuthError(err));
      setLoading(false);
    }
  };

  return {
    signInWithGoogle,
    googleLoading: loading,
    googleError: error,
    googleRequestReady: isFirebaseConfigured,
  };
}
