import type { Session } from '@supabase/supabase-js';

import {
  getCloudPayload,
  getLastPulledAt,
  listOutbox,
  markOutboxFailure,
  markOutboxSuccess,
  mergeRemoteProfile,
  mergeRemoteRows,
  setLastPulledAt,
  type OutboxItem,
} from '@/src/db/repository';
import { getSupabase } from './supabase';
import { normalizeError } from './errors';

const SYNC_TABLES = ['accounts', 'categories', 'transactions', 'budgets'] as const;
const PULL_PAGE_SIZE = 500;
let activeSync: Promise<void> | null = null;

async function push(session: Session): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const items = await listOutbox(session.user.id);
  for (const item of items) {
    try {
      const payload = await getCloudPayload(item.entityType, item.entityId);
      if (!payload) { await markOutboxSuccess(item); continue; }
      const onConflict = item.entityType === 'profiles' ? 'user_id' : 'id';
      const key = onConflict;
      const identity = item.entityType === 'profiles' ? session.user.id : item.entityId;
      const { data: remote, error: readError } = await supabase
        .from(item.entityType)
        .select('updated_at')
        .eq(key, identity)
        .maybeSingle();
      if (readError) throw readError;
      if (remote?.updated_at && typeof payload.updated_at === 'string' && remote.updated_at >= payload.updated_at) {
        await markOutboxSuccess(item);
        continue;
      }
      const { error } = await supabase.from(item.entityType).upsert(payload, { onConflict });
      if (error) throw error;
      await markOutboxSuccess(item);
    } catch (error) {
      await markOutboxFailure(item, normalizeError(error).code);
    }
  }
}

async function pull(session: Session): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: remoteProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (remoteProfile) await mergeRemoteProfile(remoteProfile as Record<string, string | number | boolean | null>);

  for (const table of SYNC_TABLES) {
    const lastPulledAt = await getLastPulledAt(session.user.id, table);
    const pullStartedAt = new Date().toISOString();
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', session.user.id)
        .gt('updated_at', lastPulledAt)
        .lte('updated_at', pullStartedAt)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + PULL_PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as Record<string, string | number | boolean | null>[];
      await mergeRemoteRows(table, rows);
      if (rows.length < PULL_PAGE_SIZE) break;
      offset += PULL_PAGE_SIZE;
    }
    await setLastPulledAt(session.user.id, table, pullStartedAt);
  }
}

async function runSync(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return;
  await push(data.session);
  await pull(data.session);
}

export function syncNow(): Promise<void> {
  if (!activeSync) activeSync = runSync().finally(() => { activeSync = null; });
  return activeSync;
}

export type { OutboxItem };
