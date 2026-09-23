import * as Crypto from "expo-crypto";

import { getLocalOwnerContext, queueCloudWrite } from "@/src/db/localCloud";
import { savingInputSchema } from "@/src/domain/schemas";
import type { SavingEntry, SavingInput } from "@/src/domain/types";

type SavingRow = {
  id: string;
  user_id: string | null;
  local_owner_id: string;
  name: string;
  amount_minor: number;
  currency: string;
  occurred_at: string;
  note: string | null;
  source: SavingEntry["source"];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: SavingEntry["syncStatus"];
  local_updated_at: string;
  last_synced_at: string | null;
};

function mapSaving(row: SavingRow): SavingEntry {
  return {
    id: row.id,
    userId: row.user_id,
    localOwnerId: row.local_owner_id,
    name: row.name,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    occurredAt: row.occurred_at,
    note: row.note,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    localUpdatedAt: row.local_updated_at,
    lastSyncedAt: row.last_synced_at,
  };
}

export async function saveSaving(input: SavingInput): Promise<SavingEntry> {
  const parsed = savingInputSchema.parse(input);
  const { db, ownerId, userId, syncStatus } = await getLocalOwnerContext();
  const now = new Date().toISOString();
  const id = parsed.id ?? Crypto.randomUUID();
  const existing = await db.getFirstAsync<{ created_at: string }>(
    "SELECT created_at FROM savings WHERE id = ? AND local_owner_id = ?",
    id,
    ownerId,
  );
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO savings
        (id, user_id, local_owner_id, name, amount_minor, currency, occurred_at, note, source,
         created_at, updated_at, deleted_at, sync_status, local_updated_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id,
         name = excluded.name,
         amount_minor = excluded.amount_minor,
         currency = excluded.currency,
         occurred_at = excluded.occurred_at,
         note = excluded.note,
         source = excluded.source,
         updated_at = excluded.updated_at,
         deleted_at = NULL,
         sync_status = excluded.sync_status,
         local_updated_at = excluded.local_updated_at`,
      id,
      userId,
      ownerId,
      parsed.name,
      parsed.amountMinor,
      parsed.currency,
      parsed.occurredAt,
      parsed.note,
      parsed.source,
      existing?.created_at ?? now,
      now,
      syncStatus,
      now,
    );
    await queueCloudWrite(db, userId, "savings", id, now);
  });
  const saved = await getSaving(id);
  if (!saved) throw new Error("The savings entry could not be saved.");
  return saved;
}

export async function getSaving(id: string): Promise<SavingEntry | null> {
  const { db, ownerId } = await getLocalOwnerContext();
  const row = await db.getFirstAsync<SavingRow>(
    "SELECT * FROM savings WHERE id = ? AND local_owner_id = ?",
    id,
    ownerId,
  );
  return row ? mapSaving(row) : null;
}

export async function listSavings(
  options: {
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {},
): Promise<SavingEntry[]> {
  const { db, ownerId } = await getLocalOwnerContext();
  const clauses = ["local_owner_id = ?", "deleted_at IS NULL"];
  const params: (string | number)[] = [ownerId];
  if (options.dateFrom) {
    clauses.push("occurred_at >= ?");
    params.push(options.dateFrom);
  }
  if (options.dateTo) {
    clauses.push("occurred_at < ?");
    params.push(options.dateTo);
  }
  const limit = options.limit
    ? Math.max(1, Math.min(options.limit, 1000))
    : null;
  if (limit) params.push(limit);
  const rows = await db.getAllAsync<SavingRow>(
    `SELECT * FROM savings WHERE ${clauses.join(" AND ")} ORDER BY occurred_at DESC, created_at DESC${limit ? " LIMIT ?" : ""}`,
    ...params,
  );
  return rows.map(mapSaving);
}

export async function getSavingsTotals(): Promise<Record<string, number>> {
  const { db, ownerId } = await getLocalOwnerContext();
  const rows = await db.getAllAsync<{ currency: string; total: number }>(
    `SELECT currency, COALESCE(SUM(amount_minor), 0) AS total
     FROM savings
     WHERE local_owner_id = ? AND deleted_at IS NULL
     GROUP BY currency ORDER BY currency`,
    ownerId,
  );
  return Object.fromEntries(
    rows.map((row) => [row.currency, Number(row.total)]),
  );
}

export async function getSavingsTotal(
  dateFrom: string,
  dateTo: string,
  currency: string,
): Promise<number> {
  const { db, ownerId } = await getLocalOwnerContext();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_minor), 0) AS total
     FROM savings
     WHERE local_owner_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?
       AND currency = ?`,
    ownerId,
    dateFrom,
    dateTo,
    currency,
  );
  return Number(row?.total ?? 0);
}

export async function deleteSaving(id: string): Promise<void> {
  const { db, ownerId, userId, syncStatus } = await getLocalOwnerContext();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE savings SET deleted_at = ?, updated_at = ?, local_updated_at = ?, sync_status = ?
       WHERE id = ? AND local_owner_id = ?`,
      now,
      now,
      now,
      syncStatus,
      id,
      ownerId,
    );
    await queueCloudWrite(db, userId, "savings", id, now);
  });
}
