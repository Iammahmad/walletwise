import type { Budget } from "./types";

export function selectMonthlyBudgets(
  budgets: readonly Budget[],
  monthStart: string,
): Budget[] {
  const budgetsByScope = new Map<string, Budget>();
  for (const budget of budgets) {
    if (
      budget.period !== "monthly" ||
      budget.startDate !== monthStart ||
      !budget.budgetCategoryId
    )
      continue;
    const scope = budget.budgetCategoryId;
    const existing = budgetsByScope.get(scope);
    if (!existing || budget.updatedAt > existing.updatedAt) {
      budgetsByScope.set(scope, budget);
    }
  }
  return [...budgetsByScope.values()].sort((left, right) => {
    return (left.budgetCategoryName ?? "").localeCompare(
      right.budgetCategoryName ?? "",
    );
  });
}
