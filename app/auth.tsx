import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { FormField } from "@/src/components/FormField";
import { Screen } from "@/src/components/Screen";
import { spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { getProfile, resetLocalData } from "@/src/db/repository";
import {
  deleteCloudAccount,
  signIn,
  signInWithGoogleIdToken,
  signUp,
} from "@/src/services/auth";
import { normalizeError } from "@/src/services/errors";
import { isFirebaseConfigured } from "@/src/services/firebase/config";
import {
  isGoogleSignInConfigured,
  requestGoogleIdToken,
} from "@/src/services/googleSignIn";
import { syncNow } from "@/src/services/sync";
import { useAppStore } from "@/src/state/appStore";

type LoadingAction = "email" | "google" | "delete" | null;

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ delete?: string; returnTo?: string }>();
  const { colors } = useTheme();
  const setProfile = useAppStore((state) => state.setProfile);
  const bump = useAppStore((state) => state.bumpDbRevision);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loading = loadingAction !== null;

  const finishAuthentication = async () => {
    await syncNow();
    setProfile(await getProfile());
    bump();
    router.replace((params.returnTo || "/settings") as never);
  };

  const submitEmail = async (mode: "in" | "up") => {
    setLoadingAction("email");
    setMessage(null);
    try {
      if (mode === "in") {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password);
        if (result.confirmationRequired) {
          setMessage("Check your email to confirm the account, then sign in.");
          return;
        }
      }
      await finishAuthentication();
    } catch (error) {
      setMessage(normalizeError(error).message);
    } finally {
      setLoadingAction(null);
    }
  };

  const submitGoogle = async () => {
    setLoadingAction("google");
    setMessage(null);
    try {
      const idToken = await requestGoogleIdToken();
      if (!idToken) {
        setMessage("Google sign-in was cancelled.");
        return;
      }
      await signInWithGoogleIdToken(idToken);
      await finishAuthentication();
    } catch (error) {
      setMessage(normalizeError(error).message);
    } finally {
      setLoadingAction(null);
    }
  };

  const removeAccount = () =>
    Alert.alert(
      "Permanently delete account?",
      "This deletes cloud data and the authentication account, then resets this device. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => {
            setLoadingAction("delete");
            void deleteCloudAccount()
              .then(resetLocalData)
              .then(async () => {
                setProfile(await getProfile());
                bump();
                router.replace("/onboarding");
              })
              .catch((error) => setMessage(normalizeError(error).message))
              .finally(() => setLoadingAction(null));
          },
        },
      ],
    );

  if (!isFirebaseConfigured) {
    return (
      <Screen title="Local-only mode">
        <Card>
          <Text style={[styles.copy, { color: colors.text }]}>
            Firebase is not configured. Add the public Firebase web-app values
            described in README, then rebuild the app. Every local feature
            remains available.
          </Text>
        </Card>
        <Button
          label="Continue locally"
          onPress={() => router.replace("/(tabs)")}
        />
      </Screen>
    );
  }

  if (params.delete === "1") {
    return (
      <Screen
        title="Delete account"
        subtitle="This protected operation removes cloud data and your sign-in identity."
      >
        <Card>
          <Text style={[styles.copy, { color: colors.text }]}>
            Local and cloud deletion are separate so an accidental sign-out
            cannot erase your ledger. Continuing will delete both after
            confirmation.
          </Text>
        </Card>
        {message ? (
          <Text style={{ color: colors.danger }}>{message}</Text>
        ) : null}
        <Button
          label="Delete account and all data"
          variant="danger"
          loading={loadingAction === "delete"}
          onPress={removeAccount}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Backup & sync"
      subtitle="Optional. Local tracking works without an account."
    >
      <Card>
        <Text style={[styles.copy, { color: colors.textMuted }]}>
          Signing in links this device’s local records to your private Firebase
          account. Firestore Security Rules keep each user’s records isolated.
        </Text>
        <Text style={[styles.copy, { color: colors.textMuted }]}>
          Google is used only to verify your identity. WalletWise does not
          request access to Google Drive, contacts, or financial data.
        </Text>
      </Card>
      <Button
        label="Continue with Google"
        icon="logo-google"
        variant="secondary"
        loading={loadingAction === "google"}
        disabled={loading || !isGoogleSignInConfigured}
        accessibilityHint="Opens Google's secure account selection page"
        onPress={() => void submitGoogle()}
      />
      <View
        style={styles.divider}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View
          style={[styles.dividerLine, { backgroundColor: colors.border }]}
        />
        <Text style={[styles.dividerLabel, { color: colors.textMuted }]}>
          or use email
        </Text>
        <View
          style={[styles.dividerLine, { backgroundColor: colors.border }]}
        />
      </View>
      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />
      {message ? (
        <Text
          accessibilityRole="alert"
          style={{
            color:
              message.startsWith("Check") || message.includes("cancelled")
                ? colors.primary
                : colors.danger,
          }}
        >
          {message}
        </Text>
      ) : null}
      <Button
        label="Sign in"
        loading={loadingAction === "email"}
        disabled={loading || !email || password.length < 6}
        onPress={() => void submitEmail("in")}
      />
      <Button
        label="Create account"
        variant="secondary"
        disabled={loading || !email || password.length < 6}
        onPress={() => void submitEmail("up")}
      />
      <Button
        label="Not now"
        variant="ghost"
        disabled={loading}
        onPress={() => router.replace("/(tabs)")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { fontSize: 14, lineHeight: 21, marginBottom: spacing.xs },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerLabel: { fontSize: 13 },
});
