import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { FormField } from "@/src/components/FormField";
import { SelectionSheet } from "@/src/components/SelectionSheet";
import { saveBudget } from "@/src/db/repository";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { formatMonthStart } from "@/src/domain/dates";
import { decimalToMinor, minorToDecimal } from "@/src/domain/money";
import type { Budget, BudgetCategory } from "@/src/domain/types";
import { normalizeError } from "@/src/services/errors";
import { useAppStore } from "@/src/state/appStore";

interface Props {
  budget: Budget | null;
  categories: BudgetCategory[];
  monthStart: string;
  onClose: () => void;
  onSaved: () => void;
}

export function BudgetModal({
  budget,
  categories,
  monthStart,
  onClose,
  onSaved,
}: Props) {
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const initialScope = budget?.budgetCategoryId ?? "";
  const [amount, setAmount] = useState(
    budget ? minorToDecimal(budget.amountMinor, budget.currency) : "",
  );
  const [budgetCategoryId, setBudgetCategoryId] = useState(initialScope);
  const [categorySheet, setCategorySheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const selected =
    categories.find((item) => item.id === budgetCategoryId)?.name ??
    budget?.budgetCategoryName ??
    "Choose budget category";
  const options = useMemo(
    () =>
      categories.map((item) => ({
        value: item.id,
        label: item.name,
        detail: item.sourceCategoryName
          ? `Matching category: ${item.sourceCategoryName}`
          : "Explicit assignments or a same-name category",
      })),
    [categories],
  );

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!budgetCategoryId) throw new Error("Choose a budget category.");
      const currency = budget?.currency ?? profile.defaultCurrency;
      await saveBudget({
        ...(budget ? { id: budget.id } : {}),
        budgetCategoryId,
        amountMinor: decimalToMinor(amount, currency, profile.locale),
        currency,
        startDate: budget?.startDate ?? monthStart,
      });
      onSaved();
    } catch (caught) {
      setError(normalizeError(caught).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <Text
            accessibilityRole="header"
            style={[styles.modalTitle, { color: colors.text }]}
          >
            {budget
              ? "Edit budget"
              : `New budget for ${formatMonthStart(monthStart, profile.locale)}`}
          </Text>
          <FormField
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            suffix={budget?.currency ?? profile.defaultCurrency}
            placeholder="0.00"
            error={error ?? undefined}
          />
          <View style={styles.group}>
            <Text style={[styles.label, { color: colors.text }]}>
              Budget category
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Budget category: ${selected}`}
              disabled={Boolean(budget)}
              onPress={() => setCategorySheet(true)}
              style={[
                styles.selector,
                {
                  backgroundColor: budget
                    ? colors.surfaceMuted
                    : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontSize: 16 }}>
                {selected}
              </Text>
            </Pressable>
          </View>
          <Button
            label="Save budget"
            onPress={() => void submit()}
            loading={saving}
          />
          <Button
            label="Cancel"
            variant="ghost"
            onPress={onClose}
            disabled={saving}
          />
          {!budget ? (
            <SelectionSheet
              visible={categorySheet}
              title="Budget category"
              selected={budgetCategoryId}
              options={options}
              onSelect={(value) => {
                setBudgetCategoryId(value);
                setCategorySheet(false);
              }}
              onClose={() => setCategorySheet(false)}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  modal: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  modalTitle: { fontSize: 22, fontWeight: "700" },
  group: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: "600" },
  selector: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: "center",
  },
});
