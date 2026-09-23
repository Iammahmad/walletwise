import type { PropsWithChildren, ReactNode } from "react";
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { logSafeError } from "@/src/services/errors";
import { getFirebaseAuth } from "@/src/services/firebase/config";
import { syncNow } from "@/src/services/sync";
import { useAppStore } from "@/src/state/appStore";

interface ScreenProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  scroll?: boolean;
  testID?: string;
  onRefresh?: () => Promise<void> | void;
}

export function Screen({
  title,
  subtitle,
  action,
  children,
  scroll = true,
  testID,
  onRefresh,
}: ScreenProps) {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const bump = useAppStore((state) => state.bumpDbRevision);
  const setSyncState = useAppStore((state) => state.setSyncState);
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    const signedIn = Boolean(getFirebaseAuth()?.currentUser);
    try {
      if (signedIn) {
        setSyncState("syncing");
        await syncNow();
        setSyncState("idle");
      }
      await onRefresh?.();
      bump();
    } catch (error) {
      logSafeError("manual-refresh", error);
      if (signedIn)
        setSyncState("error", "Refresh failed. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  }, [bump, onRefresh, refreshing, setSyncState]);
  const content = (
    <View style={styles.content} testID={testID}>
      {(title || action) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? (
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: colors.text }]}
              >
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {action}
        </View>
      )}
      {children}
    </View>
  );
  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          alwaysBounceVertical
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          overScrollMode="always"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={scroll}
        >
          {content}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerText: { flex: 1, paddingRight: spacing.md },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: spacing.xs },
});
