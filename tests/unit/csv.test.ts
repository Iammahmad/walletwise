import { transactionsToCsv } from "@/src/services/csv";
import type { Transaction } from "@/src/domain/types";

const transaction: Transaction = {
  id: "1",
  userId: null,
  localOwnerId: "local",
  accountId: "a",
  categoryId: "c",
  budgetCategoryId: "bc",
  budgetAssignmentMode: "explicit",
  type: "expense",
  amountMinor: 125050,
  currency: "PKR",
  merchant: "Metro, Main",
  note: "Milk\nand bread",
  occurredAt: "2026-08-30T10:00:00.000Z",
  source: "manual",
  originalTranscript: null,
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:00:00.000Z",
  deletedAt: null,
  syncStatus: "local",
  localUpdatedAt: "2026-08-30T10:00:00.000Z",
  lastSyncedAt: null,
  accountName: "Cash",
  categoryName: "Groceries",
  categoryIcon: "basket-outline",
  categoryColor: "#059669",
  budgetCategoryName: "Household food",
};

describe("CSV export", () => {
  it("uses stable machine-readable values and escapes commas and newlines", () => {
    const csv = transactionsToCsv([transaction]);
    expect(csv).toContain("type,amount,currency");
    expect(csv).toContain("expense,1250.50,PKR");
    expect(csv).toContain("budget_category");
    expect(csv).toContain("Household food");
    expect(csv).toContain('"Metro, Main"');
    expect(csv).toContain('"Milk\nand bread"');
  });
});
