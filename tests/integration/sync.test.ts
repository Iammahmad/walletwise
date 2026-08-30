import * as repository from '@/src/db/repository';
import { getSupabase } from '@/src/services/supabase';
import { syncNow } from '@/src/services/sync';

jest.mock('@/src/db/repository', () => ({
  listOutbox: jest.fn(),
  getCloudPayload: jest.fn(),
  markOutboxSuccess: jest.fn(),
  markOutboxFailure: jest.fn(),
  mergeRemoteProfile: jest.fn(),
  mergeRemoteRows: jest.fn(),
  getLastPulledAt: jest.fn(),
  setLastPulledAt: jest.fn(),
}));

jest.mock('@/src/services/supabase', () => ({ getSupabase: jest.fn() }));

const mockListOutbox = jest.mocked(repository.listOutbox);
const mockGetCloudPayload = jest.mocked(repository.getCloudPayload);
const mockMarkSuccess = jest.mocked(repository.markOutboxSuccess);
const mockMarkFailure = jest.mocked(repository.markOutboxFailure);
const mockMergeProfile = jest.mocked(repository.mergeRemoteProfile);
const mockMerge = jest.mocked(repository.mergeRemoteRows);
const mockGetLastPulled = jest.mocked(repository.getLastPulledAt);
const mockSetLastPulled = jest.mocked(repository.setLastPulledAt);
const mockGetSupabase = jest.mocked(getSupabase);
const mockUpsert = jest.fn();

const chain = {
  select: jest.fn(), eq: jest.fn(), gt: jest.fn(), lte: jest.fn(), order: jest.fn(), range: jest.fn(), maybeSingle: jest.fn(), upsert: mockUpsert,
};
chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.gt.mockReturnValue(chain); chain.lte.mockReturnValue(chain); chain.order.mockReturnValue(chain); chain.range.mockResolvedValue({ data: [], error: null }); chain.maybeSingle.mockResolvedValue({ data: null, error: null });
const mockSupabase = { auth: { getSession: jest.fn() }, from: jest.fn(() => chain) };

describe('offline outbox and sync integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.gt.mockReturnValue(chain); chain.lte.mockReturnValue(chain); chain.order.mockReturnValue(chain); chain.range.mockResolvedValue({ data: [], error: null }); chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.from.mockReturnValue(chain);
    mockGetSupabase.mockReturnValue(mockSupabase as never);
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    mockListOutbox.mockResolvedValue([{ id: 'outbox-1', userId: 'user-1', entityType: 'transactions', entityId: 'tx-1', attemptCount: 0 }]);
    mockGetCloudPayload.mockResolvedValue({ id: 'tx-1', user_id: 'user-1', amount_minor: 600 });
    mockUpsert.mockResolvedValue({ error: null });
    mockGetLastPulled.mockResolvedValue('1970-01-01T00:00:00.000Z');
  });

  it('pushes a queued local write idempotently and then pulls every entity table', async () => {
    await syncNow();
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-1' }), { onConflict: 'id' });
    expect(mockMarkSuccess).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'tx-1' }));
    expect(mockMerge).toHaveBeenCalledTimes(4);
    expect(mockMergeProfile).not.toHaveBeenCalled();
    expect(mockSetLastPulled).toHaveBeenCalledTimes(4);
  });

  it('keeps a failed queued write for retry instead of marking it synced', async () => {
    mockUpsert.mockResolvedValueOnce({ error: new Error('offline') });
    await syncNow();
    expect(mockMarkFailure).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'tx-1' }), expect.any(String));
    expect(mockMarkSuccess).not.toHaveBeenCalled();
  });

  it('does not overwrite a newer cloud row with a stale queued write', async () => {
    mockGetCloudPayload.mockResolvedValueOnce({ id: 'tx-1', user_id: 'user-1', amount_minor: 600, updated_at: '2026-08-30T10:00:00.000Z' });
    chain.maybeSingle.mockResolvedValueOnce({ data: { updated_at: '2026-08-30T11:00:00.000Z' }, error: null });
    await syncNow();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockMarkSuccess).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'tx-1' }));
  });

  it('pulls an existing cloud profile before paginated finance rows', async () => {
    chain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { user_id: 'user-1', default_currency: 'PKR', locale: 'en-PK', timezone: 'Asia/Karachi', created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-30T00:00:00.000Z' }, error: null });
    await syncNow();
    expect(mockMergeProfile).toHaveBeenCalledWith(expect.objectContaining({ default_currency: 'PKR' }));
    expect(chain.range).toHaveBeenCalledTimes(4);
  });
});
