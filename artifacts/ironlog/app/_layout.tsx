import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { IronLogProvider } from "@/contexts/IronLogContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient();

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
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="routine/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="workout/active" options={{ presentation: "card", gestureEnabled: false }} />
      <Stack.Screen name="workout/summary" options={{ presentation: "card", gestureEnabled: false }} />
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

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <KeyboardProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <QueryClientProvider client={queryClient}>
              <IronLogProvider>
                <ThemeProvider>
                  <StackNavigator />
                </ThemeProvider>
              </IronLogProvider>
            </QueryClientProvider>
          </GestureHandlerRootView>
        </KeyboardProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
