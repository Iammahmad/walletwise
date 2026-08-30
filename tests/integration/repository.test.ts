import { getDatabase } from '@/src/db/database';
import {
  getCloudPayload,
  mergeRemoteProfile,
  mergeRemoteRows,
  preparePristineLocalDataForCloudRestore,
  saveTransaction,
  setTransactionDeleted,
} from '@/src/db/repository';
import type { TransactionInput } from '@/src/domain/types';

jest.mock('@/src/db/database', () => ({
  getDatabase: jest.fn(),
  reseedDatabase: jest.fn(),
}));

type TestRow = Record<string, string | number | null>;

const profileRow = (userId: string | null): TestRow => ({
  id: 'local-owner-1',
  user_id: userId,
  default_currency: 'PKR',
  locale: 'en-PK',
  timezone: 'Asia/Karachi',
  onboarding_completed: 1,
  cloud_ai_enabled: 0,
  theme: 'system',
  created_at: '2026-08-30T08:00:00.000Z',
  updated_at: '2026-08-30T08:00:00.000Z',
});

function createTestDatabase(userId: string | null) {
  const transactions = new Map<string, TestRow>();
  const outbox = new Map<string, { entityType: string; entityId: string }>();
  let localProfile = profileRow(userId);

  const db = {
    withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('FROM local_profile')) return localProfile;
      if (sql.includes('COUNT(*) AS count FROM transactions')) return { count: transactions.size };
      if (sql.includes('COUNT(*) AS count FROM budgets')) return { count: 0 };
      if (sql.includes('FROM transactions') && sql.includes('WHERE id = ?')) {
        return transactions.get(String(params[0])) ?? null;
      }
      if (sql.includes('FROM transactions t') && sql.includes('WHERE t.id = ?')) {
        const row = transactions.get(String(params[0]));
        return row ? { ...row, account_name: 'Cash', category_name: 'Food', category_icon: 'restaurant-outline', category_color: '#D97706' } : null;
      }
      return null;
    }),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('INSERT INTO transactions')) {
        const [
          id, rowUserId, localOwnerId, accountId, categoryId, type, amountMinor, currency,
          merchant, note, occurredAt, source, originalTranscript, createdAt, updatedAt, syncStatus,
          localUpdatedAt,
        ] = params;
        transactions.set(String(id), {
          id: String(id), user_id: rowUserId == null ? null : String(rowUserId), local_owner_id: String(localOwnerId),
          account_id: String(accountId), category_id: String(categoryId), type: String(type), amount_minor: Number(amountMinor),
          currency: String(currency), merchant: merchant == null ? null : String(merchant), note: note == null ? null : String(note),
          occurred_at: String(occurredAt), source: String(source), original_transcript: originalTranscript == null ? null : String(originalTranscript),
          created_at: String(createdAt), updated_at: String(updatedAt), deleted_at: null, sync_status: String(syncStatus),
          local_updated_at: String(localUpdatedAt), last_synced_at: null,
        });
      } else if (sql.includes('UPDATE transactions SET deleted_at')) {
        const [deletedAt, updatedAt, localUpdatedAt, syncStatus, id, localOwnerId] = params;
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
      } else if (sql.includes('INSERT INTO sync_outbox')) {
        const [, , entityType, entityId] = params;
        outbox.set(`${String(entityType)}:${String(entityId)}`, { entityType: String(entityType), entityId: String(entityId) });
      } else if (sql.includes('UPDATE local_profile SET user_id')) {
        const [nextUserId, updatedAt] = params;
        localProfile = { ...localProfile, user_id: String(nextUserId), cloud_ai_enabled: 0, updated_at: String(updatedAt) };
      } else if (sql.includes('UPDATE local_profile SET default_currency')) {
        const [currency, locale, timezone, createdAt, updatedAt] = params;
        localProfile = {
          ...localProfile,
          default_currency: String(currency), locale: String(locale), timezone: String(timezone),
          created_at: String(createdAt), updated_at: String(updatedAt),
        };
      }
      return { changes: 1, lastInsertRowId: 0 };
    }),
  };

  return { db, transactions, outbox, get profile() { return localProfile; } };
}

const input: TransactionInput = {
  accountId: 'account-cash',
  categoryId: 'category-food',
  type: 'expense',
  amountMinor: 60000,
  currency: 'PKR',
  merchant: 'Cafe',
  note: null,
  occurredAt: '2026-08-30T09:00:00.000Z',
  source: 'manual',
  originalTranscript: null,
};

describe('local transaction repository integration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates, edits, soft-deletes, and restores a transaction in local-only mode', async () => {
    const state = createTestDatabase(null);
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);

    const created = await saveTransaction(input);
    expect(created.amountMinor).toBe(60000);
    expect(created.syncStatus).toBe('local');
    expect(state.outbox.size).toBe(0);

    const edited = await saveTransaction({ ...input, id: created.id, amountMinor: 75000, note: 'Team lunch' });
    expect(edited.id).toBe(created.id);
    expect(edited.amountMinor).toBe(75000);
    expect(edited.note).toBe('Team lunch');

    await setTransactionDeleted(created.id, true);
    expect(state.transactions.get(created.id)?.deleted_at).not.toBeNull();

    await setTransactionDeleted(created.id, false);
    expect(state.transactions.get(created.id)?.deleted_at).toBeNull();
    expect(state.outbox.size).toBe(0);
  });

  it('coalesces authenticated create, edit, delete, and undo writes into one retry-safe outbox item', async () => {
    const state = createTestDatabase('user-1');
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);

    const created = await saveTransaction(input);
    await saveTransaction({ ...input, id: created.id, merchant: 'Metro' });
    await setTransactionDeleted(created.id, true);
    await setTransactionDeleted(created.id, false);

    expect(state.transactions.get(created.id)?.sync_status).toBe('pending');
    expect([...state.outbox.values()]).toEqual([{ entityType: 'transactions', entityId: created.id }]);
  });

  it('clears only a pristine local shell and then accepts the authenticated cloud profile', async () => {
    const state = createTestDatabase(null);
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);

    await expect(preparePristineLocalDataForCloudRestore('user-1')).resolves.toBe(true);
    expect(state.profile.user_id).toBe('user-1');
    expect(state.profile.updated_at).toBe('1970-01-01T00:00:00.000Z');

    await mergeRemoteProfile({
      user_id: 'user-1', default_currency: 'USD', locale: 'en-US', timezone: 'America/New_York',
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-08-30T12:00:00.000Z',
    });
    expect(state.profile).toEqual(expect.objectContaining({
      default_currency: 'USD', locale: 'en-US', timezone: 'America/New_York',
    }));
  });

  it('never clears a local ledger that already contains a transaction', async () => {
    const state = createTestDatabase(null);
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);
    await saveTransaction(input);

    await expect(preparePristineLocalDataForCloudRestore('user-1')).resolves.toBe(false);
    expect(state.profile.user_id).toBeNull();
    expect(state.transactions.size).toBe(1);
  });

  it('normalizes the category boolean in both SQLite-to-cloud and cloud-to-SQLite directions', async () => {
    const state = createTestDatabase('user-1');
    const category = {
      id: 'category-food', user_id: 'user-1', local_owner_id: 'local-owner-1', name: 'Food', icon: 'restaurant-outline',
      color: '#D97706', transaction_type: 'expense', is_default: 1, created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-30T00:00:00.000Z', deleted_at: null, sync_status: 'pending',
      local_updated_at: '2026-08-30T00:00:00.000Z', last_synced_at: null,
    };
    state.db.getFirstAsync.mockImplementationOnce(async () => category);
    jest.mocked(getDatabase).mockResolvedValue(state.db as never);
    await expect(getCloudPayload('categories', 'category-food')).resolves.toEqual(expect.objectContaining({ is_default: true }));

    state.db.runAsync.mockClear();
    await mergeRemoteRows('categories', [{ ...category, is_default: false }]);
    const insertCall = state.db.runAsync.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO categories'));
    expect(insertCall).toBeDefined();
    expect(insertCall).toContain(0);
  });
});
