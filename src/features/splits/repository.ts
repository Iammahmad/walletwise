import * as Crypto from "expo-crypto";

import { getLocalOwnerContext, queueCloudWrite } from "@/src/db/localCloud";
import { splitInputSchema } from "@/src/domain/schemas";
import type {
  ContactBalance,
  SplitContact,
  SplitEntry,
  SplitInput,
  SplitParticipant,
} from "@/src/domain/types";

type Row = Record<string, string | number | null>;
const string = (row: Row, key: string) => String(row[key] ?? "");
const nullable = (row: Row, key: string) =>
  row[key] == null ? null : String(row[key]);

function mapContact(row: Row): SplitContact {
  return {
    id: string(row, "id"),
    userId: nullable(row, "user_id"),
    localOwnerId: string(row, "local_owner_id"),
    remoteUserId: nullable(row, "remote_user_id"),
    displayName: string(row, "display_name"),
    email: nullable(row, "email"),
    status: string(row, "status") as SplitContact["status"],
    inviteToken: nullable(row, "invite_token"),
    createdAt: string(row, "created_at"),
    updatedAt: string(row, "updated_at"),
    deletedAt: nullable(row, "deleted_at"),
    syncStatus: string(row, "sync_status") as SplitContact["syncStatus"],
    localUpdatedAt: string(row, "local_updated_at"),
    lastSyncedAt: nullable(row, "last_synced_at"),
  };
}

function mapParticipant(row: Row): SplitParticipant {
  return {
    id: string(row, "id"),
    splitId: string(row, "split_id"),
    contactId: nullable(row, "contact_id"),
    remoteUserId: nullable(row, "remote_user_id"),
    displayName: string(row, "display_name"),
    isOwner: Number(row.is_owner) === 1,
    shareMinor: Number(row.share_minor),
    paidMinor: Number(row.paid_minor),
    createdAt: string(row, "created_at"),
    updatedAt: string(row, "updated_at"),
  };
}

function mapSplit(row: Row, participants: SplitParticipant[]): SplitEntry {
  return {
    id: string(row, "id"),
    userId: nullable(row, "user_id"),
    localOwnerId: string(row, "local_owner_id"),
    createdByUserId: nullable(row, "created_by_user_id"),
    description: string(row, "description"),
    splitType: string(row, "split_type") as SplitEntry["splitType"],
    loanDirection: nullable(
      row,
      "loan_direction",
    ) as SplitEntry["loanDirection"],
    totalMinor: Number(row.total_minor),
    currency: string(row, "currency"),
    occurredAt: string(row, "occurred_at"),
    status: string(row, "status") as SplitEntry["status"],
    note: nullable(row, "note"),
    createdAt: string(row, "created_at"),
    updatedAt: string(row, "updated_at"),
    deletedAt: nullable(row, "deleted_at"),
    syncStatus: string(row, "sync_status") as SplitEntry["syncStatus"],
    localUpdatedAt: string(row, "local_updated_at"),
    lastSyncedAt: nullable(row, "last_synced_at"),
    participants,
  };
}

export async function saveContact(input: {
  id?: string;
  displayName: string;
  email?: string | null;
  remoteUserId?: string | null;
  status?: SplitContact["status"];
  inviteToken?: string | null;
}): Promise<SplitContact> {
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 80)
    throw new Error("Enter a valid friend name.");
  const { db, ownerId, userId, syncStatus } = await getLocalOwnerContext();
  const id = input.id ?? Crypto.randomUUID();
  const now = new Date().toISOString();
  const existing = await db.getFirstAsync<{ created_at: string }>(
    "SELECT created_at FROM split_contacts WHERE id = ?",
    id,
  );
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO split_contacts
        (id, user_id, local_owner_id, remote_user_id, display_name, email, status, invite_token,
         created_at, updated_at, deleted_at, sync_status, local_updated_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id, remote_user_id = excluded.remote_user_id,
         display_name = excluded.display_name, email = excluded.email, status = excluded.status,
         invite_token = excluded.invite_token, updated_at = excluded.updated_at, deleted_at = NULL,
         sync_status = excluded.sync_status, local_updated_at = excluded.local_updated_at`,
      id,
      userId,
      ownerId,
      input.remoteUserId ?? null,
      displayName,
      input.email?.trim().toLowerCase() || null,
      input.status ?? (input.remoteUserId ? "connected" : "local"),
      input.inviteToken ?? null,
      existing?.created_at ?? now,
      now,
      syncStatus,
      now,
    );
    await queueCloudWrite(db, userId, "split_contacts", id, now);
  });
  const row = await db.getFirstAsync<Row>(
    "SELECT * FROM split_contacts WHERE id = ?",
    id,
  );
  if (!row) throw new Error("The friend could not be saved.");
  return mapContact(row);
}

export async function listContacts(): Promise<SplitContact[]> {
  const { db, ownerId } = await getLocalOwnerContext();
  const rows = await db.getAllAsync<Row>(
    "SELECT * FROM split_contacts WHERE local_owner_id = ? AND deleted_at IS NULL ORDER BY display_name COLLATE NOCASE",
    ownerId,
  );
  return rows.map(mapContact);
}

export async function saveSplit(input: SplitInput): Promise<SplitEntry> {
  const parsed = splitInputSchema.parse(input);
  const { db, ownerId, userId, syncStatus } = await getLocalOwnerContext();
  const id = parsed.id ?? Crypto.randomUUID();
  const now = new Date().toISOString();
  const existing = await db.getFirstAsync<{ created_at: string }>(
    "SELECT created_at FROM splits WHERE id = ?",
    id,
  );
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO splits
        (id, user_id, local_owner_id, created_by_user_id, description, split_type, loan_direction,
         total_minor, currency, occurred_at, status, note, created_at, updated_at, deleted_at,
         sync_status, local_updated_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, NULL, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id, description = excluded.description, split_type = excluded.split_type,
         loan_direction = excluded.loan_direction, total_minor = excluded.total_minor, currency = excluded.currency,
         occurred_at = excluded.occurred_at, note = excluded.note, updated_at = excluded.updated_at,
         deleted_at = NULL, sync_status = excluded.sync_status, local_updated_at = excluded.local_updated_at`,
      id,
      userId,
      ownerId,
      userId,
      parsed.description,
      parsed.splitType,
      parsed.loanDirection ?? null,
      parsed.totalMinor,
      parsed.currency,
      parsed.occurredAt,
      parsed.note,
      existing?.created_at ?? now,
      now,
      syncStatus,
      now,
    );
    await db.runAsync("DELETE FROM split_participants WHERE split_id = ?", id);
    for (const participant of parsed.participants) {
      await db.runAsync(
        `INSERT INTO split_participants
          (id, split_id, contact_id, remote_user_id, display_name, is_owner, share_minor, paid_minor, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        Crypto.randomUUID(),
        id,
        participant.contactId ?? null,
        participant.remoteUserId ?? null,
        participant.displayName,
        participant.isOwner ? 1 : 0,
        participant.shareMinor,
        participant.paidMinor,
        now,
        now,
      );
    }
    await queueCloudWrite(db, userId, "splits", id, now);
  });
  const saved = await getSplit(id);
  if (!saved) throw new Error("The split could not be saved.");
  return saved;
}

async function participantsFor(splitId: string): Promise<SplitParticipant[]> {
  const { db } = await getLocalOwnerContext();
  const rows = await db.getAllAsync<Row>(
    "SELECT * FROM split_participants WHERE split_id = ? ORDER BY is_owner DESC, display_name",
    splitId,
  );
  return rows.map(mapParticipant);
}

export async function getSplit(id: string): Promise<SplitEntry | null> {
  const { db, ownerId } = await getLocalOwnerContext();
  const row = await db.getFirstAsync<Row>(
    "SELECT * FROM splits WHERE id = ? AND local_owner_id = ?",
    id,
    ownerId,
  );
  return row ? mapSplit(row, await participantsFor(id)) : null;
}

export async function listSplits(limit = 100): Promise<SplitEntry[]> {
  const { db, ownerId } = await getLocalOwnerContext();
  const rows = await db.getAllAsync<Row>(
    "SELECT * FROM splits WHERE local_owner_id = ? AND deleted_at IS NULL ORDER BY occurred_at DESC, created_at DESC LIMIT ?",
    ownerId,
    Math.max(1, Math.min(limit, 500)),
  );
  return Promise.all(
    rows.map(async (row) =>
      mapSplit(row, await participantsFor(string(row, "id"))),
    ),
  );
}

export async function saveSettlement(input: {
  splitId?: string | null;
  contactId: string;
  direction: "received" | "paid";
  amountMinor: number;
  currency: string;
  occurredAt: string;
  note?: string | null;
}): Promise<void> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
    throw new Error("Enter a valid settlement amount.");
  const { db, ownerId, userId, syncStatus } = await getLocalOwnerContext();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO split_settlements
        (id, user_id, local_owner_id, split_id, contact_id, direction, amount_minor, currency,
         occurred_at, note, created_at, updated_at, sync_status, local_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      userId,
      ownerId,
      input.splitId ?? null,
      input.contactId,
      input.direction,
      input.amountMinor,
      input.currency,
      input.occurredAt,
      input.note ?? null,
      now,
      now,
      syncStatus,
      now,
    );
    await queueCloudWrite(db, userId, "split_settlements", id, now);
  });
}

export async function listContactBalances(): Promise<ContactBalance[]> {
  const { db, ownerId } = await getLocalOwnerContext();
  const contacts = await listContacts();
  const results: ContactBalance[] = [];
  for (const contact of contacts) {
    const participant = await db.getFirstAsync<{
      balance: number;
      split_count: number;
    }>(
      `SELECT COALESCE(SUM(sp.share_minor - sp.paid_minor), 0) AS balance,
              COUNT(DISTINCT CASE WHEN s.status = 'open' THEN s.id END) AS split_count
       FROM split_participants sp
       JOIN splits s ON s.id = sp.split_id
       WHERE sp.contact_id = ? AND s.local_owner_id = ? AND s.deleted_at IS NULL`,
      contact.id,
      ownerId,
    );
    const settlements = await db.getFirstAsync<{ adjustment: number }>(
      `SELECT COALESCE(SUM(CASE direction WHEN 'received' THEN -amount_minor ELSE amount_minor END), 0) AS adjustment
       FROM split_settlements WHERE contact_id = ? AND local_owner_id = ? AND deleted_at IS NULL`,
      contact.id,
      ownerId,
    );
    results.push({
      contact,
      balanceMinor:
        Number(participant?.balance ?? 0) +
        Number(settlements?.adjustment ?? 0),
      openSplitCount: Number(participant?.split_count ?? 0),
    });
  }
  return results.sort(
    (a, b) => Math.abs(b.balanceMinor) - Math.abs(a.balanceMinor),
  );
}

export async function deleteSplit(id: string): Promise<void> {
  const { db, ownerId, userId, syncStatus } = await getLocalOwnerContext();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE splits SET deleted_at = ?, updated_at = ?, local_updated_at = ?, sync_status = ? WHERE id = ? AND local_owner_id = ?",
      now,
      now,
      now,
      syncStatus,
      id,
      ownerId,
    );
    await queueCloudWrite(db, userId, "splits", id, now);
  });
}
