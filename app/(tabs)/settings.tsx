import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { Screen } from "@/src/components/Screen";
import { SelectionSheet } from "@/src/components/SelectionSheet";
import { getProfile, resetLocalData, updateProfile } from "@/src/db/repository";
import { SUPPORTED_CURRENCIES } from "@/src/domain/money";
import { getCurrentUser, signOut } from "@/src/services/auth";
import { normalizeError } from "@/src/services/errors";
import {
  isFirebaseConfigured,
  isFirebaseFunctionsEnabled,
} from "@/src/services/firebase/config";
import { syncNow } from "@/src/services/sync";
import { spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { useAppStore } from "@/src/state/appStore";

const LOCALES = ["en-PK", "en-US", "en-GB", "en-IN", "en-AE"];
const TIMEZONES = [
  "Asia/Karachi",
  "UTC",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Europe/London",
  "America/New_York",
];

export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const setProfile = useAppStore((state) => state.setProfile);
  const bump = useAppStore((state) => state.bumpDbRevision);
  const syncState = useAppStore((state) => state.syncState);
  const syncMessage = useAppStore((state) => state.syncMessage);
  const setSyncState = useAppStore((state) => state.setSyncState);
  const [email, setEmail] = useState<string | null>(() =>
    isFirebaseConfigured ? (getCurrentUser()?.email ?? null) : null,
  );
  const [sheet, setSheet] = useState<
    "currency" | "locale" | "timezone" | "theme" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);

  const save = async (changes: Parameters<typeof updateProfile>[0]) => {
    try {
      const next = await updateProfile(changes);
      setProfile(next);
      bump();
    } catch (error) {
      setMessage(normalizeError(error).message);
    }
  };
  const synchronize = async () => {
    setSyncState("syncing");
    try {
      await syncNow();
      setProfile(await getProfile());
      setSyncState("idle");
      bump();
    } catch (error) {
      setSyncState("error", normalizeError(error).message);
    }
  };
  const logout = () =>
    Alert.alert(
      "Sign out?",
      "Local data remains available on this device. Unsynced cloud changes should be synced first.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          onPress: () => {
            void signOut()
              .then(async () => {
                setEmail(null);
                setProfile(await getProfile());
                setSyncState("idle");
              })
              .catch((caught) => setMessage(normalizeError(caught).message));
          },
        },
      ],
    );
  const reset = () =>
    Alert.alert(
      "Reset all local data?",
      "This permanently removes local transactions, budgets, savings, splits, friends, and preferences from this device. Cloud data is not deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void resetLocalData()
              .then(async () => {
                const next = await getProfile();
                setProfile(next);
                bump();
                router.replace("/onboarding");
              })
              .catch((caught) => setMessage(normalizeError(caught).message));
          },
        },
      ],
    );

  return (
    <Screen
      title="Settings"
      subtitle="Privacy, defaults, backup, and appearance."
    >
      {message ? (
        <Card style={{ backgroundColor: colors.dangerSoft }}>
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {message}
          </Text>
        </Card>
      ) : null}
      <Section title="Preferences">
        <SettingRow
          icon="wallet-outline"
          label="Savings"
          value="Goals and contributions"
          onPress={() => router.push("/savings")}
        />
        <SettingRow
          icon="pricetags-outline"
          label="Transaction categories"
          value="Expense and income labels"
          onPress={() => router.push("/categories")}
        />
        <SettingRow
          icon="pie-chart-outline"
          label="Budget categories"
          value="Mappings and custom budget groups"
          onPress={() => router.push("/budget-categories" as Href)}
        />
        <SettingRow
          icon="cash-outline"
          label="Default currency"
          value={profile.defaultCurrency}
          onPress={() => setSheet("currency")}
        />
        <SettingRow
          icon="language-outline"
          label="Locale"
          value={profile.locale}
          onPress={() => setSheet("locale")}
        />
        <SettingRow
          icon="time-outline"
          label="Timezone"
          value={profile.timezone}
          onPress={() => setSheet("timezone")}
        />
        <SettingRow
          icon="contrast-outline"
          label="Theme"
          value={profile.theme}
          onPress={() => setSheet("theme")}
        />
      </Section>
      <Section title="Cloud & privacy">
        <View style={styles.switchRow}>
          <View style={styles.settingText}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Cloud AI parsing
            </Text>
            <Text style={[styles.settingValue, { color: colors.textMuted }]}>
              {!isFirebaseConfigured
                ? "Unavailable until Firebase is configured"
                : !isFirebaseFunctionsEnabled
                  ? "Unavailable on the current free cloud plan"
                  : !email
                    ? "Sign in first"
                    : "Local parser always runs first"}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Cloud AI parsing"
            value={profile.cloudAiEnabled && isFirebaseFunctionsEnabled}
            disabled={
              !isFirebaseConfigured || !isFirebaseFunctionsEnabled || !email
            }
            onValueChange={(value) => void save({ cloudAiEnabled: value })}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <SettingRow
          icon="cloud-outline"
          label="Backup & sync"
          value={
            email ??
            (isFirebaseConfigured ? "Not signed in" : "Local-only mode")
          }
          onPress={() => (email ? void synchronize() : router.push("/auth"))}
        />
        <View style={styles.status}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  syncState === "error"
                    ? colors.danger
                    : syncState === "offline"
                      ? colors.warning
                      : syncState === "syncing"
                        ? colors.info
                        : colors.primary,
              },
            ]}
          />
          <Text style={[styles.settingValue, { color: colors.textMuted }]}>
            Sync: {syncState}
            {syncMessage ? ` · ${syncMessage}` : ""}
          </Text>
        </View>
        {!isFirebaseFunctionsEnabled ? (
          <Text style={[styles.privacy, { color: colors.textMuted }]}>
            Free cloud mode: authentication and private Firestore backup work.
            Connected invitations, push notifications, and cloud AI stay off;
            local Splits continue to work on this device.
          </Text>
        ) : null}
        {email ? (
          <Button label="Sign out" variant="secondary" onPress={logout} />
        ) : null}
      </Section>
      <Section title="Data & privacy">
        <Text style={[styles.privacy, { color: colors.textMuted }]}>
          Audio is never retained. Confirmed voice entries may keep their
          transcript so you can audit the source. Cloud AI is optional and sends
          text only after deterministic parsing needs help.
        </Text>
        <Button
          label="Reset local data"
          variant="danger"
          icon="trash-outline"
          onPress={reset}
        />
        {email ? (
          <Button
            label="Delete account and cloud data"
            variant="danger"
            onPress={() => router.push("/auth?delete=1")}
          />
        ) : null}
      </Section>
      <Text style={[styles.version, { color: colors.textMuted }]}>
        WalletWise {Constants.expoConfig?.version ?? "development"} ·
        Local-first
      </Text>
      <SelectionSheet
        visible={sheet === "currency"}
        title="Default currency"
        selected={profile.defaultCurrency}
        options={SUPPORTED_CURRENCIES.map((value) => ({ value, label: value }))}
        onSelect={(value) => {
          void save({ defaultCurrency: value });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <SelectionSheet
        visible={sheet === "locale"}
        title="Locale"
        selected={profile.locale}
        options={LOCALES.map((value) => ({ value, label: value }))}
        onSelect={(value) => {
          void save({ locale: value });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <SelectionSheet
        visible={sheet === "timezone"}
        title="Timezone"
        selected={profile.timezone}
        options={[...new Set([profile.timezone, ...TIMEZONES])].map(
          (value) => ({ value, label: value }),
        )}
        onSelect={(value) => {
          void save({ timezone: value });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <SelectionSheet
        visible={sheet === "theme"}
        title="Theme"
        selected={profile.theme}
        options={[
          { value: "system", label: "Use device setting" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        onSelect={(value) => {
          void save({ theme: value as "system" | "light" | "dark" });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

function Section({
  title,
  children,
}: React.PropsWithChildren<{ title: string }>) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        style={[styles.sectionTitle, { color: colors.textMuted }]}
      >
        {title}
      </Text>
      <Card>{children}</Card>
    </View>
  );
}
function SettingRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={styles.settingRow}
    >
      <Ionicons name={icon} size={21} color={colors.primary} />
      <View style={styles.settingText}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.settingValue, { color: colors.textMuted }]}
        >
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  settingRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: "600" },
  settingValue: { fontSize: 13, marginTop: 3 },
  switchRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  status: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusDot: { width: 8, height: 8, borderRadius: 8 },
  privacy: { fontSize: 13, lineHeight: 20, marginBottom: spacing.md },
  version: { textAlign: "center", fontSize: 12, marginTop: spacing.sm },
});
