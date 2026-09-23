import * as Crypto from "expo-crypto";
import { z } from "zod";

import { getLocalOwnerContext } from "@/src/db/localCloud";

const remoteSplitSchema = z.object({
  id: z.string().uuid(),
  created_by_user_id: z.string().min(1),
  description: z.string().min(1).max(160),
  split_type: z.enum(["equal", "loan"]),
  loan_direction: z.enum(["lent", "borrowed"]).nullable(),
  total_minor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  occurred_at: z.string().datetime({ offset: true }),
  status: z.enum(["open", "settled"]),
  note: z.string().max(500).nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
  deleted_at: z.string().datetime({ offset: true }).nullable(),
  participants: z.array(
    z.object({
      remote_user_id: z.string().nullable(),
      display_name: z.string().min(1).max(80),
      share_minor: z.number().int().nonnegative(),
      paid_minor: z.number().int().nonnegative(),
    }),
  ),
});

const privateSplitSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().min(1),
    created_by_user_id: z.string().nullable(),
    description: z.string().min(1).max(160),
    split_type: z.enum(["equal", "loan"]),
    loan_direction: z.enum(["lent", "borrowed"]).nullable(),
    total_minor: z.number().int().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    occurred_at: z.string().datetime({ offset: true }),
    status: z.enum(["open", "settled"]),
    note: z.string().max(500).nullable(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
    deleted_at: z.string().datetime({ offset: true }).nullable(),
    participants: z
      .array(
        z.object({
          contact_id: z.string().uuid().nullable(),
          remote_user_id: z.string().nullable(),
          display_name: z.string().min(1).max(80),
          is_owner: z.boolean(),
          share_minor: z.number().int().nonnegative(),
          paid_minor: z.number().int().nonnegative(),
        }),
      )
      .min(2)
      .max(50),
  })
  .superRefine((value, context) => {
    if (value.participants.filter((item) => item.is_owner).length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "A split must contain exactly one owner",
      });
    }
    const shares = value.participants.reduce(
      (sum, item) => sum + item.share_minor,
      0,
    );
    const payments = value.participants.reduce(
      (sum, item) => sum + item.paid_minor,
      0,
    );
    if (shares !== value.total_minor || payments !== value.total_minor) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "Split totals are inconsistent",
      });
    }
  });

export async function mergePrivateSplit(input: unknown): Promise<void> {
  const parsed = privateSplitSchema.safeParse(input);
  if (!parsed.success) return;
  const value = parsed.data;
  const { db, ownerId, userId } = await getLocalOwnerContext();
  if (!userId || value.user_id !== userId) return;
  const local = await db.getFirstAsync<{ updated_at: string }>(
    "SELECT updated_at FROM splits WHERE id = ?",
    value.id,
  );
  if (local?.updated_at && local.updated_at >= value.updated_at) return;
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO splits
        (id, user_id, local_owner_id, created_by_user_id, description, split_type, loan_direction,
         total_minor, currency, occurred_at, status, note, created_at, updated_at, deleted_at,
         sync_status, local_updated_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)
       ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id,
         created_by_user_id = excluded.created_by_user_id, description = excluded.description,
         split_type = excluded.split_type, loan_direction = excluded.loan_direction,
         total_minor = excluded.total_minor, currency = excluded.currency,
         occurred_at = excluded.occurred_at, status = excluded.status, note = excluded.note,
         updated_at = excluded.updated_at, deleted_at = excluded.deleted_at,
         sync_status = 'synced', local_updated_at = excluded.local_updated_at,
         last_synced_at = excluded.last_synced_at`,
      value.id,
      userId,
      ownerId,
      value.created_by_user_id,
      value.description,
      value.split_type,
      value.loan_direction,
      value.total_minor,
      value.currency,
      value.occurred_at,
      value.status,
      value.note,
      value.created_at,
      value.updated_at,
      value.deleted_at,
      now,
      now,
    );
    await db.runAsync(
      "DELETE FROM split_participants WHERE split_id = ?",
      value.id,
    );
    for (const participant of value.participants) {
      const contact = participant.contact_id
        ? await db.getFirstAsync<{ id: string }>(
            "SELECT id FROM split_contacts WHERE id = ? AND local_owner_id = ? AND deleted_at IS NULL",
            participant.contact_id,
            ownerId,
          )
        : null;
      await db.runAsync(
        `INSERT INTO split_participants
          (id, split_id, contact_id, remote_user_id, display_name, is_owner, share_minor, paid_minor, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        Crypto.randomUUID(),
        value.id,
        contact?.id ?? null,
        participant.remote_user_id,
        participant.display_name,
        participant.is_owner ? 1 : 0,
        participant.share_minor,
        participant.paid_minor,
        now,
        now,
      );
    }
  });
}

export async function mergeRemoteSplit(input: unknown): Promise<void> {
  const parsed = remoteSplitSchema.safeParse(input);
  if (!parsed.success) return;
  const value = parsed.data;
  const { db, ownerId, userId } = await getLocalOwnerContext();
  if (
    !userId ||
    !value.participants.some((item) => item.remote_user_id === userId)
  )
    return;
  const local = await db.getFirstAsync<{ updated_at: string }>(
    "SELECT updated_at FROM splits WHERE id = ?",
    value.id,
  );
  if (local?.updated_at && local.updated_at >= value.updated_at) return;
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO splits
        (id, user_id, local_owner_id, created_by_user_id, description, split_type, loan_direction,
         total_minor, currency, occurred_at, status, note, created_at, updated_at, deleted_at,
         sync_status, local_updated_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)
       ON CONFLICT(id) DO UPDATE SET description = excluded.description, split_type = excluded.split_type,
         loan_direction = excluded.loan_direction, total_minor = excluded.total_minor, currency = excluded.currency,
         occurred_at = excluded.occurred_at, status = excluded.status, note = excluded.note,
         updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, sync_status = 'synced',
         local_updated_at = excluded.local_updated_at, last_synced_at = excluded.last_synced_at`,
      value.id,
      userId,
      ownerId,
      value.created_by_user_id,
      value.description,
      value.split_type,
      value.loan_direction,
      value.total_minor,
      value.currency,
      value.occurred_at,
      value.status,
      value.note,
      value.created_at,
      value.updated_at,
      value.deleted_at,
      now,
      now,
    );
    await db.runAsync(
      "DELETE FROM split_participants WHERE split_id = ?",
      value.id,
    );
    for (const participant of value.participants) {
      let contactId: string | null = null;
      if (participant.remote_user_id && participant.remote_user_id !== userId) {
        const contact = await db.getFirstAsync<{ id: string }>(
          "SELECT id FROM split_contacts WHERE local_owner_id = ? AND remote_user_id = ? AND deleted_at IS NULL",
          ownerId,
          participant.remote_user_id,
        );
        contactId = contact?.id ?? Crypto.randomUUID();
        if (!contact) {
          await db.runAsync(
            `INSERT INTO split_contacts
              (id, user_id, local_owner_id, remote_user_id, display_name, status, created_at, updated_at,
               sync_status, local_updated_at, last_synced_at)
             VALUES (?, ?, ?, ?, ?, 'connected', ?, ?, 'synced', ?, ?)`,
            contactId,
            userId,
            ownerId,
            participant.remote_user_id,
            participant.display_name,
            now,
            now,
            now,
            now,
          );
        }
      }
      await db.runAsync(
        `INSERT INTO split_participants
          (id, split_id, contact_id, remote_user_id, display_name, is_owner, share_minor, paid_minor, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        Crypto.randomUUID(),
        value.id,
        contactId,
        participant.remote_user_id,
        participant.display_name,
        participant.remote_user_id === userId ? 1 : 0,
        participant.share_minor,
        participant.paid_minor,
        now,
        now,
      );
    }
  });
}
