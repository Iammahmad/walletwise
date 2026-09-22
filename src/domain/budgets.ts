import type { Budget } from "./types";

export function selectMonthlyBudgets(
  budgets: readonly Budget[],
  monthStart: string,
): Budget[] {
  const budgetsByScope = new Map<string, Budget>();
  for (const budget of budgets) {
    if (budget.period !== "monthly" || budget.startDate !== monthStart)
      continue;
    const scope = budget.budgetCategoryId ?? "overall";
    const existing = budgetsByScope.get(scope);
    if (!existing || budget.updatedAt > existing.updatedAt) {
      budgetsByScope.set(scope, budget);
    }
  }
  return [...budgetsByScope.values()].sort((left, right) => {
    if (left.budgetCategoryId == null) return -1;
    if (right.budgetCategoryId == null) return 1;
    return (left.budgetCategoryName ?? "").localeCompare(
      right.budgetCategoryName ?? "",
    );
  });
}
