import { getDatabase } from "@/src/db/database";
import { getBudgetProgress, getDashboardSummary } from "@/src/db/repository";

jest.mock("@/src/db/database", () => ({
  getDatabase: jest.fn(),
  reseedDatabase: jest.fn(),
}));

const profile = {
  id: "owner-1",
  user_id: null,
  default_currency: "PKR",
  locale: "en-PK",
  timezone: "Asia/Karachi",
  onboarding_completed: 1,
  cloud_ai_enabled: 0,
  theme: "system",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
};

const CATEGORY_FOOD_ID = "00000000-0000-4000-8000-000000000001";
const CATEGORY_OTHER_ID = "00000000-0000-4000-8000-000000000002";
const BUDGET_FOOD_ID = "00000000-0000-4000-8000-000000000011";
const BUDGET_HOUSEHOLD_ID = "00000000-0000-4000-8000-000000000012";

function budgetRow(
  id: string,
  budgetCategoryId: string | null,
  amountMinor: number,
  startDate: string,
) {
  return {
    id,
    user_id: null,
    local_owner_id: "owner-1",
    budget_category_id: budgetCategoryId,
    amount_minor: amountMinor,
    currency: "PKR",
    period: "monthly",
    start_date: startDate,
    created_at: `${startDate}T00:00:00.000Z`,
    updated_at: `${startDate}T00:00:00.000Z`,
    deleted_at: null,
    sync_status: "local",
    local_updated_at: `${startDate}T00:00:00.000Z`,
    last_synced_at: null,
    budget_category_name: budgetCategoryId,
    budget_category_icon: budgetCategoryId ? "restaurant-outline" : null,
    budget_category_color: budgetCategoryId ? "#D97706" : null,
  };
}

describe("budget progress repository", () => {
  it("calculates overall and category remaining amounts from current-month expenses", async () => {
    const db = {
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes("FROM budgets")) {
          return [
            budgetRow("overall", null, 100000, "2026-08-01"),
            budgetRow("food", BUDGET_FOOD_ID, 40000, "2026-08-01"),
            budgetRow("household", BUDGET_HOUSEHOLD_ID, 60000, "2026-08-01"),
            budgetRow("future", "Fuel", 30000, "2026-09-01"),
          ];
        }
        if (sql.includes("FROM budget_categories")) {
          return [
            {
              id: BUDGET_FOOD_ID,
              user_id: null,
              local_owner_id: "owner-1",
              source_category_id: CATEGORY_FOOD_ID,
              category_ids_json: JSON.stringify([CATEGORY_FOOD_ID]),
              name: "Food",
              icon: "restaurant-outline",
              color: "#D97706",
              created_at: "2026-08-01T00:00:00.000Z",
              updated_at: "2026-08-01T00:00:00.000Z",
              deleted_at: null,
              sync_status: "local",
              local_updated_at: "2026-08-01T00:00:00.000Z",
              last_synced_at: null,
            },
            {
              id: BUDGET_HOUSEHOLD_ID,
              user_id: null,
              local_owner_id: "owner-1",
              source_category_id: null,
              category_ids_json: JSON.stringify([CATEGORY_FOOD_ID]),
              name: "Household",
              icon: "home-outline",
              color: "#087F5B",
              created_at: "2026-08-01T00:00:00.000Z",
              updated_at: "2026-08-01T00:00:00.000Z",
              deleted_at: null,
              sync_status: "local",
              local_updated_at: "2026-08-01T00:00:00.000Z",
              last_synced_at: null,
            },
          ];
        }
        if (sql.includes("SELECT id, name FROM categories")) {
          return [{ id: CATEGORY_FOOD_ID, name: "Food" }];
        }
        if (sql.includes("FROM transactions")) {
          return [
            {
              amount_minor: 30000,
              category_id: CATEGORY_FOOD_ID,
              budget_category_id: null,
              budget_assignment_mode: "auto",
              currency: "PKR",
            },
            {
              amount_minor: 15000,
              category_id: CATEGORY_OTHER_ID,
              budget_category_id: null,
              budget_assignment_mode: "none",
              currency: "PKR",
            },
          ];
        }
        return [];
      }),
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes("FROM local_profile")) return profile;
        return null;
      }),
    };
    jest.mocked(getDatabase).mockResolvedValue(db as never);

    await expect(
      getBudgetProgress(
        "2026-07-31T19:00:00.000Z",
        "2026-08-31T19:00:00.000Z",
        "2026-08-01",
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        spentMinor: 45000,
        remainingMinor: 55000,
        budget: expect.objectContaining({ id: "overall" }),
      }),
      expect.objectContaining({
        spentMinor: 30000,
        remainingMinor: 10000,
        budget: expect.objectContaining({ id: "food" }),
      }),
      expect.objectContaining({
        spentMinor: 30000,
        remainingMinor: 30000,
        budget: expect.objectContaining({ id: "household" }),
      }),
    ]);
  });

  it("loads the Home overall budget for the exact current month only", async () => {
    const db = {
      getAllAsync: jest.fn(async () => []),
      getFirstAsync: jest.fn(async (sql: string, ..._params: unknown[]) => {
        if (sql.includes("FROM local_profile")) return profile;
        if (sql.includes("CASE WHEN type"))
          return { spending_minor: 25000, income_minor: 100000 };
        if (sql.includes("SELECT amount_minor FROM budgets"))
          return { amount_minor: 80000 };
        return null;
      }),
    };
    jest.mocked(getDatabase).mockResolvedValue(db as never);

    await expect(
      getDashboardSummary(
        "2026-08-31T19:00:00.000Z",
        "2026-09-30T19:00:00.000Z",
        "2026-09-01",
      ),
    ).resolves.toMatchObject({
      spendingMinor: 25000,
      incomeMinor: 100000,
      budgetMinor: 80000,
    });

    const budgetQuery = db.getFirstAsync.mock.calls.find(([sql]) =>
      String(sql).includes("SELECT amount_minor FROM budgets"),
    );
    expect(budgetQuery?.[0]).toContain("start_date = ?");
    expect(budgetQuery?.[3]).toBe("2026-09-01");
  });
});
