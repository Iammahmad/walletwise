import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { FormField } from "@/src/components/FormField";
import {
  decimalToMinor,
  minorToDecimal,
  SUPPORTED_CURRENCIES,
} from "@/src/domain/money";
import type { SavingInput } from "@/src/domain/types";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { useAppStore } from "@/src/state/appStore";

export function SavingForm({
  onSubmit,
  preset,
  submitLabel = "Log savings",
}: {
  onSubmit: (input: SavingInput) => Promise<void>;
  preset?: SavingInput;
  submitLabel?: string;
}) {
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const [name, setName] = useState(preset?.name ?? "General savings");
  const [amount, setAmount] = useState(() =>
    preset ? minorToDecimal(preset.amountMinor, preset.currency) : "",
  );
  const [currency, setCurrency] = useState(
    preset?.currency ?? profile.defaultCurrency,
  );
  const [note, setNote] = useState(preset?.note ?? "");
  const [occurredAt, setOccurredAt] = useState(() =>
    preset ? new Date(preset.occurredAt) : new Date(),
  );
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const amountMinor = decimalToMinor(amount, currency);
      await onSubmit({
        id: preset?.id,
        name,
        amountMinor,
        currency,
        occurredAt: occurredAt.toISOString(),
        note: note.trim() || null,
        source: preset?.source ?? "manual",
      });
      if (!preset) {
        setAmount("");
        setNote("");
        setOccurredAt(new Date());
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The savings entry could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDate = (_event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS !== "ios") setShowDate(false);
    if (value) setOccurredAt(value);
  };

  return (
    <View style={styles.form}>
      <View
        style={[
          styles.notice,
          { backgroundColor: colors.primarySoft, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.noticeTitle, { color: colors.text }]}>
          Savings are tracked separately
        </Text>
        <Text style={[styles.noticeBody, { color: colors.textMuted }]}>
          Logging savings does not change income, expenses, account balances, or
          budgets.
        </Text>
      </View>
      <FormField
        label="Savings label"
        value={name}
        onChangeText={setName}
        placeholder="Emergency fund"
        maxLength={80}
      />
      <FormField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />
      <Text style={[styles.label, { color: colors.text }]}>Currency</Text>
      <View style={styles.chips}>
        {SUPPORTED_CURRENCIES.slice(0, 6).map((item) => (
          <Button
            key={item}
            label={item}
            variant={currency === item ? "primary" : "secondary"}
            onPress={() => setCurrency(item)}
          />
        ))}
      </View>
      <Button
        label={occurredAt.toLocaleDateString(profile.locale)}
        icon="calendar-outline"
        variant="secondary"
        onPress={() => setShowDate(true)}
      />
      {showDate ? (
        <DateTimePicker value={occurredAt} mode="date" onChange={handleDate} />
      ) : null}
      <FormField
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="What are you saving for?"
        multiline
        maxLength={500}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <Button
        label={submitLabel}
        icon="wallet-outline"
        loading={saving}
        disabled={!amount.trim() || !name.trim()}
        onPress={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  notice: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 4,
  },
  noticeTitle: { fontSize: 15, fontWeight: "800" },
  noticeBody: { fontSize: 13, lineHeight: 19 },
  label: { fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
