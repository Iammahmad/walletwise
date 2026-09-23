import * as Crypto from "expo-crypto";
import { getCalendars, getLocales } from "expo-localization";
import * as SQLite from "expo-sqlite";

import { DEFAULT_CATEGORIES } from "./seed";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRATION_1 = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS local_profile (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  default_currency TEXT NOT NULL CHECK(length(default_currency) = 3),
  locale TEXT NOT NULL,
  timezone TEXT NOT NULL,
  onboarding_completed INTEGER NOT NULL DEFAULT 0 CHECK(onboarding_completed IN (0, 1)),
  cloud_ai_enabled INTEGER NOT NULL DEFAULT 0 CHECK(cloud_ai_enabled IN (0, 1)),
  theme TEXT NOT NULL DEFAULT 'system' CHECK(theme IN ('system', 'light', 'dark')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  local_owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('cash', 'bank', 'wallet', 'credit', 'other')),
  currency TEXT NOT NULL CHECK(length(currency) = 3),
  opening_balance_minor INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK(sync_status IN ('local', 'pending', 'synced', 'error')),
  local_updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  local_owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('expense', 'income')),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK(sync_status IN ('local', 'pending', 'synced', 'error')),
  local_updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  local_owner_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  currency TEXT NOT NULL CHECK(length(currency) = 3),
  merchant TEXT,
  note TEXT,
  occurred_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('manual', 'voice')),
  original_transcript TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK(sync_status IN ('local', 'pending', 'synced', 'error')),
  local_updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  local_owner_id TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  currency TEXT NOT NULL CHECK(length(currency) = 3),
  period TEXT NOT NULL DEFAULT 'monthly' CHECK(period = 'monthly'),
  start_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK(sync_status IN ('local', 'pending', 'synced', 'error')),
  local_updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('profiles', 'accounts', 'categories', 'transactions', 'budgets')),
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'upsert' CHECK(operation IN ('upsert', 'delete')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS sync_state (
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  last_pulled_at TEXT,
  last_success_at TEXT,
  PRIMARY KEY(user_id, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_accounts_owner ON accounts(local_owner_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_categories_owner_type ON categories(local_owner_id, transaction_type, deleted_at);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred ON transactions(local_owner_id, occurred_at DESC, deleted_at);
CREATE INDEX IF NOT EXISTS idx_transactions_filters ON transactions(local_owner_id, type, account_id, category_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_budgets_owner_start ON budgets(local_owner_id, start_date, deleted_at);
CREATE INDEX IF NOT EXISTS idx_outbox_retry ON sync_outbox(user_id, next_retry_at, created_at);
PRAGMA user_version = 1;
`;

const MIGRATION_2 = `
CREATE TABLE IF NOT EXISTS budget_categories (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  local_owner_id TEXT NOT NULL,
  source_category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK(sync_status IN ('local', 'pending', 'synced', 'error')),
  local_updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

INSERT OR IGNORE INTO budget_categories
  (id, user_id, local_owner_id, source_category_id, name, icon, color, created_at, updated_at,
   deleted_at, sync_status, local_updated_at, last_synced_at)
SELECT id, user_id, local_owner_id, id, name, icon, color, created_at, updated_at,
       deleted_at, sync_status, local_updated_at, last_synced_at
FROM categories
WHERE transaction_type = 'expense';

ALTER TABLE transactions ADD COLUMN budget_category_id TEXT REFERENCES budget_categories(id) ON DELETE SET NULL;
ALTER TABLE budgets ADD COLUMN budget_category_id TEXT REFERENCES budget_categories(id) ON DELETE SET NULL;

UPDATE transactions
SET budget_category_id = (
  SELECT bc.id FROM budget_categories bc
  WHERE bc.local_owner_id = transactions.local_owner_id
    AND bc.source_category_id = transactions.category_id
  LIMIT 1
)
WHERE type = 'expense' AND budget_category_id IS NULL;

UPDATE budgets
SET budget_category_id = (
  SELECT bc.id FROM budget_categories bc
  WHERE bc.local_owner_id = budgets.local_owner_id
    AND bc.source_category_id = budgets.category_id
  LIMIT 1
)
WHERE category_id IS NOT NULL AND budget_category_id IS NULL;

ALTER TABLE sync_outbox RENAME TO sync_outbox_legacy;
CREATE TABLE sync_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('profiles', 'accounts', 'categories', 'budget_categories', 'transactions', 'budgets')),
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'upsert' CHECK(operation IN ('upsert', 'delete')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id)
);
INSERT OR IGNORE INTO sync_outbox SELECT * FROM sync_outbox_legacy;
DROP TABLE sync_outbox_legacy;

CREATE INDEX IF NOT EXISTS idx_budget_categories_owner ON budget_categories(local_owner_id, deleted_at, name);
CREATE INDEX IF NOT EXISTS idx_budget_categories_source ON budget_categories(local_owner_id, source_category_id, deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_categories_unique_source ON budget_categories(local_owner_id, source_category_id) WHERE source_category_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_budget_category ON transactions(local_owner_id, budget_category_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_budget_category ON budgets(local_owner_id, budget_category_id, start_date, deleted_at);
CREATE INDEX IF NOT EXISTS idx_outbox_retry ON sync_outbox(user_id, next_retry_at, created_at);
PRAGMA user_version = 2;
`;

const MIGRATION_3 = `
ALTER TABLE transactions ADD COLUMN budget_assignment_mode TEXT NOT NULL DEFAULT 'auto'
  CHECK(budget_assignment_mode IN ('auto', 'explicit', 'none'));

UPDATE transactions
SET budget_assignment_mode = CASE
  WHEN type != 'expense' OR budget_category_id IS NULL THEN 'none'
  WHEN EXISTS (
    SELECT 1 FROM budget_categories bc
    WHERE bc.id = transactions.budget_category_id
      AND (
        bc.source_category_id = transactions.category_id
        OR lower(trim(bc.name)) = lower(trim((
          SELECT c.name FROM categories c WHERE c.id = transactions.category_id
        )))
      )
  ) THEN 'auto'
  ELSE 'explicit'
END;

UPDATE transactions
SET budget_category_id = NULL
WHERE budget_assignment_mode = 'auto';

CREATE INDEX IF NOT EXISTS idx_transactions_budget_assignment
  ON transactions(local_owner_id, budget_assignment_mode, category_id, budget_category_id, occurred_at DESC);
PRAGMA user_version = 3;
`;

const MIGRATION_4 = `
CREATE TABLE IF NOT EXISTS savings (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  local_owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  currency TEXT NOT NULL CHECK(length(currency) = 3),
  occurred_at TEXT NOT NULL,
  note TEXT,
  source TEXT NOT NULL CHECK(source IN ('manual', 'voice')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK(sync_status IN ('local', 'pending', 'synced', 'error')),
  local_updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS split_contacts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  local_owner_id TEXT NOT NULL,
  remote_user_id TEXT,
  display_name TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'local' CHECK(status IN ('local', 'invited', 'connected')),
  invite_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK(sync_status IN ('local', 'pending', 'synced', 'error')),
  local_updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS splits (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  local_owner_id TEXT NOT NULL,
  created_by_user_id TEXT,
  description TEXT NOT NULL,
  split_type TEXT NOT NULL CHECK(split_type IN ('equal', 'loan')),
  loan_direction TEXT CHECK(loan_direction IN ('lent', 'borrowed') OR loan_direction IS NULL),
  total_minor INTEGER NOT NULL CHECK(total_minor > 0),
  currency TEXT NOT NULL CHECK(length(currency) = 3),
  occurred_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'settled')),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK(sync_status IN ('local', 'pending', 'synced', 'error')),
  local_updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS split_participants (
  id TEXT PRIMARY KEY NOT NULL,
  split_id TEXT NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES split_contacts(id) ON DELETE SET NULL,
  remote_user_id TEXT,
  display_name TEXT NOT NULL,
  is_owner INTEGER NOT NULL CHECK(is_owner IN (0, 1)),
  share_minor INTEGER NOT NULL CHECK(share_minor >= 0),
  paid_minor INTEGER NOT NULL CHECK(paid_minor >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS split_settlements (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  local_owner_id TEXT NOT NULL,
  split_id TEXT REFERENCES splits(id) ON DELETE SET NULL,
  contact_id TEXT NOT NULL REFERENCES split_contacts(id),
  direction TEXT NOT NULL CHECK(direction IN ('received', 'paid')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  currency TEXT NOT NULL CHECK(length(currency) = 3),
  occurred_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK(sync_status IN ('local', 'pending', 'synced', 'error')),
  local_updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

DROP INDEX IF EXISTS idx_outbox_retry;
ALTER TABLE sync_outbox RENAME TO sync_outbox_v3;
CREATE TABLE sync_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('profiles', 'accounts', 'categories', 'budget_categories', 'transactions', 'budgets', 'savings', 'split_contacts', 'splits', 'split_settlements')),
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'upsert' CHECK(operation IN ('upsert', 'delete')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id)
);
INSERT OR IGNORE INTO sync_outbox SELECT * FROM sync_outbox_v3;
DROP TABLE sync_outbox_v3;

CREATE INDEX IF NOT EXISTS idx_savings_owner_date ON savings(local_owner_id, occurred_at DESC, deleted_at);
CREATE INDEX IF NOT EXISTS idx_split_contacts_owner ON split_contacts(local_owner_id, status, deleted_at, display_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_split_contacts_remote ON split_contacts(local_owner_id, remote_user_id) WHERE remote_user_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_splits_owner_date ON splits(local_owner_id, occurred_at DESC, deleted_at);
CREATE INDEX IF NOT EXISTS idx_split_participants_split ON split_participants(split_id, is_owner);
CREATE INDEX IF NOT EXISTS idx_split_participants_contact ON split_participants(contact_id, split_id);
CREATE INDEX IF NOT EXISTS idx_split_settlements_contact ON split_settlements(local_owner_id, contact_id, occurred_at DESC, deleted_at);
CREATE INDEX IF NOT EXISTS idx_outbox_retry ON sync_outbox(user_id, next_retry_at, created_at);
PRAGMA user_version = 4;
`;

const MIGRATION_5 = `
UPDATE budgets
SET deleted_at = COALESCE(deleted_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    local_updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    sync_status = CASE WHEN user_id IS NULL THEN 'local' ELSE 'pending' END
WHERE budget_category_id IS NULL AND deleted_at IS NULL;
PRAGMA user_version = 5;
`;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const version = row?.user_version ?? 0;
  if (version < 1) await db.execAsync(MIGRATION_1);
  if (version < 2) await db.execAsync(MIGRATION_2);
  if (version < 3) await db.execAsync(MIGRATION_3);
  if (version < 4) await db.execAsync(MIGRATION_4);
  if (version < 5) await db.execAsync(MIGRATION_5);
}

async function seed(db: SQLite.SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{
    id: string;
    default_currency: string;
  }>("SELECT id, default_currency FROM local_profile LIMIT 1");
  let ownerId = existing?.id;
  let currency = existing?.default_currency;
  if (!ownerId) {
    const locale = getLocales()[0];
    const calendar = getCalendars()[0];
    ownerId = Crypto.randomUUID();
    currency = locale?.currencyCode ?? "USD";
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO local_profile
       (id, user_id, default_currency, locale, timezone, onboarding_completed, cloud_ai_enabled, theme, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, 0, 0, 'system', ?, ?)`,
      ownerId,
      currency,
      locale?.languageTag ?? "en-US",
      calendar?.timeZone ??
        Intl.DateTimeFormat().resolvedOptions().timeZone ??
        "UTC",
      now,
      now,
    );
  }
  const now = new Date().toISOString();
  const accountCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM accounts WHERE local_owner_id = ?",
    ownerId,
  );
  if ((accountCount?.count ?? 0) === 0) {
    await db.runAsync(
      `INSERT INTO accounts
       (id, user_id, local_owner_id, name, type, currency, opening_balance_minor, created_at, updated_at, sync_status, local_updated_at)
       VALUES (?, NULL, ?, 'Cash', 'cash', ?, 0, ?, ?, 'local', ?)`,
      Crypto.randomUUID(),
      ownerId,
      currency ?? "USD",
      now,
      now,
      now,
    );
    await db.runAsync(
      `INSERT INTO accounts
       (id, user_id, local_owner_id, name, type, currency, opening_balance_minor, created_at, updated_at, sync_status, local_updated_at)
       VALUES (?, NULL, ?, 'Bank', 'bank', ?, 0, ?, ?, 'local', ?)`,
      Crypto.randomUUID(),
      ownerId,
      currency ?? "USD",
      now,
      now,
      now,
    );
  }
  const categoryCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM categories WHERE local_owner_id = ?",
    ownerId,
  );
  if ((categoryCount?.count ?? 0) === 0) {
    for (const category of DEFAULT_CATEGORIES) {
      const categoryId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO categories
         (id, user_id, local_owner_id, name, icon, color, transaction_type, is_default, created_at, updated_at, sync_status, local_updated_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, 1, ?, ?, 'local', ?)`,
        categoryId,
        ownerId,
        category.name,
        category.icon,
        category.color,
        category.type,
        now,
        now,
        now,
      );
      if (category.type === "expense") {
        await db.runAsync(
          `INSERT INTO budget_categories
           (id, user_id, local_owner_id, source_category_id, name, icon, color, created_at, updated_at, sync_status, local_updated_at)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'local', ?)`,
          categoryId,
          ownerId,
          categoryId,
          category.name,
          category.icon,
          category.color,
          now,
          now,
          now,
        );
      }
    }
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync("spendspeak.db");
      await migrate(db);
      await seed(db);
      return db;
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function reseedDatabase(): Promise<void> {
  const db = await getDatabase();
  await seed(db);
}
