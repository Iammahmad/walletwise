import * as Crypto from 'expo-crypto';
import { getCalendars, getLocales } from 'expo-localization';
import * as SQLite from 'expo-sqlite';

import { DEFAULT_CATEGORIES } from './seed';

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

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) await db.execAsync(MIGRATION_1);
}

async function seed(db: SQLite.SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ id: string; default_currency: string }>('SELECT id, default_currency FROM local_profile LIMIT 1');
  let ownerId = existing?.id;
  let currency = existing?.default_currency;
  if (!ownerId) {
    const locale = getLocales()[0];
    const calendar = getCalendars()[0];
    ownerId = Crypto.randomUUID();
    currency = locale?.currencyCode ?? 'USD';
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO local_profile
       (id, user_id, default_currency, locale, timezone, onboarding_completed, cloud_ai_enabled, theme, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, 0, 0, 'system', ?, ?)`,
      ownerId,
      currency,
      locale?.languageTag ?? 'en-US',
      calendar?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      now,
      now,
    );
  }
  const now = new Date().toISOString();
  const accountCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM accounts WHERE local_owner_id = ?', ownerId);
  if ((accountCount?.count ?? 0) === 0) {
    await db.runAsync(
      `INSERT INTO accounts
       (id, user_id, local_owner_id, name, type, currency, opening_balance_minor, created_at, updated_at, sync_status, local_updated_at)
       VALUES (?, NULL, ?, 'Cash', 'cash', ?, 0, ?, ?, 'local', ?)`,
      Crypto.randomUUID(), ownerId, currency ?? 'USD', now, now, now,
    );
    await db.runAsync(
      `INSERT INTO accounts
       (id, user_id, local_owner_id, name, type, currency, opening_balance_minor, created_at, updated_at, sync_status, local_updated_at)
       VALUES (?, NULL, ?, 'Bank', 'bank', ?, 0, ?, ?, 'local', ?)`,
      Crypto.randomUUID(), ownerId, currency ?? 'USD', now, now, now,
    );
  }
  const categoryCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories WHERE local_owner_id = ?', ownerId);
  if ((categoryCount?.count ?? 0) === 0) {
    for (const category of DEFAULT_CATEGORIES) {
      await db.runAsync(
        `INSERT INTO categories
         (id, user_id, local_owner_id, name, icon, color, transaction_type, is_default, created_at, updated_at, sync_status, local_updated_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, 1, ?, ?, 'local', ?)`,
        Crypto.randomUUID(), ownerId, category.name, category.icon, category.color, category.type, now, now, now,
      );
    }
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync('spendspeak.db');
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
