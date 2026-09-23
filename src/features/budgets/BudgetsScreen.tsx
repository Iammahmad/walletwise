import { type Href, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { FeedbackState } from "@/src/components/FeedbackState";
import { MonthNavigator } from "@/src/components/MonthNavigator";
import { Screen } from "@/src/components/Screen";
import {
  deleteBudget,
  getBudgetProgress,
  listBudgetCategories,
} from "@/src/db/repository";
import { spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import {
  formatMonthStart,
  monthBoundsFromStart,
  monthStartFor,
} from "@/src/domain/dates";
import type {
  Budget,
  BudgetCategory,
  BudgetProgress,
} from "@/src/domain/types";
import { useReloadable } from "@/src/hooks/useReloadable";
import { normalizeError } from "@/src/services/errors";
import { useAppStore } from "@/src/state/appStore";

import { BudgetModal } from "./components/BudgetModal";
import { BudgetProgressCard } from "./components/BudgetProgressCard";

interface Data {
  progress: BudgetProgress[];
  categories: BudgetCategory[];
}

export default function BudgetsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const bump = useAppStore((state) => state.bumpDbRevision);
  const currentMonthStart = monthStartFor(new Date(), profile.timezone);
  const [selectedMonthStart, setSelectedMonthStart] =
    useState(currentMonthStart);
  const loader = useCallback(async (): Promise<Data> => {
    const bounds = monthBoundsFromStart(selectedMonthStart, profile.timezone);
    const [progress, categories] = await Promise.all([
      getBudgetProgress(bounds.start, bounds.end, selectedMonthStart),
      listBudgetCategories(),
    ]);
    return { progress, categories };
  }, [profile.timezone, selectedMonthStart]);
  const { data, loading, error, reload } = useReloadable<Data>(loader, {
    progress: [],
    categories: [],
  });
  const [editing, setEditing] = useState<Budget | "new" | null>(null);

  const categoryProgress = data.progress.filter(
    (item) => item.budget.budgetCategoryId != null,
  );
  const usedCategoryIds = new Set(
    categoryProgress.map((item) => item.budget.budgetCategoryId),
  );
  const availableCategories = data.categories.filter(
    (category) => !usedCategoryIds.has(category.id),
  );
  const canCreate = availableCategories.length > 0;
  const monthLabel = formatMonthStart(selectedMonthStart, profile.locale);

  const remove = (budget: Budget) =>
    Alert.alert(
      "Delete budget?",
      "The monthly limit will be removed. Historical transactions will not be changed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteBudget(budget.id)
              .then(() => bump())
              .catch((caught) =>
                Alert.alert(
                  "Could not delete budget",
                  normalizeError(caught).message,
                ),
              );
          },
        },
      ],
    );

  const openTransactions = (budget: Budget) => {
    if (!budget.budgetCategoryId) return;
    router.push({
      pathname: "/budget/[id]",
      params: { id: budget.id, monthStart: selectedMonthStart },
    } as unknown as Href);
  };

  return (
    <Screen
      title="Budget dashboard"
      subtitle="Track a separate monthly limit for each budget category."
      action={
        <Button
          label="New"
          icon="add"
          variant="secondary"
          disabled={!canCreate}
          onPress={() => setEditing("new")}
        />
      }
    >
      <MonthNavigator
        monthStart={selectedMonthStart}
        currentMonthStart={currentMonthStart}
        locale={profile.locale}
        onChange={(monthStart) => {
          setEditing(null);
          setSelectedMonthStart(monthStart);
        }}
      />
      {loading ? (
        <FeedbackState kind="loading" />
      ) : error ? (
        <FeedbackState
          kind="error"
          message={error}
          actionLabel="Try again"
          onAction={() => void reload()}
        />
      ) : !data.progress.length ? (
        <FeedbackState
          kind="empty"
          title={`No budgets for ${monthLabel}`}
          message="Create a category budget specifically for this month."
          actionLabel="Create a budget"
          onAction={() => setEditing("new")}
        />
      ) : (
        <View style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionTitle, { color: colors.textMuted }]}
          >
            Category budgets
          </Text>
          {categoryProgress.length ? (
            categoryProgress.map((item) => (
              <BudgetProgressCard
                key={item.budget.id}
                progress={item}
                onOpen={() => openTransactions(item.budget)}
                onEdit={() => setEditing(item.budget)}
                onDelete={() => remove(item.budget)}
              />
            ))
          ) : (
            <Card>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                No category limits yet
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Add one to track what remains for a specific budget category.
              </Text>
            </Card>
          )}
        </View>
      )}
      {editing ? (
        <BudgetModal
          key={editing === "new" ? "new" : editing.id}
          budget={editing === "new" ? null : editing}
          categories={editing === "new" ? availableCategories : data.categories}
          monthStart={selectedMonthStart}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            bump();
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 13, lineHeight: 19, marginTop: 3 },
});
