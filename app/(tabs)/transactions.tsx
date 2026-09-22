import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { FeedbackState } from "@/src/components/FeedbackState";
import { MonthNavigator } from "@/src/components/MonthNavigator";
import { Screen } from "@/src/components/Screen";
import { SelectionSheet } from "@/src/components/SelectionSheet";
import { TransactionRow } from "@/src/components/TransactionRow";
import {
  listAccounts,
  listCategories,
  listTransactions,
  setTransactionDeleted,
} from "@/src/db/repository";
import {
  formatDate,
  formatMonthStart,
  monthBoundsFromStart,
  monthStartFor,
} from "@/src/domain/dates";
import type {
  Account,
  Category,
  Transaction,
  TransactionType,
} from "@/src/domain/types";
import { exportTransactionsCsv } from "@/src/services/csv";
import { normalizeError } from "@/src/services/errors";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { useAppStore } from "@/src/state/appStore";

export default function TransactionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const revision = useAppStore((state) => state.dbRevision);
  const bump = useAppStore((state) => state.bumpDbRevision);
  const deletedId = useAppStore((state) => state.lastDeletedTransactionId);
  const setDeletedId = useAppStore(
    (state) => state.setLastDeletedTransactionId,
  );
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<TransactionType | "all">("all");
  const [accountId, setAccountId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [dateScope, setDateScope] = useState<"month" | "all">("month");
  const currentMonthStart = monthStartFor(new Date(), profile.timezone);
  const [selectedMonthStart, setSelectedMonthStart] =
    useState(currentMonthStart);
  const [grouping, setGrouping] = useState<"daily" | "monthly">("daily");
  const [sheet, setSheet] = useState<"account" | "category" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const hasLoaded = useRef(false);
  const loadRequest = useRef(0);

  const load = useCallback(
    async (showLoading = false) => {
      const request = ++loadRequest.current;
      if (showLoading || !hasLoaded.current) setLoading(true);
      setError(null);
      try {
        const bounds =
          dateScope === "month"
            ? monthBoundsFromStart(selectedMonthStart, profile.timezone)
            : null;
        const [rows, accountRows, categoryRows] = await Promise.all([
          listTransactions({
            search,
            type,
            accountId: accountId === "all" ? undefined : accountId,
            categoryId: categoryId === "all" ? undefined : categoryId,
            dateFrom: bounds?.start,
            dateTo: bounds?.end,
          }),
          listAccounts(),
          listCategories(),
        ]);
        if (request === loadRequest.current) {
          setTransactions(rows);
          setAccounts(accountRows);
          setCategories(categoryRows);
        }
      } catch (caught) {
        if (request === loadRequest.current)
          setError(normalizeError(caught).message);
      } finally {
        if (request === loadRequest.current) {
          hasLoaded.current = true;
          setLoading(false);
        }
      }
    },
    [
      accountId,
      categoryId,
      dateScope,
      profile.timezone,
      search,
      selectedMonthStart,
      type,
    ],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 180);
    return () => {
      clearTimeout(timer);
      loadRequest.current += 1;
    };
  }, [load, revision]);

  const groups = useMemo(() => {
    const result = new Map<string, Transaction[]>();
    for (const transaction of transactions) {
      const key =
        grouping === "daily"
          ? formatDate(
              transaction.occurredAt,
              profile.locale,
              profile.timezone,
              {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: undefined,
              },
            )
          : formatDate(
              transaction.occurredAt,
              profile.locale,
              profile.timezone,
              { month: "long", day: undefined, year: "numeric" },
            );
      result.set(key, [...(result.get(key) ?? []), transaction]);
    }
    return [...result.entries()];
  }, [grouping, profile.locale, profile.timezone, transactions]);

  const undo = async () => {
    if (!deletedId) return;
    try {
      await setTransactionDeleted(deletedId, false);
      setDeletedId(null);
      bump();
    } catch (caught) {
      setError(normalizeError(caught).message);
    }
  };
  const exportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportTransactionsCsv(transactions);
    } catch (caught) {
      setError(normalizeError(caught).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen
      title="Transactions"
      subtitle="Search, filter, review, and export your ledger."
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Export CSV"
          onPress={() => void exportCsv()}
          disabled={exporting}
        >
          <Ionicons name="share-outline" size={25} color={colors.primary} />
        </Pressable>
      }
    >
      {dateScope === "month" ? (
        <MonthNavigator
          monthStart={selectedMonthStart}
          currentMonthStart={currentMonthStart}
          locale={profile.locale}
          onChange={setSelectedMonthStart}
        />
      ) : (
        <Card style={styles.allDatesCard}>
          <Text style={[styles.allDatesText, { color: colors.text }]}>
            Showing transactions from all dates.
          </Text>
          <Button
            label="Choose a month"
            variant="secondary"
            onPress={() => setDateScope("month")}
          />
        </Card>
      )}
      <View
        style={[
          styles.search,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search transactions"
          placeholder="Merchant, note, or category"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>
      <View style={styles.chips}>
        {(["all", "expense", "income"] as const).map((item) => (
          <FilterChip
            key={item}
            label={
              item === "all"
                ? "All types"
                : item === "expense"
                  ? "Expenses"
                  : "Income"
            }
            selected={type === item}
            onPress={() => setType(item)}
          />
        ))}
        <FilterChip
          label="All dates"
          selected={dateScope === "all"}
          onPress={() =>
            setDateScope((value) => (value === "month" ? "all" : "month"))
          }
        />
        <FilterChip
          label={grouping === "daily" ? "Group daily" : "Group monthly"}
          selected={grouping === "monthly"}
          onPress={() =>
            setGrouping((value) => (value === "daily" ? "monthly" : "daily"))
          }
        />
        <FilterChip
          label={
            accountId === "all"
              ? "Account"
              : (accounts.find((item) => item.id === accountId)?.name ??
                "Account")
          }
          selected={accountId !== "all"}
          onPress={() => setSheet("account")}
        />
        <FilterChip
          label={
            categoryId === "all"
              ? "Category"
              : (categories.find((item) => item.id === categoryId)?.name ??
                "Category")
          }
          selected={categoryId !== "all"}
          onPress={() => setSheet("category")}
        />
      </View>
      {deletedId ? (
        <Card style={{ backgroundColor: colors.primarySoft }}>
          <View style={styles.undo}>
            <Text style={[styles.undoText, { color: colors.text }]}>
              Transaction deleted.
            </Text>
            <Button label="Undo" variant="ghost" onPress={() => void undo()} />
          </View>
        </Card>
      ) : null}
      {loading ? (
        <FeedbackState kind="loading" />
      ) : error ? (
        <FeedbackState
          kind="error"
          message={error}
          actionLabel="Try again"
          onAction={() => void load(true)}
        />
      ) : !transactions.length ? (
        <FeedbackState
          kind="empty"
          title={
            dateScope === "month"
              ? `No transactions in ${formatMonthStart(selectedMonthStart, profile.locale)}`
              : "No matching transactions"
          }
          message="Try changing the filters or add a new entry."
          actionLabel="Add an entry"
          onAction={() => router.push("/(tabs)/add")}
        />
      ) : (
        groups.map(([label, rows]) => (
          <View key={label}>
            <Text
              accessibilityRole="header"
              style={[styles.groupTitle, { color: colors.textMuted }]}
            >
              {label}
            </Text>
            <Card>
              {rows.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  locale={profile.locale}
                  timezone={profile.timezone}
                  onPress={() =>
                    router.push({
                      pathname: "/transaction/[id]",
                      params: { id: transaction.id },
                    })
                  }
                />
              ))}
            </Card>
          </View>
        ))
      )}
      <SelectionSheet
        visible={sheet === "account"}
        title="Filter by account"
        selected={accountId}
        options={[
          { value: "all", label: "All accounts" },
          ...accounts.map((item) => ({ value: item.id, label: item.name })),
        ]}
        onSelect={(value) => {
          setAccountId(value);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <SelectionSheet
        visible={sheet === "category"}
        title="Filter by category"
        selected={categoryId}
        options={[
          { value: "all", label: "All categories" },
          ...categories.map((item) => ({ value: item.id, label: item.name })),
        ]}
        onSelect={(value) => {
          setCategoryId(value);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? colors.primary : colors.text,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    fontSize: 15,
    paddingHorizontal: spacing.sm,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  undo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  undoText: { fontSize: 14, fontWeight: "600" },
  allDatesCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  allDatesText: { flex: 1, fontSize: 14, lineHeight: 20 },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
});
