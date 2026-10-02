import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  type Auth,
} from "firebase/auth";
// @ts-expect-error - getReactNativePersistence exists in React Native resolution of firebase/auth
import { getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveAuthDomain } from "./authDomain";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: resolveAuthDomain(
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    typeof window !== "undefined" ? window.location?.hostname : undefined,
  ),
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY &&
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
);

// Only initialize Firebase when real credentials are present. Initializing with
// an empty apiKey throws `auth/invalid-api-key` at import time, which crashes the
// whole module and cascades into "missing default export" errors across the app.
// AuthContext / useGoogleAuth already guard every call with isFirebaseConfigured,
// so leaving these undefined when unconfigured is safe.
let app: FirebaseApp = undefined as unknown as FirebaseApp;
let auth: Auth = undefined as unknown as Auth;

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  try {
    if (typeof getReactNativePersistence === "function") {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } else {
      auth = getAuth(app);
    }
  } catch {
    auth = getAuth(app);
  }
}

export { app, auth };
