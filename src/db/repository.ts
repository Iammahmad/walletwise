import * as Crypto from "expo-crypto";
import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";

import { getDatabase, reseedDatabase } from "./database";
import type {
  Account,
  Budget,
  BudgetCategory,
  BudgetCategoryInput,
  BudgetProgress,
  Category,
  CategoryInput,
  DashboardSummary,
  LocalProfile,
  Transaction,
  TransactionFilters,
  TransactionInput,
} from "@/src/domain/types";
import {
  budgetCategoryInputSchema,
  categoryInputSchema,
} from "@/src/domain/schemas";
import { selectMonthlyBudgets } from "@/src/domain/budgets";

type Row = Record<string, string | number | boolean | null>;

const CLOUD_COLUMNS: Record<
  Exclude<OutboxItem["entityType"], "profiles">,
  readonly string[]
> = {
  accounts: [
    "id",
    "user_id",
    "name",
    "type",
    "currency",
    "opening_balance_minor",
    "archived_at",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
  categories: [
    "id",
    "user_id",
    "name",
    "icon",
    "color",
    "transaction_type",
    "is_default",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
  budget_categories: [
    "id",
    "user_id",
    "source_category_id",
    "name",
    "icon",
    "color",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
  transactions: [
    "id",
    "user_id",
    "account_id",
    "category_id",
    "budget_category_id",
    "budget_assignment_mode",
    "type",
    "amount_minor",
    "currency",
    "merchant",
    "note",
    "occurred_at",
    "source",
    "original_transcript",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
  budgets: [
    "id",
    "user_id",
    "budget_category_id",
    "amount_minor",
    "currency",
    "period",
    "start_date",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
  savings: [
    "id",
    "user_id",
    "name",
    "amount_minor",
    "currency",
    "occurred_at",
    "note",
    "source",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
  split_contacts: [
    "id",
    "user_id",
    "remote_user_id",
    "display_name",
    "email",
    "status",
    "invite_token",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
  splits: [
    "id",
    "user_id",
    "created_by_user_id",
    "description",
    "split_type",
    "loan_direction",
    "total_minor",
    "currency",
    "occurred_at",
    "status",
    "note",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
  split_settlements: [
    "id",
    "user_id",
    "split_id",
    "contact_id",
    "direction",
    "amount_minor",
    "currency",
    "occurred_at",
    "note",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
};

function asString(row: Row, key: string): string {
  return String(row[key] ?? "");
}

function nullableString(row: Row, key: string): string | null {
  const value = row[key];
  return value == null ? null : String(value);
}

function mapProfile(row: Row): LocalProfile {
  return {
    id: asString(row, "id"),
    userId: nullableString(row, "user_id"),
    defaultCurrency: asString(row, "default_currency"),
    locale: asString(row, "locale"),
    timezone: asString(row, "timezone"),
    onboardingCompleted: Number(row.onboarding_completed) === 1,
    cloudAiEnabled: Number(row.cloud_ai_enabled) === 1,
    theme: asString(row, "theme") as LocalProfile["theme"],
    createdAt: asString(row, "created_at"),
    updatedAt: asString(row, "updated_at"),
  };
}

function mapAccount(row: Row): Account {
  return {
    id: asString(row, "id"),
    userId: nullableString(row, "user_id"),
    localOwnerId: asString(row, "local_owner_id"),
    name: asString(row, "name"),
    type: asString(row, "type") as Account["type"],
    currency: asString(row, "currency"),
    openingBalanceMinor: Number(row.opening_balance_minor),
    archivedAt: nullableString(row, "archived_at"),
    createdAt: asString(row, "created_at"),
    updatedAt: asString(row, "updated_at"),
    deletedAt: nullableString(row, "deleted_at"),
    syncStatus: asString(row, "sync_status") as Account["syncStatus"],
    localUpdatedAt: asString(row, "local_updated_at"),
    lastSyncedAt: nullableString(row, "last_synced_at"),
  };
}

function mapCategory(row: Row): Category {
  return {
    id: asString(row, "id"),
    userId: nullableString(row, "user_id"),
    localOwnerId: asString(row, "local_owner_id"),
    name: asString(row, "name"),
    icon: asString(row, "icon"),
    color: asString(row, "color"),
    transactionType: asString(
      row,
      "transaction_type",
    ) as Category["transactionType"],
    isDefault: Number(row.is_default) === 1,
    createdAt: asString(row, "created_at"),
    updatedAt: asString(row, "updated_at"),
    deletedAt: nullableString(row, "deleted_at"),
    syncStatus: asString(row, "sync_status") as Category["syncStatus"],
    localUpdatedAt: asString(row, "local_updated_at"),
    lastSyncedAt: nullableString(row, "last_synced_at"),
  };
}

function mapBudgetCategory(row: Row): BudgetCategory {
  return {
    id: asString(row, "id"),
    userId: nullableString(row, "user_id"),
    localOwnerId: asString(row, "local_owner_id"),
    sourceCategoryId: nullableString(row, "source_category_id"),
    name: asString(row, "name"),
    icon: asString(row, "icon"),
    color: asString(row, "color"),
    createdAt: asString(row, "created_at"),
    updatedAt: asString(row, "updated_at"),
    deletedAt: nullableString(row, "deleted_at"),
    syncStatus: asString(row, "sync_status") as BudgetCategory["syncStatus"],
    localUpdatedAt: asString(row, "local_updated_at"),
    lastSyncedAt: nullableString(row, "last_synced_at"),
    sourceCategoryName: nullableString(row, "source_category_name"),
  };
}

function mapTransaction(row: Row): Transaction {
  return {
    id: asString(row, "id"),
    userId: nullableString(row, "user_id"),
    localOwnerId: asString(row, "local_owner_id"),
    accountId: asString(row, "account_id"),
    categoryId: asString(row, "category_id"),
    budgetCategoryId: nullableString(row, "budget_category_id"),
    budgetAssignmentMode:
      (nullableString(
        row,
        "budget_assignment_mode",
      ) as Transaction["budgetAssignmentMode"]) ??
      (row.budget_category_id ? "explicit" : "none"),
    type: asString(row, "type") as Transaction["type"],
    amountMinor: Number(row.amount_minor),
    currency: asString(row, "currency"),
    merchant: nullableString(row, "merchant"),
    note: nullableString(row, "note"),
    occurredAt: asString(row, "occurred_at"),
    source: asString(row, "source") as Transaction["source"],
    originalTranscript: nullableString(row, "original_transcript"),
    createdAt: asString(row, "created_at"),
    updatedAt: asString(row, "updated_at"),
    deletedAt: nullableString(row, "deleted_at"),
    syncStatus: asString(row, "sync_status") as Transaction["syncStatus"],
    localUpdatedAt: asString(row, "local_updated_at"),
    lastSyncedAt: nullableString(row, "last_synced_at"),
    accountName: nullableString(row, "account_name") ?? undefined,
    categoryName: nullableString(row, "category_name") ?? undefined,
    categoryIcon: nullableString(row, "category_icon") ?? undefined,
    categoryColor: nullableString(row, "category_color") ?? undefined,
    budgetCategoryName:
      nullableString(row, "budget_category_name") ?? undefined,
    budgetCategoryIcon:
      nullableString(row, "budget_category_icon") ?? undefined,
    budgetCategoryColor:
      nullableString(row, "budget_category_color") ?? undefined,
  };
}

function mapBudget(row: Row): Budget {
  return {
    id: asString(row, "id"),
    userId: nullableString(row, "user_id"),
    localOwnerId: asString(row, "local_owner_id"),
    budgetCategoryId: nullableString(row, "budget_category_id"),
    amountMinor: Number(row.amount_minor),
    currency: asString(row, "currency"),
    period: "monthly",
    startDate: asString(row, "start_date"),
    createdAt: asString(row, "created_at"),
    updatedAt: asString(row, "updated_at"),
    deletedAt: nullableString(row, "deleted_at"),
    syncStatus: asString(row, "sync_status") as Budget["syncStatus"],
    localUpdatedAt: asString(row, "local_updated_at"),
    lastSyncedAt: nullableString(row, "last_synced_at"),
    budgetCategoryName: nullableString(row, "budget_category_name"),
    budgetCategoryIcon: nullableString(row, "budget_category_icon"),
    budgetCategoryColor: nullableString(row, "budget_category_color"),
  };
}

const TRANSACTION_SELECT = `SELECT t.*, a.name AS account_name,
  c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
  bc.name AS budget_category_name, bc.icon AS budget_category_icon, bc.color AS budget_category_color
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  JOIN categories c ON c.id = t.category_id
  LEFT JOIN budget_categories bc ON bc.id = t.budget_category_id`;

function applyAutomaticBudgetNames(
  transactions: Transaction[],
  budgetCategories: BudgetCategory[],
): Transaction[] {
  return transactions.map((transaction) => {
    if (transaction.budgetAssignmentMode === "none") {
      return {
        ...transaction,
        budgetCategoryName: undefined,
        budgetCategoryIcon: undefined,
        budgetCategoryColor: undefined,
      };
    }
    if (transaction.budgetAssignmentMode === "explicit") return transaction;
    const matches = budgetCategories.filter(
      (budgetCategory) =>
        transaction.categoryName?.trim().toLocaleLowerCase() ===
        budgetCategory.name.trim().toLocaleLowerCase(),
    );
    return {
      ...transaction,
      budgetCategoryName:
        matches.map((item) => item.name).join(", ") || undefined,
      budgetCategoryIcon: matches.length === 1 ? matches[0]?.icon : undefined,
      budgetCategoryColor: matches.length === 1 ? matches[0]?.color : undefined,
    };
  });
}

async function mapTransactionsWithBudgets(rows: Row[]): Promise<Transaction[]> {
  const transactions = rows.map(mapTransaction);
  if (!transactions.some((item) => item.budgetAssignmentMode === "auto")) {
    return transactions;
  }
  return applyAutomaticBudgetNames(transactions, await listBudgetCategories());
}

async function activeProfile(db?: SQLiteDatabase): Promise<LocalProfile> {
  const connection = db ?? (await getDatabase());
  const row = await connection.getFirstAsync<Row>(
    "SELECT * FROM local_profile LIMIT 1",
  );
  if (!row) throw new Error("Local profile is unavailable.");
  return mapProfile(row);
}

async function enqueue(
  db: SQLiteDatabase,
  userId: string | null,
  entityType: string,
  entityId: string,
): Promise<void> {
  if (!userId) return;
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_outbox (id, user_id, entity_type, entity_id, operation, attempt_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'upsert', 0, ?, ?)
     ON CONFLICT(entity_type, entity_id) DO UPDATE SET
       operation = 'upsert', attempt_count = 0, next_retry_at = NULL, last_error_code = NULL, updated_at = excluded.updated_at`,
    Crypto.randomUUID(),
    userId,
    entityType,
    entityId,
    now,
    now,
  );
}

export async function getProfile(): Promise<LocalProfile> {
  return activeProfile();
}

export async function updateProfile(
  changes: Partial<
    Pick<
      LocalProfile,
      | "defaultCurrency"
      | "locale"
      | "timezone"
      | "cloudAiEnabled"
      | "theme"
      | "onboardingCompleted"
    >
  >,
): Promise<LocalProfile> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const next = { ...profile, ...changes, updatedAt: new Date().toISOString() };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE local_profile SET default_currency = ?, locale = ?, timezone = ?, onboarding_completed = ?,
       cloud_ai_enabled = ?, theme = ?, updated_at = ? WHERE id = ?`,
      next.defaultCurrency,
      next.locale,
      next.timezone,
      next.onboardingCompleted ? 1 : 0,
      next.cloudAiEnabled ? 1 : 0,
      next.theme,
      next.updatedAt,
      next.id,
    );
    if (changes.defaultCurrency) {
      await db.runAsync(
        `UPDATE accounts SET currency = ?, updated_at = ?, local_updated_at = ?, sync_status = CASE WHEN user_id IS NULL THEN 'local' ELSE 'pending' END
         WHERE local_owner_id = ? AND deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM transactions WHERE transactions.account_id = accounts.id)`,
        next.defaultCurrency,
        next.updatedAt,
        next.updatedAt,
        next.id,
      );
    }
    await enqueue(db, profile.userId, "profiles", profile.userId ?? profile.id);
  });
  return next;
}

export async function listAccounts(): Promise<Account[]> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM accounts WHERE local_owner_id = ? AND deleted_at IS NULL AND archived_at IS NULL ORDER BY CASE type WHEN 'cash' THEN 0 WHEN 'bank' THEN 1 ELSE 2 END, name`,
    profile.id,
  );
  return rows.map(mapAccount);
}

export async function listCategories(
  type?: "expense" | "income",
): Promise<Category[]> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const rows = type
    ? await db.getAllAsync<Row>(
        "SELECT * FROM categories WHERE local_owner_id = ? AND transaction_type = ? AND deleted_at IS NULL ORDER BY name",
        profile.id,
        type,
      )
    : await db.getAllAsync<Row>(
        "SELECT * FROM categories WHERE local_owner_id = ? AND deleted_at IS NULL ORDER BY transaction_type, name",
        profile.id,
      );
  return rows.map(mapCategory);
}

export async function listBudgetCategories(): Promise<BudgetCategory[]> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const rows = await db.getAllAsync<Row>(
    `SELECT bc.*, c.name AS source_category_name
     FROM budget_categories bc
     LEFT JOIN categories c ON c.id = bc.source_category_id
     WHERE bc.local_owner_id = ? AND bc.deleted_at IS NULL
     ORDER BY bc.name COLLATE NOCASE`,
    profile.id,
  );
  return rows.map(mapBudgetCategory);
}

export async function getBudgetCategory(
  id: string,
): Promise<BudgetCategory | null> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const row = await db.getFirstAsync<Row>(
    `SELECT bc.*, c.name AS source_category_name
     FROM budget_categories bc
     LEFT JOIN categories c ON c.id = bc.source_category_id
     WHERE bc.id = ? AND bc.local_owner_id = ?`,
    id,
    profile.id,
  );
  return row ? mapBudgetCategory(row) : null;
}

export async function saveBudgetCategory(
  input: BudgetCategoryInput,
): Promise<BudgetCategory> {
  const parsed = budgetCategoryInputSchema.parse(input);
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const duplicate = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM budget_categories
     WHERE local_owner_id = ? AND deleted_at IS NULL AND lower(name) = lower(?) AND id != ?
     LIMIT 1`,
    profile.id,
    parsed.name,
    parsed.id ?? "",
  );
  if (duplicate)
    throw new Error(`A budget category named “${parsed.name}” already exists.`);

  const existing = parsed.id
    ? await db.getFirstAsync<Row>(
        "SELECT * FROM budget_categories WHERE id = ? AND local_owner_id = ?",
        parsed.id,
        profile.id,
      )
    : null;
  if (parsed.id && !existing)
    throw new Error("The budget category no longer exists.");

  const id = parsed.id ?? Crypto.randomUUID();
  const now = new Date().toISOString();
  const createdAt = existing ? asString(existing, "created_at") : now;
  const sourceCategoryId =
    parsed.sourceCategoryId === undefined
      ? nullableString(existing ?? {}, "source_category_id")
      : parsed.sourceCategoryId;
  const syncStatus = profile.userId ? "pending" : "local";
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO budget_categories
       (id, user_id, local_owner_id, source_category_id, name, icon, color, created_at, updated_at,
        deleted_at, sync_status, local_updated_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET source_category_id = excluded.source_category_id,
        name = excluded.name, icon = excluded.icon, color = excluded.color,
        updated_at = excluded.updated_at, deleted_at = NULL,
        sync_status = excluded.sync_status, local_updated_at = excluded.local_updated_at`,
      id,
      profile.userId,
      profile.id,
      sourceCategoryId,
      parsed.name,
      parsed.icon,
      parsed.color.toUpperCase(),
      createdAt,
      now,
      syncStatus,
      now,
    );
    await enqueue(db, profile.userId, "budget_categories", id);
  });
  const saved = await getBudgetCategory(id);
  if (!saved)
    throw new Error("The budget category could not be read after saving.");
  return saved;
}

export async function deleteBudgetCategory(id: string): Promise<void> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE budget_categories
       SET deleted_at = ?, updated_at = ?, local_updated_at = ?, sync_status = ?
       WHERE id = ? AND local_owner_id = ?`,
      now,
      now,
      now,
      profile.userId ? "pending" : "local",
      id,
      profile.id,
    );
    await enqueue(db, profile.userId, "budget_categories", id);
  });
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const parsed = categoryInputSchema.parse(input);
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const duplicate = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM categories
     WHERE local_owner_id = ? AND transaction_type = ? AND deleted_at IS NULL AND lower(name) = lower(?)
     LIMIT 1`,
    profile.id,
    parsed.transactionType,
    parsed.name,
  );
  if (duplicate)
    throw new Error(
      `A ${parsed.transactionType} category named “${parsed.name}” already exists.`,
    );

  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const syncStatus = profile.userId ? "pending" : "local";
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO categories
       (id, user_id, local_owner_id, name, icon, color, transaction_type, is_default,
        created_at, updated_at, deleted_at, sync_status, local_updated_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, ?, NULL)`,
      id,
      profile.userId,
      profile.id,
      parsed.name,
      parsed.icon,
      parsed.color.toUpperCase(),
      parsed.transactionType,
      now,
      now,
      syncStatus,
      now,
    );
    await enqueue(db, profile.userId, "categories", id);
    if (parsed.transactionType === "expense") {
      await db.runAsync(
        `INSERT INTO budget_categories
         (id, user_id, local_owner_id, source_category_id, name, icon, color, created_at, updated_at,
          deleted_at, sync_status, local_updated_at, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
        id,
        profile.userId,
        profile.id,
        id,
        parsed.name,
        parsed.icon,
        parsed.color.toUpperCase(),
        now,
        now,
        syncStatus,
        now,
      );
      await enqueue(db, profile.userId, "budget_categories", id);
    }
  });
  const row = await db.getFirstAsync<Row>(
    "SELECT * FROM categories WHERE id = ? AND local_owner_id = ? AND deleted_at IS NULL",
    id,
    profile.id,
  );
  if (!row) throw new Error("The category could not be read after saving.");
  return mapCategory(row);
}

export async function saveTransaction(
  input: TransactionInput,
): Promise<Transaction> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const existing = input.id
    ? await db.getFirstAsync<Row>(
        "SELECT * FROM transactions WHERE id = ?",
        input.id,
      )
    : null;
  const id = input.id ?? Crypto.randomUUID();
  const now = new Date().toISOString();
  const createdAt = existing ? asString(existing, "created_at") : now;
  const syncStatus = profile.userId ? "pending" : "local";
  let budgetCategoryId: string | null = null;
  let budgetAssignmentMode: Transaction["budgetAssignmentMode"] = "none";
  if (input.type === "expense") {
    if (input.budgetCategoryId === undefined) {
      budgetAssignmentMode = "auto";
    } else if (input.budgetCategoryId === null) {
      budgetAssignmentMode = "none";
    } else {
      const selected = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM budget_categories WHERE id = ? AND local_owner_id = ? AND deleted_at IS NULL",
        input.budgetCategoryId,
        profile.id,
      );
      if (!selected) throw new Error("Choose a valid budget category.");
      budgetAssignmentMode = "explicit";
      budgetCategoryId = input.budgetCategoryId;
    }
  }
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transactions
       (id, user_id, local_owner_id, account_id, category_id, budget_category_id, budget_assignment_mode, type, amount_minor, currency, merchant, note,
        occurred_at, source, original_transcript, created_at, updated_at, deleted_at, sync_status, local_updated_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, category_id = excluded.category_id,
        budget_category_id = excluded.budget_category_id,
        budget_assignment_mode = excluded.budget_assignment_mode,
        type = excluded.type, amount_minor = excluded.amount_minor, currency = excluded.currency,
        merchant = excluded.merchant, note = excluded.note, occurred_at = excluded.occurred_at,
        source = excluded.source, original_transcript = excluded.original_transcript,
        updated_at = excluded.updated_at, deleted_at = NULL, sync_status = excluded.sync_status,
        local_updated_at = excluded.local_updated_at`,
      id,
      profile.userId,
      profile.id,
      input.accountId,
      input.categoryId,
      budgetCategoryId,
      budgetAssignmentMode,
      input.type,
      input.amountMinor,
      input.currency,
      input.merchant,
      input.note,
      input.occurredAt,
      input.source,
      input.originalTranscript,
      createdAt,
      now,
      syncStatus,
      now,
    );
    await enqueue(db, profile.userId, "transactions", id);
  });
  const saved = await getTransaction(id);
  if (!saved)
    throw new Error("The transaction could not be read after saving.");
  return saved;
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Row>(
    `${TRANSACTION_SELECT} WHERE t.id = ?`,
    id,
  );
  if (!row) return null;
  return (await mapTransactionsWithBudgets([row]))[0] ?? null;
}

export async function listTransactions(
  filters: TransactionFilters = {},
): Promise<Transaction[]> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const conditions = ["t.local_owner_id = ?", "t.deleted_at IS NULL"];
  const params: SQLiteBindValue[] = [profile.id];
  if (filters.search?.trim()) {
    conditions.push(
      `(t.merchant LIKE ? COLLATE NOCASE OR t.note LIKE ? COLLATE NOCASE OR c.name LIKE ? COLLATE NOCASE OR bc.name LIKE ? COLLATE NOCASE)`,
    );
    const search = `%${filters.search.trim()}%`;
    params.push(search, search, search, search);
  }
  if (filters.type && filters.type !== "all") {
    conditions.push("t.type = ?");
    params.push(filters.type);
  }
  if (filters.accountId) {
    conditions.push("t.account_id = ?");
    params.push(filters.accountId);
  }
  if (filters.categoryId) {
    conditions.push("t.category_id = ?");
    params.push(filters.categoryId);
  }
  if (filters.budgetCategoryId) {
    const budgetCategory = await getBudgetCategory(filters.budgetCategoryId);
    if (!budgetCategory) return [];
    conditions.push(
      `((t.budget_assignment_mode = 'explicit' AND t.budget_category_id = ?)
        OR (t.budget_assignment_mode = 'auto' AND lower(c.name) = lower(?)))`,
    );
    params.push(filters.budgetCategoryId, budgetCategory.name);
  }
  if (filters.dateFrom) {
    conditions.push("t.occurred_at >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push("t.occurred_at < ?");
    params.push(filters.dateTo);
  }
  const limit = Math.min(Math.max(filters.limit ?? 500, 1), 1000);
  const rows = await db.getAllAsync<Row>(
    `${TRANSACTION_SELECT}
     WHERE ${conditions.join(" AND ")} ORDER BY t.occurred_at DESC, t.created_at DESC LIMIT ${limit}`,
    ...params,
  );
  return mapTransactionsWithBudgets(rows);
}

export async function setTransactionDeleted(
  id: string,
  deleted: boolean,
): Promise<void> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE transactions SET deleted_at = ?, updated_at = ?, local_updated_at = ?, sync_status = ? WHERE id = ? AND local_owner_id = ?`,
      deleted ? now : null,
      now,
      now,
      profile.userId ? "pending" : "local",
      id,
      profile.id,
    );
    await enqueue(db, profile.userId, "transactions", id);
  });
}

export async function findRecentTransaction(
  query: string,
): Promise<Transaction[]> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const tokens = query
    .toLowerCase()
    .replace(/\b(expense|transaction|i|added|a|the|minute|ago)\b/g, " ")
    .trim();
  const search = `%${tokens || query.trim()}%`;
  const rows = await db.getAllAsync<Row>(
    `${TRANSACTION_SELECT}
     WHERE t.local_owner_id = ? AND t.deleted_at IS NULL
       AND (t.merchant LIKE ? COLLATE NOCASE OR t.note LIKE ? COLLATE NOCASE OR c.name LIKE ? COLLATE NOCASE OR bc.name LIKE ? COLLATE NOCASE OR t.original_transcript LIKE ? COLLATE NOCASE)
     ORDER BY t.created_at DESC LIMIT 5`,
    profile.id,
    search,
    search,
    search,
    search,
    search,
  );
  return mapTransactionsWithBudgets(rows);
}

export async function getDashboardSummary(
  start: string,
  end: string,
): Promise<DashboardSummary> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const totals = await db.getFirstAsync<{
    spending_minor: number;
    income_minor: number;
  }>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_minor ELSE 0 END), 0) AS spending_minor,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount_minor ELSE 0 END), 0) AS income_minor
     FROM transactions WHERE local_owner_id = ? AND currency = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?`,
    profile.id,
    profile.defaultCurrency,
    start,
    end,
  );
  const categories = await db.getAllAsync<{
    category_id: string;
    name: string;
    color: string;
    amount_minor: number;
  }>(
    `SELECT t.category_id, c.name, c.color, SUM(t.amount_minor) AS amount_minor
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.local_owner_id = ? AND t.type = 'expense' AND t.currency = ? AND t.deleted_at IS NULL AND t.occurred_at >= ? AND t.occurred_at < ?
     GROUP BY t.category_id, c.name, c.color ORDER BY amount_minor DESC`,
    profile.id,
    profile.defaultCurrency,
    start,
    end,
  );
  return {
    spendingMinor: totals?.spending_minor ?? 0,
    incomeMinor: totals?.income_minor ?? 0,
    categoryTotals: categories.map((row) => ({
      categoryId: row.category_id,
      name: row.name,
      color: row.color,
      amountMinor: row.amount_minor,
    })),
  };
}

export async function listBudgets(): Promise<Budget[]> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const rows = await db.getAllAsync<Row>(
    `SELECT b.*, bc.name AS budget_category_name, bc.icon AS budget_category_icon, bc.color AS budget_category_color
     FROM budgets b LEFT JOIN budget_categories bc ON bc.id = b.budget_category_id
     WHERE b.local_owner_id = ? AND b.deleted_at IS NULL AND b.budget_category_id IS NOT NULL
     ORDER BY bc.name COLLATE NOCASE`,
    profile.id,
  );
  return rows.map(mapBudget);
}

export async function getBudgetProgress(
  start: string,
  end: string,
  monthStart: string,
): Promise<BudgetProgress[]> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const [budgets, budgetCategories, spendingRows] = await Promise.all([
    listBudgets(),
    listBudgetCategories(),
    db.getAllAsync<{
      amount_minor: number;
      category_id: string;
      category_name: string;
      budget_category_id: string | null;
      budget_assignment_mode: Transaction["budgetAssignmentMode"];
      currency: string;
    }>(
      `SELECT t.amount_minor, t.category_id, c.name AS category_name,
              t.budget_category_id, t.budget_assignment_mode, t.currency
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.local_owner_id = ? AND t.type = 'expense' AND t.deleted_at IS NULL
         AND t.occurred_at >= ? AND t.occurred_at < ?`,
      profile.id,
      start,
      end,
    ),
  ]);
  const monthlyBudgets = selectMonthlyBudgets(budgets, monthStart);
  return monthlyBudgets.map((budget) => {
    const budgetCategory = budget.budgetCategoryId
      ? budgetCategories.find((item) => item.id === budget.budgetCategoryId)
      : null;
    const spentMinor = spendingRows.reduce((total, transaction) => {
      if (transaction.currency !== budget.currency) return total;
      if (
        transaction.budget_assignment_mode === "explicit" &&
        transaction.budget_category_id === budget.budgetCategoryId
      ) {
        return total + Number(transaction.amount_minor);
      }
      if (
        transaction.budget_assignment_mode === "auto" &&
        budgetCategory &&
        transaction.category_name.trim().toLocaleLowerCase() ===
          budgetCategory.name.trim().toLocaleLowerCase()
      ) {
        return total + Number(transaction.amount_minor);
      }
      return total;
    }, 0);
    if (!Number.isSafeInteger(spentMinor) || spentMinor < 0) {
      throw new Error("Budget spending total is outside the supported range.");
    }
    return {
      budget,
      spentMinor,
      remainingMinor: budget.amountMinor - spentMinor,
    };
  });
}

export async function saveBudget(input: {
  id?: string;
  budgetCategoryId: string;
  amountMinor: number;
  currency: string;
  startDate: string;
}): Promise<Budget> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const category = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM budget_categories WHERE id = ? AND local_owner_id = ? AND deleted_at IS NULL",
    input.budgetCategoryId,
    profile.id,
  );
  if (!category) throw new Error("Choose a valid budget category.");
  if (!input.id) {
    const duplicate = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM budgets WHERE local_owner_id = ? AND currency = ? AND start_date = ? AND deleted_at IS NULL
       AND budget_category_id = ? LIMIT 1`,
      profile.id,
      input.currency,
      input.startDate,
      input.budgetCategoryId,
    );
    if (duplicate)
      throw new Error(
        "A budget for this scope already exists this month. Edit the existing budget instead.",
      );
  }
  const id = input.id ?? Crypto.randomUUID();
  const existing = input.id
    ? await db.getFirstAsync<Row>(
        "SELECT created_at FROM budgets WHERE id = ?",
        input.id,
      )
    : null;
  const now = new Date().toISOString();
  const createdAt = existing ? asString(existing, "created_at") : now;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO budgets
       (id, user_id, local_owner_id, budget_category_id, amount_minor, currency, period, start_date, created_at, updated_at, deleted_at, sync_status, local_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'monthly', ?, ?, ?, NULL, ?, ?)
       ON CONFLICT(id) DO UPDATE SET budget_category_id = excluded.budget_category_id, amount_minor = excluded.amount_minor,
       currency = excluded.currency, start_date = excluded.start_date, updated_at = excluded.updated_at,
       deleted_at = NULL, sync_status = excluded.sync_status, local_updated_at = excluded.local_updated_at`,
      id,
      profile.userId,
      profile.id,
      input.budgetCategoryId,
      input.amountMinor,
      input.currency,
      input.startDate,
      createdAt,
      now,
      profile.userId ? "pending" : "local",
      now,
    );
    await enqueue(db, profile.userId, "budgets", id);
  });
  const rows = await listBudgets();
  const budget = rows.find((item) => item.id === id);
  if (!budget) throw new Error("The budget could not be read after saving.");
  return budget;
}

export async function deleteBudget(id: string): Promise<void> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE budgets SET deleted_at = ?, updated_at = ?, local_updated_at = ?, sync_status = ? WHERE id = ? AND local_owner_id = ?`,
      now,
      now,
      now,
      profile.userId ? "pending" : "local",
      id,
      profile.id,
    );
    await enqueue(db, profile.userId, "budgets", id);
  });
}

export async function linkLocalDataToUser(userId: string): Promise<void> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE local_profile SET user_id = ?, updated_at = ? WHERE id = ?",
      userId,
      now,
      profile.id,
    );
    for (const table of [
      "accounts",
      "categories",
      "budget_categories",
      "transactions",
      "budgets",
      "savings",
      "split_contacts",
      "splits",
      "split_settlements",
    ] as const) {
      await db.runAsync(
        `UPDATE ${table} SET user_id = ?, sync_status = 'pending', updated_at = ?, local_updated_at = ? WHERE local_owner_id = ?`,
        userId,
        now,
        now,
        profile.id,
      );
      const rows = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM ${table} WHERE local_owner_id = ?`,
        profile.id,
      );
      for (const row of rows) await enqueue(db, userId, table, row.id);
    }
    await enqueue(db, userId, "profiles", userId);
  });
}

export async function preparePristineLocalDataForCloudRestore(
  userId: string,
): Promise<boolean> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const transactionCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM transactions WHERE local_owner_id = ?",
    profile.id,
  );
  const budgetCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM budgets WHERE local_owner_id = ?",
    profile.id,
  );
  const savingCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM savings WHERE local_owner_id = ?",
    profile.id,
  );
  const splitCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM splits WHERE local_owner_id = ?",
    profile.id,
  );
  const splitContactCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM split_contacts WHERE local_owner_id = ?",
    profile.id,
  );
  if (
    (transactionCount?.count ?? 0) > 0 ||
    (budgetCount?.count ?? 0) > 0 ||
    (savingCount?.count ?? 0) > 0 ||
    (splitCount?.count ?? 0) > 0 ||
    (splitContactCount?.count ?? 0) > 0
  )
    return false;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "DELETE FROM accounts WHERE local_owner_id = ?",
      profile.id,
    );
    await db.runAsync(
      "DELETE FROM budget_categories WHERE local_owner_id = ?",
      profile.id,
    );
    await db.runAsync(
      "DELETE FROM categories WHERE local_owner_id = ?",
      profile.id,
    );
    await db.runAsync("DELETE FROM sync_outbox");
    await db.runAsync("DELETE FROM sync_state");
    // An old timestamp ensures an existing cloud profile wins the first merge.
    await db.runAsync(
      "UPDATE local_profile SET user_id = ?, cloud_ai_enabled = 0, updated_at = ? WHERE id = ?",
      userId,
      "1970-01-01T00:00:00.000Z",
      profile.id,
    );
  });
  return true;
}

export async function unlinkCloudUser(): Promise<void> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  await db.withTransactionAsync(async () => {
    // Preserve ownership and queued writes so this ledger cannot be relabeled
    // to another account and can resume safely after reauthentication.
    await db.runAsync(
      "UPDATE local_profile SET cloud_ai_enabled = 0, updated_at = ? WHERE id = ?",
      new Date().toISOString(),
      profile.id,
    );
    await db.runAsync("DELETE FROM sync_state");
  });
}

export async function resetLocalData(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync(
      `DELETE FROM sync_outbox; DELETE FROM sync_state; DELETE FROM split_settlements; DELETE FROM split_participants; DELETE FROM splits; DELETE FROM split_contacts; DELETE FROM savings; DELETE FROM transactions; DELETE FROM budgets; DELETE FROM budget_categories; DELETE FROM categories; DELETE FROM accounts; DELETE FROM local_profile;`,
    );
  });
  await reseedDatabase();
}

export interface OutboxItem {
  id: string;
  userId: string;
  entityType:
    | "profiles"
    | "accounts"
    | "categories"
    | "budget_categories"
    | "transactions"
    | "budgets"
    | "savings"
    | "split_contacts"
    | "splits"
    | "split_settlements";
  entityId: string;
  attemptCount: number;
}

export async function listOutbox(userId: string): Promise<OutboxItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM sync_outbox
     WHERE user_id = ? AND (next_retry_at IS NULL OR next_retry_at <= ?)
     ORDER BY CASE entity_type
       WHEN 'profiles' THEN 0
       WHEN 'accounts' THEN 1
       WHEN 'categories' THEN 2
       WHEN 'budget_categories' THEN 3
       WHEN 'transactions' THEN 4
       WHEN 'budgets' THEN 5
       WHEN 'savings' THEN 6
       WHEN 'split_contacts' THEN 7
       WHEN 'splits' THEN 8
       WHEN 'split_settlements' THEN 9
       ELSE 10 END,
       created_at
     LIMIT 100`,
    userId,
    new Date().toISOString(),
  );
  return rows.map((row) => ({
    id: asString(row, "id"),
    userId: asString(row, "user_id"),
    entityType: asString(row, "entity_type") as OutboxItem["entityType"],
    entityId: asString(row, "entity_id"),
    attemptCount: Number(row.attempt_count),
  }));
}

export async function getCloudPayload(
  entityType: OutboxItem["entityType"],
  entityId: string,
): Promise<Record<string, unknown> | null> {
  const db = await getDatabase();
  if (entityType === "profiles") {
    const profile = await activeProfile(db);
    if (!profile.userId) return null;
    return {
      user_id: profile.userId,
      default_currency: profile.defaultCurrency,
      locale: profile.locale,
      timezone: profile.timezone,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt,
    };
  }
  const row = await db.getFirstAsync<Row>(
    `SELECT * FROM ${entityType} WHERE id = ?`,
    entityId,
  );
  if (!row) return null;
  const omitted = new Set([
    "local_owner_id",
    "sync_status",
    "local_updated_at",
    "last_synced_at",
  ]);
  const payload: Record<string, unknown> = Object.fromEntries(
    Object.entries(row).filter(([key]) => !omitted.has(key)),
  );
  if (entityType === "categories")
    payload.is_default = Number(row.is_default) === 1;
  if (entityType === "splits") {
    const participants = await db.getAllAsync<Row>(
      `SELECT contact_id, remote_user_id, display_name, is_owner, share_minor, paid_minor
       FROM split_participants WHERE split_id = ? ORDER BY is_owner DESC, display_name`,
      entityId,
    );
    payload.participants = participants.map((participant) => ({
      contact_id: nullableString(participant, "contact_id"),
      remote_user_id: nullableString(participant, "remote_user_id"),
      display_name: asString(participant, "display_name"),
      is_owner: Number(participant.is_owner) === 1,
      share_minor: Number(participant.share_minor),
      paid_minor: Number(participant.paid_minor),
    }));
  }
  return payload;
}

export async function markOutboxSuccess(item: OutboxItem): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM sync_outbox WHERE id = ?", item.id);
    if (item.entityType !== "profiles") {
      await db.runAsync(
        `UPDATE ${item.entityType} SET sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
        now,
        item.entityId,
      );
    }
  });
}

export async function markOutboxFailure(
  item: OutboxItem,
  code: string,
): Promise<void> {
  const db = await getDatabase();
  const attempt = item.attemptCount + 1;
  const delayMs =
    Math.min(5 * 60_000, 2 ** Math.min(attempt, 8) * 1000) +
    Math.floor(Math.random() * 1000);
  const retry = new Date(Date.now() + delayMs).toISOString();
  await db.runAsync(
    `UPDATE sync_outbox SET attempt_count = ?, next_retry_at = ?, last_error_code = ?, updated_at = ? WHERE id = ?`,
    attempt,
    retry,
    code.slice(0, 80),
    new Date().toISOString(),
    item.id,
  );
}

function isValidRemoteRow(
  entityType: Exclude<OutboxItem["entityType"], "profiles">,
  row: Row,
  userId: string | null,
): boolean {
  const id = nullableString(row, "id");
  const rowUserId = nullableString(row, "user_id");
  const updatedAt = nullableString(row, "updated_at");
  if (
    !id ||
    !userId ||
    rowUserId !== userId ||
    !updatedAt ||
    Number.isNaN(Date.parse(updatedAt))
  )
    return false;
  if (
    entityType === "transactions" ||
    entityType === "budgets" ||
    entityType === "savings" ||
    entityType === "splits" ||
    entityType === "split_settlements"
  ) {
    const amount = Number(
      entityType === "splits" ? row.total_minor : row.amount_minor,
    );
    if (!Number.isSafeInteger(amount) || amount <= 0) return false;
    const currency = nullableString(row, "currency");
    if (!currency || !/^[A-Z]{3}$/.test(currency)) return false;
  }
  if (entityType === "transactions") {
    const mode = nullableString(row, "budget_assignment_mode");
    const budgetCategoryId = nullableString(row, "budget_category_id");
    if (!mode || !["auto", "explicit", "none"].includes(mode)) return false;
    if ((mode === "explicit") !== Boolean(budgetCategoryId)) return false;
  }
  if (entityType === "budgets" && !nullableString(row, "budget_category_id")) {
    return false;
  }
  if (entityType === "accounts") {
    const balance = Number(row.opening_balance_minor);
    if (!Number.isSafeInteger(balance)) return false;
  }
  return true;
}

export async function mergeRemoteProfile(row: Row): Promise<void> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  const userId = nullableString(row, "user_id");
  const currency = nullableString(row, "default_currency");
  const locale = nullableString(row, "locale");
  const timezone = nullableString(row, "timezone");
  const createdAt = nullableString(row, "created_at");
  const updatedAt = nullableString(row, "updated_at");
  if (
    !profile.userId ||
    userId !== profile.userId ||
    !currency ||
    !/^[A-Z]{3}$/.test(currency) ||
    !locale ||
    !timezone ||
    !createdAt ||
    !updatedAt ||
    Number.isNaN(Date.parse(createdAt)) ||
    Number.isNaN(Date.parse(updatedAt)) ||
    profile.updatedAt > updatedAt
  )
    return;
  await db.runAsync(
    `UPDATE local_profile SET default_currency = ?, locale = ?, timezone = ?, created_at = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    currency,
    locale,
    timezone,
    createdAt,
    updatedAt,
    profile.id,
    profile.userId,
  );
}

export async function mergeRemoteRows(
  entityType: Exclude<OutboxItem["entityType"], "profiles">,
  rows: Row[],
): Promise<void> {
  const db = await getDatabase();
  const profile = await activeProfile(db);
  for (const row of rows) {
    if (!isValidRemoteRow(entityType, row, profile.userId)) continue;
    const id = asString(row, "id");
    const local = await db.getFirstAsync<Row>(
      `SELECT updated_at, sync_status FROM ${entityType} WHERE id = ?`,
      id,
    );
    if (local && asString(local, "updated_at") > asString(row, "updated_at"))
      continue;
    const localRow = row;
    const columns = CLOUD_COLUMNS[entityType].filter((column) =>
      Object.hasOwn(localRow, column),
    );
    const values = columns.map((column) => {
      if (entityType === "categories" && column === "is_default")
        return localRow[column] === true || Number(localRow[column]) === 1
          ? 1
          : 0;
      return localRow[column] as SQLiteBindValue;
    });
    const localColumns = [
      ...columns,
      "local_owner_id",
      "sync_status",
      "local_updated_at",
      "last_synced_at",
    ];
    const placeholders = localColumns.map(() => "?").join(", ");
    const updates = localColumns
      .filter((column) => column !== "id")
      .map((column) => `${column} = excluded.${column}`)
      .join(", ");
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO ${entityType} (${localColumns.join(", ")}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`,
      ...values,
      profile.id,
      "synced",
      now,
      now,
    );
  }
}

export async function getLastPulledAt(
  userId: string,
  entityType: string,
): Promise<string> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ last_pulled_at: string | null }>(
    "SELECT last_pulled_at FROM sync_state WHERE user_id = ? AND entity_type = ?",
    userId,
    entityType,
  );
  return row?.last_pulled_at ?? "1970-01-01T00:00:00.000Z";
}

export async function setLastPulledAt(
  userId: string,
  entityType: string,
  value: string,
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_state (user_id, entity_type, last_pulled_at, last_success_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, entity_type) DO UPDATE SET last_pulled_at = excluded.last_pulled_at, last_success_at = excluded.last_success_at`,
    userId,
    entityType,
    value,
    now,
  );
}
