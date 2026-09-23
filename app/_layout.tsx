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
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="savings/index" options={{ title: "Savings" }} />
        <Stack.Screen
          name="savings/add"
          options={{ title: "Add savings", presentation: "modal" }}
        />
        <Stack.Screen name="savings/[id]" options={{ title: "Edit savings" }} />
        <Stack.Screen
          name="split/new"
          options={{ title: "New split", presentation: "modal" }}
        />
        <Stack.Screen name="split/[id]" options={{ title: "Split details" }} />
        <Stack.Screen
          name="split/contact/[id]"
          options={{ title: "Friend balance" }}
        />
        <Stack.Screen
          name="split/settle"
          options={{ title: "Settle up", presentation: "modal" }}
        />
        <Stack.Screen
          name="invite/[token]"
          options={{ title: "WalletWise invitation" }}
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
