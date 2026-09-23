import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "./Button";
import { FormField } from "./FormField";
import { SelectionSheet } from "./SelectionSheet";
import { Card } from "./Card";
import { formatDate } from "@/src/domain/dates";
import {
  decimalToMinor,
  minorToDecimal,
  SUPPORTED_CURRENCIES,
} from "@/src/domain/money";
import { transactionFormSchema } from "@/src/domain/schemas";
import type {
  Account,
  BudgetCategory,
  Category,
  Transaction,
  TransactionInput,
  TransactionSource,
  TransactionType,
} from "@/src/domain/types";
import {
  listAccounts,
  listBudgetCategories,
  listCategories,
} from "@/src/db/repository";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { normalizeError } from "@/src/services/errors";
import { useAppStore } from "@/src/state/appStore";

interface Props {
  initial?: Transaction | null;
  source?: TransactionSource;
  originalTranscript?: string | null;
  preset?: Partial<{
    type: TransactionType;
    amount: string;
    currency: string;
    merchant: string;
    categoryName: string;
    budgetCategoryName: string;
    accountName: string;
    occurredAt: string;
    note: string;
  }>;
  submitLabel?: string;
  onSubmit: (input: TransactionInput) => Promise<void>;
}

type Picker = "account" | "category" | "budget" | "currency" | null;

export function TransactionForm({
  initial,
  source = "manual",
  originalTranscript = null,
  preset,
  submitLabel = "Save entry",
  onSubmit,
}: Props) {
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile);
  const dbRevision = useAppStore((state) => state.dbRevision);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>(
    [],
  );
  const [type, setType] = useState<TransactionType>(
    initial?.type ?? preset?.type ?? "expense",
  );
  const [amount, setAmount] = useState(
    initial
      ? minorToDecimal(initial.amountMinor, initial.currency)
      : (preset?.amount ?? ""),
  );
  const [currency, setCurrency] = useState(
    initial?.currency ?? preset?.currency ?? profile?.defaultCurrency ?? "USD",
  );
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [budgetSelection, setBudgetSelection] = useState(
    initial
      ? initial.budgetAssignmentMode === "auto"
        ? "auto"
        : initial.budgetAssignmentMode === "explicit"
          ? (initial.budgetCategoryId ?? "none")
          : "none"
      : preset?.budgetCategoryName
        ? ""
        : "auto",
  );
  const [merchant, setMerchant] = useState(
    initial?.merchant ?? preset?.merchant ?? "",
  );
  const [note, setNote] = useState(initial?.note ?? preset?.note ?? "");
  const [occurredAt, setOccurredAt] = useState(
    () =>
      new Date(
        initial?.occurredAt ?? preset?.occurredAt ?? new Date().toISOString(),
      ),
  );
  const [picker, setPicker] = useState<Picker>(null);
  const [datePicker, setDatePicker] = useState<"date" | "time" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listAccounts(), listCategories(), listBudgetCategories()])
      .then(([nextAccounts, nextCategories, nextBudgetCategories]) => {
        if (!active) return;
        setAccounts(nextAccounts);
        setCategories(nextCategories);
        setBudgetCategories(nextBudgetCategories);
        setAccountId(
          (value) =>
            value ||
            nextAccounts.find(
              (item) =>
                item.name.toLowerCase() === preset?.accountName?.toLowerCase(),
            )?.id ||
            nextAccounts[0]?.id ||
            "",
        );
        setCategoryId(
          (value) =>
            value ||
            nextCategories.find(
              (item) =>
                item.transactionType === type &&
                item.name.toLowerCase() === preset?.categoryName?.toLowerCase(),
            )?.id ||
            nextCategories.find((item) => item.transactionType === type)?.id ||
            "",
        );
        setBudgetSelection(
          (value) =>
            value ||
            nextBudgetCategories.find(
              (item) =>
                item.name.toLowerCase() ===
                preset?.budgetCategoryName?.toLowerCase(),
            )?.id ||
            "auto",
        );
        setLoadError(null);
      })
      .catch((error) => {
        if (active) setLoadError(normalizeError(error).message);
      });
    return () => {
      active = false;
    };
  }, [
    dbRevision,
    preset?.accountName,
    preset?.budgetCategoryName,
    preset?.categoryName,
    type,
  ]);

  const changeType = (nextType: TransactionType) => {
    setType(nextType);
    setCategoryId(
      categories.find((item) => item.transactionType === nextType)?.id ?? "",
    );
    setBudgetSelection(nextType === "expense" ? "auto" : "none");
  };

  const selectedAccount = accounts.find((item) => item.id === accountId);
  const selectedCategory = categories.find((item) => item.id === categoryId);
  const automaticBudgetCategory = budgetCategories.find(
    (item) =>
      item.name.trim().toLocaleLowerCase() ===
      selectedCategory?.name.trim().toLocaleLowerCase(),
  );
  const selectedBudgetCategory = budgetCategories.find(
    (item) => item.id === budgetSelection,
  );
  const filteredCategories = categories.filter(
    (item) => item.transactionType === type,
  );
  const locale = profile?.locale ?? "en-US";
  const timezone = profile?.timezone ?? "UTC";

  const accountOptions = useMemo(
    () =>
      accounts.map((item) => ({
        value: item.id,
        label: item.name,
        detail: `${item.type} · ${item.currency}`,
      })),
    [accounts],
  );
  const categoryOptions = useMemo(
    () =>
      filteredCategories.map((item) => ({
        value: item.id,
        label: item.name,
        detail: item.transactionType,
      })),
    [filteredCategories],
  );
  const budgetOptions = useMemo(
    () => [
      {
        value: "auto",
        label: "Automatic",
        detail: automaticBudgetCategory
          ? `Uses ${automaticBudgetCategory.name}`
          : "No same-name budget; saves as a regular expense",
      },
      {
        value: "none",
        label: "No budget",
        detail: "Keep this as a regular expense",
      },
      ...budgetCategories.map((item) => ({
        value: item.id,
        label: item.name,
        detail: "Use this budget instead",
      })),
    ],
    [automaticBudgetCategory, budgetCategories],
  );

  const resetAfterSave = () => {
    const nextType: TransactionType = "expense";
    setType(nextType);
    setAmount("");
    setCurrency(profile?.defaultCurrency ?? "USD");
    setAccountId(accounts[0]?.id ?? "");
    setCategoryId(
      categories.find((item) => item.transactionType === nextType)?.id ?? "",
    );
    setBudgetSelection("auto");
    setMerchant("");
    setNote("");
    setOccurredAt(new Date());
    setPicker(null);
    setDatePicker(null);
    setErrors({});
  };

  const handleDate = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== "ios") setDatePicker(null);
    if (date) setOccurredAt(date);
  };

  const submit = async () => {
    const budgetCategoryId =
      budgetSelection === "auto"
        ? undefined
        : budgetSelection === "none"
          ? null
          : budgetSelection;
    const parsed = transactionFormSchema.safeParse({
      type,
      amount,
      currency,
      accountId,
      categoryId,
      budgetCategoryId,
      merchant,
      note,
      occurredAt: occurredAt.toISOString(),
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      return;
    }
    let amountMinor: number;
    try {
      amountMinor = decimalToMinor(amount, currency, locale);
    } catch (error) {
      setErrors({ amount: normalizeError(error).message });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await onSubmit({
        ...(initial?.id ? { id: initial.id } : {}),
        type,
        amountMinor,
        currency,
        accountId,
        categoryId,
        budgetCategoryId,
        merchant: merchant.trim() || null,
        note: note.trim() || null,
        occurredAt: occurredAt.toISOString(),
        source: initial?.source ?? source,
        originalTranscript: initial?.originalTranscript ?? originalTranscript,
      });
      if (!initial) resetAfterSave();
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);
    } catch (error) {
      setErrors({ form: normalizeError(error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      {loadError ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {loadError}
        </Text>
      ) : null}
      <View
        accessibilityRole="radiogroup"
        style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}
      >
        {(["expense", "income"] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ checked: type === item }}
            onPress={() => changeType(item)}
            style={[
              styles.segmentOption,
              type === item && { backgroundColor: colors.surface },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: type === item ? colors.text : colors.textMuted },
              ]}
            >
              {item === "expense" ? "Expense" : "Income"}
            </Text>
          </Pressable>
        ))}
      </View>

      <FormField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        suffix={currency}
        error={errors.amount}
        autoFocus={!initial}
      />
      <SelectionButton
        label="Currency"
        value={currency}
        icon="cash-outline"
        error={errors.currency}
        onPress={() => setPicker("currency")}
      />

      <SelectionButton
        label="Account"
        value={selectedAccount?.name ?? "Choose account"}
        icon="wallet-outline"
        error={errors.accountId}
        onPress={() => setPicker("account")}
      />
      <SelectionButton
        label="Category"
        value={selectedCategory?.name ?? "Choose category"}
        icon="pricetag-outline"
        error={errors.categoryId}
        onPress={() => setPicker("category")}
      />
      {type === "expense" ? (
        <SelectionButton
          label="Budget"
          value={
            budgetSelection === "auto"
              ? automaticBudgetCategory
                ? `Automatic · ${automaticBudgetCategory.name}`
                : "Automatic · Regular expense"
              : budgetSelection === "none"
                ? "No budget"
                : (selectedBudgetCategory?.name ??
                  initial?.budgetCategoryName ??
                  "Choose budget")
          }
          icon="pie-chart-outline"
          error={errors.budgetCategoryId}
          onPress={() => setPicker("budget")}
        />
      ) : null}
      <FormField
        label="Merchant or title"
        value={merchant}
        onChangeText={setMerchant}
        placeholder={type === "expense" ? "e.g. Metro" : "e.g. Employer"}
        error={errors.merchant}
      />

      <View style={styles.group}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>
          Date and time
        </Text>
        <Card style={styles.dateCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDatePicker("date")}
            style={styles.dateButton}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.dateText, { color: colors.text }]}>
              {formatDate(occurredAt.toISOString(), locale, timezone)}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDatePicker("time")}
            style={styles.dateButton}
          >
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={[styles.dateText, { color: colors.text }]}>
              {new Intl.DateTimeFormat(locale, {
                hour: "numeric",
                minute: "2-digit",
                timeZone: timezone,
              }).format(occurredAt)}
            </Text>
          </Pressable>
        </Card>
      </View>
      {datePicker ? (
        <DateTimePicker
          value={occurredAt}
          mode={datePicker}
          onChange={handleDate}
        />
      ) : null}

      <FormField
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Optional"
        multiline
        numberOfLines={3}
        error={errors.note}
        style={styles.note}
      />
      {originalTranscript ? (
        <Card>
          <Text style={[styles.transcriptLabel, { color: colors.textMuted }]}>
            Original transcript
          </Text>
          <Text style={[styles.transcript, { color: colors.text }]}>
            {originalTranscript}
          </Text>
        </Card>
      ) : null}
      {errors.form ? (
        <Text
          accessibilityRole="alert"
          style={[styles.error, { color: colors.danger }]}
        >
          {errors.form}
        </Text>
      ) : null}
      <Button
        label={submitLabel}
        onPress={() => void submit()}
        loading={saving}
        disabled={!accounts.length || !filteredCategories.length}
      />

      <SelectionSheet
        visible={picker === "account"}
        title="Choose account"
        options={accountOptions}
        selected={accountId}
        onSelect={(value) => {
          setAccountId(value);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <SelectionSheet
        visible={picker === "category"}
        title="Choose category"
        options={categoryOptions}
        selected={categoryId}
        onSelect={(value) => {
          setCategoryId(value);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <SelectionSheet
        visible={picker === "budget"}
        title="Choose budget"
        options={budgetOptions}
        selected={budgetSelection}
        onSelect={(value) => {
          setBudgetSelection(value);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <SelectionSheet
        visible={picker === "currency"}
        title="Choose currency"
        options={SUPPORTED_CURRENCIES.map((value) => ({ value, label: value }))}
        selected={currency}
        onSelect={(value) => {
          setCurrency(value);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

function SelectionButton({
  label,
  value,
  icon,
  error,
  onPress,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        onPress={onPress}
        style={[
          styles.selection,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      >
        <Ionicons name={icon} size={20} color={colors.primary} />
        <Text style={[styles.selectionText, { color: colors.text }]}>
          {value}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.error, { color: colors.danger }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  segment: { flexDirection: "row", padding: 4, borderRadius: radius.md },
  segmentOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  group: { gap: spacing.xs },
  fieldLabel: { fontSize: 14, fontWeight: "600" },
  selection: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  selectionText: { flex: 1, fontSize: 16 },
  dateCard: { paddingVertical: spacing.xs },
  dateButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dateText: { fontSize: 15, fontWeight: "600" },
  note: { minHeight: 84, textAlignVertical: "top", paddingTop: spacing.md },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  transcript: { fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  error: { fontSize: 13, lineHeight: 18 },
});
