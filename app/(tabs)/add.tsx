import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Screen } from "@/src/components/Screen";
import { TransactionForm } from "@/src/components/TransactionForm";
import { saveTransaction } from "@/src/db/repository";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { SavingForm } from "@/src/features/savings/SavingForm";
import { saveSaving } from "@/src/features/savings/repository";
import { useAppStore } from "@/src/state/appStore";

type EntryMode = "expense" | "income" | "savings";

export default function AddScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const bump = useAppStore((state) => state.bumpDbRevision);
  const [mode, setMode] = useState<EntryMode>("expense");
  return (
    <Screen
      title="Add entry"
      subtitle="Expenses, income, and savings stay clearly separated."
    >
      <View
        accessibilityRole="tablist"
        style={[styles.tabs, { backgroundColor: colors.surface }]}
      >
        {(["expense", "income", "savings"] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === item }}
            onPress={() => setMode(item)}
            style={[
              styles.tab,
              mode === item && { backgroundColor: colors.primarySoft },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: mode === item ? colors.primary : colors.textMuted },
              ]}
            >
              {item[0]!.toUpperCase() + item.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      {mode !== "savings" ? (
        <>
          <View
            style={[
              styles.voiceBanner,
              { backgroundColor: colors.primarySoft },
            ]}
          >
            <View style={styles.voiceText}>
              <Text style={[styles.voiceTitle, { color: colors.text }]}>
                Prefer to speak?
              </Text>
              <Text style={[styles.voiceBody, { color: colors.textMuted }]}>
                You will review every field before anything is saved.
              </Text>
            </View>
            <Button
              label="Use voice"
              icon="mic"
              variant="secondary"
              onPress={() => router.push("/voice")}
            />
          </View>
          <TransactionForm
            key={mode}
            preset={{ type: mode }}
            onSubmit={async (input) => {
              await saveTransaction(input);
              bump();
              router.replace("/(tabs)/transactions");
            }}
          />
        </>
      ) : (
        <SavingForm
          onSubmit={async (input) => {
            await saveSaving(input);
            bump();
            router.replace("/savings");
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.md },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  tabText: { fontSize: 13, fontWeight: "800" },
  voiceBanner: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  voiceText: { gap: 2 },
  voiceTitle: { fontSize: 16, fontWeight: "700" },
  voiceBody: { fontSize: 13, lineHeight: 19 },
});
