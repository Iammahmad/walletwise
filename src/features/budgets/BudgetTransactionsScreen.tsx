import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text } from "react-native";

import { Card } from "@/src/components/Card";
import { FeedbackState } from "@/src/components/FeedbackState";
import { Screen } from "@/src/components/Screen";
import { TransactionRow } from "@/src/components/TransactionRow";
import { getBudgetProgress, listTransactions } from "@/src/db/repository";
import { spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import {
  formatMonthStart,
  monthBoundsFromStart,
  monthStartFor,
} from "@/src/domain/dates";
import { formatMoney } from "@/src/domain/money";
import type { BudgetProgress, Transaction } from "@/src/domain/types";
import { useReloadable } from "@/src/hooks/useReloadable";
import { useAppStore } from "@/src/state/appStore";

interface Data {
  progress: BudgetProgress | null;
  transactions: Transaction[];
}

export default function BudgetTransactionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const params = useLocalSearchParams<{ id: string; monthStart?: string }>();
  const fallbackMonth = monthStartFor(new Date(), profile.timezone);
  const monthStart =
    typeof params.monthStart === "string" &&
    /^\d{4}-\d{2}-01$/.test(params.monthStart)
      ? params.monthStart
      : fallbackMonth;
  const budgetId = typeof params.id === "string" ? params.id : "";
  const loader = useCallback(async (): Promise<Data> => {
    const bounds = monthBoundsFromStart(monthStart, profile.timezone);
    const progress =
      (await getBudgetProgress(bounds.start, bounds.end, monthStart)).find(
        (item) => item.budget.id === budgetId,
      ) ?? null;
    if (!progress?.budget.budgetCategoryId)
      return { progress, transactions: [] };
    const transactions = await listTransactions({
      type: "expense",
      budgetCategoryId: progress.budget.budgetCategoryId,
      dateFrom: bounds.start,
      dateTo: bounds.end,
    });
    return { progress, transactions };
  }, [budgetId, monthStart, profile.timezone]);
  const { data, loading, error, reload } = useReloadable<Data>(loader, {
    progress: null,
    transactions: [],
  });
  const title = data.progress?.budget.budgetCategoryName ?? "Budget activity";

  return (
    <Screen
      title={title}
      subtitle={`${formatMonthStart(monthStart, profile.locale)} transactions included in this budget.`}
    >
      {loading ? (
        <FeedbackState kind="loading" />
      ) : error ? (
        <FeedbackState
          kind="error"
          message={error}
          actionLabel="Try again"
          onAction={() => void reload()}
        />
      ) : !data.progress ? (
        <FeedbackState
          kind="error"
          title="Budget not found"
          message="This budget may have been removed."
        />
      ) : (
        <>
          <Card style={{ backgroundColor: colors.primarySoft }}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
              Spent this month
            </Text>
            <Text style={[styles.summaryAmount, { color: colors.primary }]}>
              {formatMoney(
                data.progress.spentMinor,
                data.progress.budget.currency,
                profile.locale,
              )}
            </Text>
            <Text style={[styles.summaryMeta, { color: colors.textMuted }]}>
              of{" "}
              {formatMoney(
                data.progress.budget.amountMinor,
                data.progress.budget.currency,
                profile.locale,
              )}
            </Text>
          </Card>
          {!data.transactions.length ? (
            <FeedbackState
              kind="empty"
              title="No included transactions"
              message="Automatic category members and explicitly assigned expenses will appear here."
            />
          ) : (
            <Card style={styles.listCard}>
              {data.transactions.map((transaction, index) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  locale={profile.locale}
                  timezone={profile.timezone}
                  onPress={() => router.push(`/transaction/${transaction.id}`)}
                  showDivider={index > 0}
                />
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    marginTop: spacing.xs,
    fontVariant: ["tabular-nums"],
  },
  summaryMeta: { fontSize: 14, marginTop: spacing.xxs },
  listCard: { paddingVertical: 0 },
});
