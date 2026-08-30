import type { Session } from '@supabase/supabase-js';

import { getProfile, linkLocalDataToUser, preparePristineLocalDataForCloudRestore, unlinkCloudUser } from '@/src/db/repository';
import { requireSupabase } from './supabase';

async function connectLocalData(userId: string): Promise<void> {
  const supabase = requireSupabase();
  const localProfile = await getProfile();
  if (localProfile.userId && localProfile.userId !== userId) {
    throw new Error('This device ledger is linked to a different account. Sign in with that account, or reset local data before switching accounts.');
  }
  if (localProfile.userId === userId) return;
  const { data: remoteProfile, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (remoteProfile && await preparePristineLocalDataForCloudRestore(userId)) return;
  await linkLocalDataToUser(userId);
}

export async function getSession(): Promise<Session | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  if (!data.session) throw new Error('Sign-in did not return a session.');
  try {
    await connectLocalData(data.session.user.id);
  } catch (connectError) {
    await supabase.auth.signOut();
    throw connectError;
  }
  return data.session;
}

export async function signUp(email: string, password: string): Promise<{ session: Session | null; confirmationRequired: boolean }> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  if (data.session) {
    try {
      await connectLocalData(data.session.user.id);
    } catch (connectError) {
      await supabase.auth.signOut();
      throw connectError;
    }
  }
  return { session: data.session, confirmationRequired: !data.session };
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  await unlinkCloudUser();
}

export async function deleteCloudAccount(): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.functions.invoke('delete-account', { body: { confirmation: 'DELETE' } });
  if (error) throw error;
  await unlinkCloudUser();
}
