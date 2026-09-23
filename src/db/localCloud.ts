import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";

import { getDatabase } from "./database";
import type { SyncStatus } from "@/src/domain/types";

export interface LocalOwnerContext {
  db: SQLiteDatabase;
  ownerId: string;
  userId: string | null;
  syncStatus: SyncStatus;
}

export async function getLocalOwnerContext(): Promise<LocalOwnerContext> {
  const db = await getDatabase();
  const profile = await db.getFirstAsync<{
    id: string;
    user_id: string | null;
  }>("SELECT id, user_id FROM local_profile LIMIT 1");
  if (!profile) throw new Error("The local WalletWise profile is unavailable.");
  return {
    db,
    ownerId: profile.id,
    userId: profile.user_id,
    syncStatus: profile.user_id ? "pending" : "local",
  };
}

export async function queueCloudWrite(
  db: SQLiteDatabase,
  userId: string | null,
  entityType: string,
  entityId: string,
  now: string,
): Promise<void> {
  if (!userId) return;
  await db.runAsync(
    `INSERT INTO sync_outbox
      (id, user_id, entity_type, entity_id, operation, attempt_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'upsert', 0, ?, ?)
     ON CONFLICT(entity_type, entity_id) DO UPDATE SET
       user_id = excluded.user_id,
       operation = 'upsert',
       attempt_count = 0,
       next_retry_at = NULL,
       last_error_code = NULL,
       updated_at = excluded.updated_at`,
    Crypto.randomUUID(),
    userId,
    entityType,
    entityId,
    now,
    now,
  );
}
