import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/src/components/ErrorBoundary";
import { ThemeProvider, useTheme } from "@/src/design/ThemeProvider";
import { AppProvider } from "@/src/providers/AppProvider";

SplashScreen.setOptions({ duration: 450, fade: true });

function Navigation() {
  const { isDark, colors } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="voice"
          options={{ title: "Voice entry", presentation: "modal" }}
        />
        <Stack.Screen
          name="review"
          options={{ title: "Review entries", presentation: "modal" }}
        />
        <Stack.Screen name="categories" options={{ title: "Categories" }} />
        <Stack.Screen
          name="budget-categories"
          options={{ title: "Budget categories" }}
        />
        <Stack.Screen
          name="budget/[id]"
          options={{ title: "Budget activity" }}
        />
        <Stack.Screen
          name="transaction/[id]"
          options={{ title: "Edit transaction" }}
        />
        <Stack.Screen
          name="auth"
          options={{ title: "Backup & sync", presentation: "modal" }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ThemeProvider>
          <Navigation />
        </ThemeProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
