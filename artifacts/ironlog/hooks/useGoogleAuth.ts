import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/build/providers/Google";
import { useEffect, useState } from "react";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/services/firebase";
import { formatAuthError } from "@/contexts/AuthContext";

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const idToken =
        response.params?.id_token || response.authentication?.idToken;
      if (idToken) {
        setLoading(true);
        setError(null);
        const credential = GoogleAuthProvider.credential(idToken);
        signInWithCredential(auth, credential)
          .catch((err) => {
            setError(formatAuthError(err));
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setError("No se recibió el token de identificación de Google.");
      }
    } else if (response?.type === "error") {
      setError("Error en el inicio de sesión con Google.");
    }
  }, [response]);

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured) {
      setError("Firebase no está configurado en tu .env.");
      return;
    }
    if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
      setError("Configura EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en tu archivo .env.");
      return;
    }
    setError(null);
    try {
      await promptAsync();
    } catch (err: any) {
      setError(err?.message || "Error al iniciar sesión con Google.");
    }
  };

  return {
    signInWithGoogle,
    googleLoading: loading,
    googleError: error,
    googleRequestReady: !!request,
  };
}
