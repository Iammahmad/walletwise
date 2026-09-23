import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { EntryTypeTabs, type EntryType } from "@/src/components/EntryTypeTabs";
import { Screen } from "@/src/components/Screen";
import { TransactionForm } from "@/src/components/TransactionForm";
import { saveTransaction } from "@/src/db/repository";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { SavingForm } from "@/src/features/savings/SavingForm";
import { saveSaving } from "@/src/features/savings/repository";
import { useAppStore } from "@/src/state/appStore";

export default function AddScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const bump = useAppStore((state) => state.bumpDbRevision);
  const [mode, setMode] = useState<EntryType>("expense");
  return (
    <Screen title="Add entry">
      <EntryTypeTabs value={mode} includeSavings onChange={setMode} />
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
            selectedType={mode}
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
  voiceBanner: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  voiceText: { gap: 2 },
  voiceTitle: { fontSize: 16, fontWeight: "700" },
});
