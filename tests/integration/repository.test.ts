import { getDatabase } from "@/src/db/database";
import {
  createCategory,
  deleteBudgetCategory,
  getCloudPayload,
  listTransactions,
  mergeRemoteProfile,
  mergeRemoteRows,
  preparePristineLocalDataForCloudRestore,
  saveBudgetCategory,
  saveTransaction,
  setTransactionDeleted,
} from "@/src/db/repository";
import type { TransactionInput } from "@/src/domain/types";

jest.mock("@/src/db/database", () => ({
  getDatabase: jest.fn(),
  reseedDatabase: jest.fn(),
}));

type TestRow = Record<string, string | number | null>;

const CATEGORY_FOOD_ID = "00000000-0000-4000-8000-000000000001";
const BUDGET_FOOD_ID = "00000000-0000-4000-8000-000000000002";

const profileRow = (userId: string | null): TestRow => ({
  id: "local-owner-1",
  user_id: userId,
  default_currency: "PKR",
  locale: "en-PK",
  timezone: "Asia/Karachi",
  onboarding_completed: 1,
  cloud_ai_enabled: 0,
  theme: "system",
  created_at: "2026-08-30T08:00:00.000Z",
  updated_at: "2026-08-30T08:00:00.000Z",
});

function createTestDatabase(userId: string | null) {
  const transactions = new Map<string, TestRow>();
  const categories = new Map<string, TestRow>([
    [
      CATEGORY_FOOD_ID,
      {
        id: CATEGORY_FOOD_ID,
        user_id: userId,
        local_owner_id: "local-owner-1",
        name: "Food",
        icon: "restaurant-outline",
        color: "#D97706",
        transaction_type: "expense",
        is_default: 1,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
        deleted_at: null,
        sync_status: userId ? "synced" : "local",
        local_updated_at: "2026-08-01T00:00:00.000Z",
        last_synced_at: null,
      },
    ],
  ]);
  const budgetCategories = new Map<string, TestRow>([
    [
      BUDGET_FOOD_ID,
      {
        id: BUDGET_FOOD_ID,
        user_id: userId,
        local_owner_id: "local-owner-1",
        source_category_id: CATEGORY_FOOD_ID,
        category_ids_json: JSON.stringify([CATEGORY_FOOD_ID]),
        name: "Food",
        icon: "restaurant-outline",
        color: "#D97706",
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
        deleted_at: null,
        sync_status: userId ? "synced" : "local",
        local_updated_at: "2026-08-01T00:00:00.000Z",
        last_synced_at: null,
      },
    ],
  ]);
  const outbox = new Map<string, { entityType: string; entityId: string }>();
  let localProfile = profileRow(userId);

  const db = {
    withTransactionAsync: jest.fn(async (operation: () => Promise<void>) =>
      operation(),
    ),
    getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes("SELECT * FROM budget_categories")) {
        return [...budgetCategories.values()].filter(
          (row) => row.local_owner_id === params[0] && row.deleted_at == null,
        );
      }
      if (sql.includes("SELECT id, name FROM categories")) {
        return [...categories.values()]
          .filter(
            (row) =>
              row.local_owner_id === params[0] &&
              row.transaction_type === "expense" &&
              row.deleted_at == null,
          )
          .map((row) => ({ id: row.id, name: row.name }));
      }
      if (sql.includes("SELECT id FROM categories") && sql.includes("id IN")) {
        const ids = new Set(params.slice(1).map(String));
        return [...categories.values()]
          .filter(
            (row) =>
              row.local_owner_id === params[0] &&
              row.transaction_type === "expense" &&
              row.deleted_at == null &&
              ids.has(String(row.id)),
          )
          .map((row) => ({ id: row.id }));
      }
      if (sql.includes("FROM transactions t")) {
        return [...transactions.values()].map((row) => {
          const budget = row.budget_category_id
            ? budgetCategories.get(String(row.budget_category_id))
            : null;
          return {
            ...row,
            account_name: "Cash",
            category_name: "Food",
            category_icon: "restaurant-outline",
            category_color: "#D97706",
            budget_category_name: budget?.name ?? null,
            budget_category_icon: budget?.icon ?? null,
            budget_category_color: budget?.color ?? null,
          };
        });
      }
      return [];
    }),
    getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes("FROM local_profile")) return localProfile;
      if (sql.includes("COUNT(*) AS count FROM transactions"))
        return { count: transactions.size };
      if (sql.includes("COUNT(*) AS count FROM budgets")) return { count: 0 };
      if (sql.includes("SELECT id FROM categories")) {
        const [localOwnerId, transactionType, name] = params;
        return (
          [...categories.values()].find(
            (row) =>
              row.local_owner_id === localOwnerId &&
              row.transaction_type === transactionType &&
              row.deleted_at == null &&
              String(row.name).toLowerCase() === String(name).toLowerCase(),
          ) ?? null
        );
      }
      if (sql.includes("SELECT * FROM categories WHERE id = ?")) {
        const row = categories.get(String(params[0]));
        if (!row) return null;
        return row.local_owner_id === params[1] && row.deleted_at == null
          ? row
          : null;
      }
      if (sql.includes("SELECT id FROM budget_categories WHERE id = ?")) {
        const row = budgetCategories.get(String(params[0]));
        return row && row.local_owner_id === params[1] && row.deleted_at == null
          ? { id: row.id }
          : null;
      }
      if (sql.includes("SELECT * FROM budget_categories WHERE id = ?")) {
        const row = budgetCategories.get(String(params[0]));
        return params.length === 1 || row?.local_owner_id === params[1]
          ? (row ?? null)
          : null;
      }
      if (sql.includes("SELECT bc.*") && sql.includes("WHERE bc.id = ?")) {
        const row = budgetCategories.get(String(params[0]));
        if (!row || row.local_owner_id !== params[1]) return null;
        const source = row.source_category_id
          ? categories.get(String(row.source_category_id))
          : null;
        return { ...row, source_category_name: source?.name ?? null };
      }
      if (
        sql.includes("FROM budget_categories") &&
        sql.includes("source_category_id = ?")
      ) {
        const [localOwnerId, sourceCategoryId] = params;
        const row = [...budgetCategories.values()].find(
          (candidate) =>
            candidate.local_owner_id === localOwnerId &&
            candidate.source_category_id === sourceCategoryId &&
            candidate.deleted_at == null,
        );
        return row ? { id: row.id } : null;
      }
      if (sql.includes("FROM transactions") && sql.includes("WHERE id = ?")) {
        return transactions.get(String(params[0])) ?? null;
      }
      if (
        sql.includes("FROM transactions t") &&
        sql.includes("WHERE t.id = ?")
      ) {
        const row = transactions.get(String(params[0]));
        const budget = row?.budget_category_id
          ? budgetCategories.get(String(row.budget_category_id))
          : null;
        return row
          ? {
              ...row,
              account_name: "Cash",
              category_name: "Food",
              category_icon: "restaurant-outline",
              category_color: "#D97706",
              budget_category_name: budget?.name ?? null,
              budget_category_icon: budget?.icon ?? null,
              budget_category_color: budget?.color ?? null,
            }
          : null;
      }
      return null;
    }),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes("INSERT INTO transactions")) {
        const [
          id,
          rowUserId,
          localOwnerId,
          accountId,
          categoryId,
          budgetCategoryId,
          budgetAssignmentMode,
          type,
          amountMinor,
          currency,
          merchant,
          note,
          occurredAt,
          source,
          originalTranscript,
          createdAt,
          updatedAt,
          syncStatus,
          localUpdatedAt,
        ] = params;
        transactions.set(String(id), {
          id: String(id),
          user_id: rowUserId == null ? null : String(rowUserId),
          local_owner_id: String(localOwnerId),
          account_id: String(accountId),
          category_id: String(categoryId),
          budget_category_id:
            budgetCategoryId == null ? null : String(budgetCategoryId),
          budget_assignment_mode: String(budgetAssignmentMode),
          type: String(type),
          amount_minor: Number(amountMinor),
          currency: String(currency),
          merchant: merchant == null ? null : String(merchant),
          note: note == null ? null : String(note),
          occurred_at: String(occurredAt),
          source: String(source),
          original_transcript:
            originalTranscript == null ? null : String(originalTranscript),
          created_at: String(createdAt),
          updated_at: String(updatedAt),
          deleted_at: null,
          sync_status: String(syncStatus),
          local_updated_at: String(localUpdatedAt),
          last_synced_at: null,
        });
      } else if (sql.includes("INSERT INTO categories")) {
        const [
          id,
          rowUserId,
          localOwnerId,
          name,
          icon,
          color,
          transactionType,
          createdAt,
          updatedAt,
          syncStatus,
          localUpdatedAt,
        ] = params;
        categories.set(String(id), {
          id: String(id),
          user_id: rowUserId == null ? null : String(rowUserId),
          local_owner_id: String(localOwnerId),
          name: String(name),
          icon: String(icon),
          color: String(color),
          transaction_type: String(transactionType),
          is_default: 0,
          created_at: String(createdAt),
          updated_at: String(updatedAt),
          deleted_at: null,
          sync_status: String(syncStatus),
          local_updated_at: String(localUpdatedAt),
          last_synced_at: null,
        });
      } else if (sql.includes("INSERT INTO budget_categories")) {
        const cloudMerge = params.length >= 14;
        const id = params[0];
        const rowUserId = params[1];
        const sourceCategoryId = params[2];
        const categoryIdsJson = params[3];
        const name = params[4];
        const icon = params[5];
        const color = params[6];
        const createdAt = params[7];
        const updatedAt = params[8];
        const deletedAt = cloudMerge ? params[9] : null;
        const localOwnerId = cloudMerge ? params[10] : params[2];
        const localSourceCategoryId = cloudMerge ? sourceCategoryId : params[3];
        const localCategoryIdsJson = cloudMerge ? categoryIdsJson : params[4];
        const localName = cloudMerge ? name : params[5];
        const localIcon = cloudMerge ? icon : params[6];
        const localColor = cloudMerge ? color : params[7];
        const localCreatedAt = cloudMerge ? createdAt : params[8];
        const localUpdatedAtValue = cloudMerge ? updatedAt : params[9];
        const syncStatus = cloudMerge ? params[11] : params[10];
        const localUpdatedAt = cloudMerge ? params[12] : params[11];
        budgetCategories.set(String(id), {
          id: String(id),
          user_id: rowUserId == null ? null : String(rowUserId),
          local_owner_id: String(localOwnerId),
          source_category_id:
            localSourceCategoryId == null
              ? null
              : String(localSourceCategoryId),
          category_ids_json: String(localCategoryIdsJson),
          name: String(localName),
          icon: String(localIcon),
          color: String(localColor),
          created_at: String(localCreatedAt),
          updated_at: String(localUpdatedAtValue),
          deleted_at: deletedAt == null ? null : String(deletedAt),
          sync_status: String(syncStatus),
          local_updated_at: String(localUpdatedAt),
          last_synced_at: null,
        });
      } else if (sql.includes("UPDATE transactions SET deleted_at")) {
        const [
          deletedAt,
          updatedAt,
          localUpdatedAt,
          syncStatus,
          id,
          localOwnerId,
        ] = params;
        const row = transactions.get(String(id));
        if (row && row.local_owner_id === localOwnerId) {
          transactions.set(String(id), {
            ...row,
            deleted_at: deletedAt == null ? null : String(deletedAt),
            updated_at: String(updatedAt),
            local_updated_at: String(localUpdatedAt),
            sync_status: String(syncStatus),
          });
        }
      } else if (sql.includes("UPDATE budget_categories")) {
        const [
          deletedAt,
          updatedAt,
          localUpdatedAt,
          syncStatus,
          id,
          localOwnerId,
        ] = params;
        const row = budgetCategories.get(String(id));
        if (row && row.local_owner_id === localOwnerId) {
          budgetCategories.set(String(id), {
            ...row,
            deleted_at: deletedAt == null ? null : String(deletedAt),
            updated_at: String(updatedAt),
            local_updated_at: String(localUpdatedAt),
            sync_status: String(syncStatus),
          });
        }
      } else if (sql.includes("INSERT INTO sync_outbox")) {
        const [, , entityType, entityId] = params;
        outbox.set(`${String(entityType)}:${String(entityId)}`, {
          entityType: String(entityType),
          entityId: String(entityId),
        });
      } else if (sql.includes("UPDATE local_profile SET user_id")) {
        const [nextUserId, updatedAt] = params;
        localProfile = {
          ...localProfile,
          user_id: String(nextUserId),
          cloud_ai_enabled: 0,
          updated_at: String(updatedAt),
        };
      } else if (sql.includes("UPDATE local_profile SET default_currency")) {
        const [currency, locale, timezone, createdAt, updatedAt] = params;
        localProfile = {
          ...localProfile,
          default_currency: String(currency),
          locale: String(locale),
          timezone: String(timezone),
          created_at: String(createdAt),
          updated_at: String(updatedAt),
        };
      }
      return { changes: 1, lastInsertRowId: 0 };
    }),
  };

  return {
    db,
    transactions,
    categories,
    budgetCategories,
    outbox,
    get profile() {
      return localProfile;
    },
  };
}

const input: TransactionInput = {
  accountId: "account-cash",
  categoryId: CATEGORY_FOOD_ID,
  type: "expense",
  amountMinor: 60000,
  currency: "PKR",
  merchant: "Cafe",
  note: null,
  occurredAt: "2026-08-30T09:00:00.000Z",
  source: "manual",
  originalTranscript: null,
};

describe("local transaction repository integration", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates, edits, soft-deletes, and restores a transaction in local-only mode", async () => {
    const state = createTestDatabase(null);
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);

    const created = await saveTransaction(input);
    expect(created.amountMinor).toBe(60000);
    expect(created.budgetCategoryId).toBeNull();
    expect(created.budgetAssignmentMode).toBe("auto");
    expect(created.syncStatus).toBe("local");
    expect(state.outbox.size).toBe(0);

    const edited = await saveTransaction({
      ...input,
      id: created.id,
      amountMinor: 75000,
      note: "Team lunch",
    });
    expect(edited.id).toBe(created.id);
    expect(edited.amountMinor).toBe(75000);
    expect(edited.note).toBe("Team lunch");

    await setTransactionDeleted(created.id, true);
    expect(state.transactions.get(created.id)?.deleted_at).not.toBeNull();

    await setTransactionDeleted(created.id, false);
    expect(state.transactions.get(created.id)?.deleted_at).toBeNull();
    expect(state.outbox.size).toBe(0);
  });

  it("coalesces authenticated create, edit, delete, and undo writes into one retry-safe outbox item", async () => {
    const state = createTestDatabase("user-1");
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);

    const created = await saveTransaction(input);
    await saveTransaction({ ...input, id: created.id, merchant: "Metro" });
    await setTransactionDeleted(created.id, true);
    await setTransactionDeleted(created.id, false);

    expect(state.transactions.get(created.id)?.sync_status).toBe("pending");
    expect([...state.outbox.values()]).toEqual([
      { entityType: "transactions", entityId: created.id },
    ]);
  });

  it("creates a validated custom category and queues it once when authenticated", async () => {
    const state = createTestDatabase("user-1");
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);

    const created = await createCategory({
      name: "Pets",
      icon: "paw-outline",
      color: "#7c3aed",
      transactionType: "expense",
    });

    expect(created).toMatchObject({
      name: "Pets",
      color: "#7C3AED",
      transactionType: "expense",
      isDefault: false,
      syncStatus: "pending",
    });
    expect([...state.outbox.values()]).toEqual([
      { entityType: "categories", entityId: created.id },
      { entityType: "budget_categories", entityId: created.id },
    ]);
    expect(state.budgetCategories.get(created.id)).toMatchObject({
      source_category_id: created.id,
      name: "Pets",
    });
    await expect(
      createCategory({
        name: "pets",
        icon: "paw-outline",
        color: "#087F5B",
        transactionType: "expense",
      }),
    ).rejects.toThrow("already exists");
  });

  it("supports automatic, explicit, and excluded budget assignment", async () => {
    const state = createTestDatabase(null);
    state.budgetCategories.set("budget-eating-out", {
      ...state.budgetCategories.get(BUDGET_FOOD_ID)!,
      id: "budget-eating-out",
      source_category_id: null,
      name: "Eating Out",
    });
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);

    await expect(saveTransaction(input)).resolves.toMatchObject({
      budgetCategoryId: null,
      budgetAssignmentMode: "auto",
    });
    await expect(
      saveTransaction({ ...input, budgetCategoryId: "budget-eating-out" }),
    ).resolves.toMatchObject({
      budgetCategoryId: "budget-eating-out",
      budgetAssignmentMode: "explicit",
    });
    await expect(
      saveTransaction({ ...input, budgetCategoryId: null }),
    ).resolves.toMatchObject({
      budgetCategoryId: null,
      budgetAssignmentMode: "none",
    });
  });

  it("creates, edits, and soft-deletes an independent budget category", async () => {
    const state = createTestDatabase("user-1");
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);

    const created = await saveBudgetCategory({
      name: "Eating Out",
      icon: "restaurant-outline",
      color: "#DB2777",
      categoryIds: [],
    });
    expect(created).toMatchObject({
      name: "Eating Out",
      categoryIds: [],
      syncStatus: "pending",
    });

    const edited = await saveBudgetCategory({
      id: created.id,
      name: "Dining Out",
      icon: "cafe-outline",
      color: "#7C3AED",
      categoryIds: [],
    });
    expect(edited).toMatchObject({
      id: created.id,
      name: "Dining Out",
      categoryIds: [],
    });

    await deleteBudgetCategory(created.id);
    expect(state.budgetCategories.get(created.id)?.deleted_at).not.toBeNull();
    expect(state.outbox.get(`budget_categories:${created.id}`)).toEqual({
      entityType: "budget_categories",
      entityId: created.id,
    });
  });

  it("stores one category in multiple automatic budgets and serializes memberships for cloud sync", async () => {
    const state = createTestDatabase("user-1");
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);

    const household = await saveBudgetCategory({
      name: "Household",
      icon: "home-outline",
      color: "#087F5B",
      categoryIds: [CATEGORY_FOOD_ID],
    });
    expect(household).toMatchObject({
      categoryIds: [CATEGORY_FOOD_ID],
      categoryNames: ["Food"],
    });

    const transaction = await saveTransaction(input);
    expect(transaction).toMatchObject({
      budgetAssignmentMode: "auto",
      budgetCategoryName: expect.stringContaining("Food"),
    });
    expect(transaction.budgetCategoryName).toContain("Household");
    await expect(
      listTransactions({ budgetCategoryId: household.id }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: transaction.id,
        budgetAssignmentMode: "auto",
      }),
    ]);

    await expect(
      getCloudPayload("budget_categories", household.id),
    ).resolves.toEqual(
      expect.objectContaining({
        category_ids: [CATEGORY_FOOD_ID],
      }),
    );

    const remoteId = "00000000-0000-4000-8000-000000000099";
    await mergeRemoteRows("budget_categories", [
      {
        id: remoteId,
        user_id: "user-1",
        source_category_id: null,
        category_ids: [CATEGORY_FOOD_ID],
        name: "Shared household",
        icon: "home-outline",
        color: "#087F5B",
        created_at: "2026-09-18T00:00:00.000Z",
        updated_at: "2026-09-18T00:00:00.000Z",
        deleted_at: null,
      },
    ]);
    expect(state.budgetCategories.get(remoteId)?.category_ids_json).toBe(
      JSON.stringify([CATEGORY_FOOD_ID]),
    );
  });

  it("clears only a pristine local shell and then accepts the authenticated cloud profile", async () => {
    const state = createTestDatabase(null);
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);

    await expect(
      preparePristineLocalDataForCloudRestore("user-1"),
    ).resolves.toBe(true);
    expect(state.profile.user_id).toBe("user-1");
    expect(state.profile.updated_at).toBe("1970-01-01T00:00:00.000Z");

    await mergeRemoteProfile({
      user_id: "user-1",
      default_currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-08-30T12:00:00.000Z",
    });
    expect(state.profile).toEqual(
      expect.objectContaining({
        default_currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
      }),
    );
  });

  it("never clears a local ledger that already contains a transaction", async () => {
    const state = createTestDatabase(null);
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);
    await saveTransaction(input);

    await expect(
      preparePristineLocalDataForCloudRestore("user-1"),
    ).resolves.toBe(false);
    expect(state.profile.user_id).toBeNull();
    expect(state.transactions.size).toBe(1);
  });

  it("normalizes the category boolean in both SQLite-to-cloud and cloud-to-SQLite directions", async () => {
    const state = createTestDatabase("user-1");
    const category = {
      id: CATEGORY_FOOD_ID,
      user_id: "user-1",
      local_owner_id: "local-owner-1",
      name: "Food",
      icon: "restaurant-outline",
      color: "#D97706",
      transaction_type: "expense",
      is_default: 1,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-30T00:00:00.000Z",
      deleted_at: null,
      sync_status: "pending",
      local_updated_at: "2026-08-30T00:00:00.000Z",
      last_synced_at: null,
    };
    state.db.getFirstAsync.mockImplementationOnce(async () => category);
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);
    await expect(
      getCloudPayload("categories", CATEGORY_FOOD_ID),
    ).resolves.toEqual(expect.objectContaining({ is_default: true }));

    state.db.runAsync.mockClear();
    await mergeRemoteRows("categories", [{ ...category, is_default: false }]);
    const insertCall = state.db.runAsync.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO categories"),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall).toContain(0);
  });
});
