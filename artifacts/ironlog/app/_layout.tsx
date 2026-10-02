import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ensureSchemaVersion,
  runMigrations,
  runSeedIfNeeded,
  type SeedPayload,
} from "@workspace/db";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BootErrorScreen, BootLoadingScreen } from "@/components/BootErrorScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EXERCISES } from "@/constants/exercises";
import { FOOD_DATABASE } from "@/constants/foods";
import { PRESET_ROUTINES } from "@/constants/presetRoutines";
import { DEFAULT_PROFILE, SEED_VERSION } from "@/constants/seed";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { db, initDb } from "@/services/db";
import { bootWithRetry, classifyBootError } from "@/services/dbBoot";
import { useSegments, useRouter } from "expo-router";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient();

/**
 * Build the seed payload from the legacy preset constants. Kept here (not
 * inside `lib/db`) because `@workspace/db` must NOT depend on
 * `@workspace/ironlog` — the data sources live in this app, not in the DB
 * package. `runSeedIfNeeded` consumes the payload via a structural contract
 * (`SeedPayload`).
 */
function buildSeedPayload(): SeedPayload {
  return {
    version: SEED_VERSION,
    exercises: EXERCISES.map((ex) => ({
      id: ex.id,
      name: ex.name,
      description: ex.description,
      primaryMuscle: ex.primaryMuscle,
      secondaryMuscles: ex.secondaryMuscles,
      type: ex.type,
    })),
    foods: FOOD_DATABASE.map((food) => ({
      id: food.id,
      name: food.name,
      brand: food.brand,
      caloriesPer100g: food.caloriesPer100g,
      proteinPer100g: food.proteinPer100g,
      carbsPer100g: food.carbsPer100g,
      fatPer100g: food.fatPer100g,
      defaultServingG: food.defaultServingG,
    })),
    routines: PRESET_ROUTINES.map((routine) => ({
      id: routine.id,
      name: routine.name,
      description: routine.description,
      goal: routine.goal,
      createdAt: routine.createdAt,
      days: routine.days.map((day) => ({
        id: day.id,
        name: day.name,
        exercises: day.exercises.map((ex) => ({
          // The legacy factory generates random suffixes which break
          // idempotent upsert. Drop the legacy id and let the seed derive a
          // deterministic position-based id (`<dayId>:ex:<idx>`).
          exerciseId: ex.exerciseId,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          warmupSets: ex.warmupSets,
          restSeconds: ex.restSeconds,
          supersetWith: ex.supersetWith,
          notes: ex.notes,
        })),
      })),
    })),
    profileDefaults: {
      name: DEFAULT_PROFILE.name,
      age: DEFAULT_PROFILE.age,
      weightKg: DEFAULT_PROFILE.weightKg,
      heightCm: DEFAULT_PROFILE.heightCm,
      sex: DEFAULT_PROFILE.sex,
      activityLevel: DEFAULT_PROFILE.activityLevel,
      goal: DEFAULT_PROFILE.goal,
      units: DEFAULT_PROFILE.units,
      theme: DEFAULT_PROFILE.theme,
      caloriesGoal: DEFAULT_PROFILE.caloriesGoal,
      proteinGoalG: DEFAULT_PROFILE.proteinGoalG,
      carbsGoalG: DEFAULT_PROFILE.carbsGoalG,
      fatGoalG: DEFAULT_PROFILE.fatGoalG,
    },
  };
}

/**
 * Apply Drizzle migrations, stamp `_meta.schema_version`, and run the seed
 * pipeline if `_meta.seed_version` is older than `SEED_VERSION`.
 *
 * Fail-fast on error (DDB-19): the user's local DB is sacred — we'd rather
 * crash and show a red Metro/Sentry error than silently destroy data with a
 * fallback to a fresh DB.
 */
async function bootDatabase(): Promise<void> {
  try {
    await initDb();
    await runMigrations(db);
    await ensureSchemaVersion(db);
    await runSeedIfNeeded(db, buildSeedPayload());
  } catch (err) {
    console.error("[ironlog] DB boot failed:", err);
    throw err;
  }
}

function StackNavigator() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="routine/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="workout/active" options={{ presentation: "card", gestureEnabled: false }} />
      <Stack.Screen name="workout/summary" options={{ presentation: "card", gestureEnabled: false }} />
      <Stack.Screen name="workout/recap" options={{ presentation: "card" }} />
      <Stack.Screen name="workout/preflight" options={{ presentation: "card" }} />
      <Stack.Screen name="exercises" options={{ presentation: "modal" }} />
      <Stack.Screen name="food-add" options={{ presentation: "modal" }} />
      <Stack.Screen name="food-new" options={{ presentation: "modal" }} />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="achievements" />
      <Stack.Screen name="planning" />
      <Stack.Screen name="body" />
    </Stack>
  );
}

function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isConfigured } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    // Only redirect if Firebase is configured and user authentication state changes
    if (isConfigured) {
      if (!user && !inAuthGroup) {
        router.replace("/(auth)/login");
      } else if (user && inAuthGroup) {
        router.replace("/(tabs)");
      }
    }
  }, [user, loading, segments, isConfigured, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [dbReady, setDbReady] = useState(false);
  const [bootError, setBootError] = useState<{ error: unknown } | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setBootError(null);
    // On web the OPFS lock held by another tab is released only when that tab
    // closes, so retry briefly; any other failure (or the lock persisting) is
    // surfaced on screen instead of a blank page (DDB-19 still fails fast:
    // the user's DB is never replaced by a fallback).
    bootWithRetry(bootDatabase, { retryLocked: Platform.OS === "web" })
      .then(() => {
        if (!cancelled) setDbReady(true);
      })
      .catch((error) => {
        if (!cancelled) setBootError({ error });
      });
    return () => {
      cancelled = true;
    };
  }, [bootAttempt]);

  // On web a full reload is the only fully robust retry: it also resets the
  // SQLite worker, whatever state a failed init left it in.
  const retryBoot = useCallback(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    setBootAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (fontsLoaded && (dbReady || bootError)) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, dbReady, bootError]);

  if (bootError) {
    return (
      <BootErrorScreen
        kind={classifyBootError(bootError.error)}
        error={bootError.error}
        onRetry={retryBoot}
      />
    );
  }

  if (!fontsLoaded || !dbReady) return <BootLoadingScreen />;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <KeyboardProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <QueryClientProvider client={queryClient}>
              <ThemeProvider>
                <AuthProvider>
                  <RouteGuard>
                    <StackNavigator />
                  </RouteGuard>
                </AuthProvider>
              </ThemeProvider>
            </QueryClientProvider>
          </GestureHandlerRootView>
        </KeyboardProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
