import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { FormField } from "@/src/components/FormField";
import { Screen } from "@/src/components/Screen";
import {
  decimalToMinor,
  formatMoney,
  minorToDecimal,
} from "@/src/domain/money";
import { spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { validateSettlement } from "@/src/features/splits/calculations";
import { saveSettlement } from "@/src/features/splits/repository";
import { normalizeError } from "@/src/services/errors";
import { getFirebaseAuth } from "@/src/services/firebase/config";
import { syncNow } from "@/src/services/sync";
import { useAppStore } from "@/src/state/appStore";

export default function SettleScreen() {
  const params = useLocalSearchParams<{
    contactId: string;
    splitId?: string;
    currency?: string;
    balance?: string;
    name?: string;
  }>();
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const bump = useAppStore((state) => state.bumpDbRevision);
  const balance = Number(params.balance ?? 0);
  const currency = params.currency ?? profile.defaultCurrency;
  const [amount, setAmount] = useState(
    minorToDecimal(Math.abs(balance), currency),
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const direction = balance >= 0 ? "received" : "paid";
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const amountMinor = decimalToMinor(amount, currency);
      validateSettlement(balance, direction, amountMinor);
      await saveSettlement({
        splitId: params.splitId ?? null,
        contactId: params.contactId,
        direction,
        amountMinor,
        currency,
        occurredAt: new Date().toISOString(),
        note: note.trim() || null,
      });
      bump();
      if (getFirebaseAuth()?.currentUser) void syncNow().catch(() => undefined);
      router.replace("/(tabs)/splits");
    } catch (caught) {
      setError(normalizeError(caught).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen title="Settle up" subtitle={`With ${params.name ?? "your friend"}`}>
      <Card style={[styles.hero, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {direction === "received" ? "Money they owe you" : "Money you owe"}
        </Text>
        <Text style={[styles.balance, { color: colors.text }]}>
          {formatMoney(Math.abs(balance), currency, profile.locale)}
        </Text>
      </Card>
      <FormField
        label={`Settlement amount (${currency})`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <FormField
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="Bank transfer, cash…"
        maxLength={500}
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button
        label="Confirm settlement"
        loading={saving}
        disabled={!amount.trim()}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  hero: { gap: spacing.xs },
  label: { fontSize: 12 },
  balance: { fontSize: 29, fontWeight: "900" },
});
