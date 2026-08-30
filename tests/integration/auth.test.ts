import * as repository from '@/src/db/repository';
import { signIn } from '@/src/services/auth';
import { requireSupabase } from '@/src/services/supabase';

jest.mock('@/src/db/repository', () => ({
  getProfile: jest.fn(),
  linkLocalDataToUser: jest.fn(),
  preparePristineLocalDataForCloudRestore: jest.fn(),
  unlinkCloudUser: jest.fn(),
}));

jest.mock('@/src/services/supabase', () => ({ requireSupabase: jest.fn() }));

const profile = {
  id: 'local-owner-1', userId: null, defaultCurrency: 'PKR', locale: 'en-PK', timezone: 'Asia/Karachi',
  onboardingCompleted: true, cloudAiEnabled: false, theme: 'system' as const,
  createdAt: '2026-08-30T00:00:00.000Z', updatedAt: '2026-08-30T00:00:00.000Z',
};

const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() };
chain.select.mockReturnValue(chain);
chain.eq.mockReturnValue(chain);

const session = { user: { id: 'user-1', email: 'user@example.com' } };
const supabase = {
  auth: {
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
  },
  from: jest.fn(() => chain),
};

describe('authentication and local-ledger ownership integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    jest.mocked(requireSupabase).mockReturnValue(supabase as never);
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
    supabase.auth.signOut.mockResolvedValue({ error: null });
    jest.mocked(repository.getProfile).mockResolvedValue(profile);
    jest.mocked(repository.preparePristineLocalDataForCloudRestore).mockResolvedValue(false);
  });

  it('links unsynced local data when the account has no cloud profile', async () => {
    await signIn('user@example.com', 'password');
    expect(repository.linkLocalDataToUser).toHaveBeenCalledWith('user-1');
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('prepares an empty local shell for restore when cloud backup exists', async () => {
    chain.maybeSingle.mockResolvedValueOnce({ data: { user_id: 'user-1' }, error: null });
    jest.mocked(repository.preparePristineLocalDataForCloudRestore).mockResolvedValueOnce(true);
    await signIn('user@example.com', 'password');
    expect(repository.preparePristineLocalDataForCloudRestore).toHaveBeenCalledWith('user-1');
    expect(repository.linkLocalDataToUser).not.toHaveBeenCalled();
  });

  it('rejects a different account and immediately clears the newly created session', async () => {
    jest.mocked(repository.getProfile).mockResolvedValueOnce({ ...profile, userId: 'another-user' });
    await expect(signIn('user@example.com', 'password')).rejects.toThrow('linked to a different account');
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(repository.linkLocalDataToUser).not.toHaveBeenCalled();
  });
});
