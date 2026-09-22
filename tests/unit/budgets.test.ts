import { selectMonthlyBudgets } from "@/src/domain/budgets";
import type { Budget } from "@/src/domain/types";

function budget(
  id: string,
  budgetCategoryId: string | null,
  startDate: string,
  updatedAt = `${startDate}T00:00:00.000Z`,
): Budget {
  return {
    id,
    userId: null,
    localOwnerId: "owner-1",
    budgetCategoryId,
    amountMinor: 100000,
    currency: "PKR",
    period: "monthly",
    startDate,
    createdAt: updatedAt,
    updatedAt,
    deletedAt: null,
    syncStatus: "local",
    localUpdatedAt: updatedAt,
    lastSyncedAt: null,
    budgetCategoryName: budgetCategoryId,
  };
}

describe("monthly budget dashboard selection", () => {
  it("uses only budgets assigned to the selected month", () => {
    const selected = selectMonthlyBudgets(
      [
        budget("overall-old", null, "2026-07-01"),
        budget("overall-current", null, "2026-08-01"),
        budget("food-old", "Food", "2026-06-01"),
        budget("food-current", "Food", "2026-08-01"),
        budget("travel-old-only", "Travel", "2026-07-01"),
        budget("fuel-future", "Fuel", "2026-09-01"),
      ],
      "2026-08-01",
    );

    expect(selected.map((item) => item.id)).toEqual([
      "overall-current",
      "food-current",
    ]);
    expect(
      selectMonthlyBudgets(
        [
          budget("overall-old", null, "2026-07-01"),
          budget("overall-current", null, "2026-08-01"),
          budget("travel-old-only", "Travel", "2026-07-01"),
        ],
        "2026-07-01",
      ).map((item) => item.id),
    ).toEqual(["overall-old", "travel-old-only"]);
  });

  it("uses updated-at as a deterministic tie-breaker", () => {
    const selected = selectMonthlyBudgets(
      [
        budget("first", "Food", "2026-08-01", "2026-08-01T01:00:00.000Z"),
        budget("edited", "Food", "2026-08-01", "2026-08-02T01:00:00.000Z"),
      ],
      "2026-08-01",
    );
    expect(selected[0]?.id).toBe("edited");
  });
});
