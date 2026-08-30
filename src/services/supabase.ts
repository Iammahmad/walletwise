import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isCloudConfigured = Boolean(url && publishableKey);

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const client: SupabaseClient | null = isCloudConfigured
  ? createClient(url!, publishableKey!, {
      auth: { storage: secureStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

export function getSupabase(): SupabaseClient | null {
  return client;
}

export function requireSupabase(): SupabaseClient {
  if (!client) throw new Error('Cloud services are not configured. SpendSpeak is running in local-only mode.');
  return client;
}
