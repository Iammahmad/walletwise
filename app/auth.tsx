import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FormField } from '@/src/components/FormField';
import { Screen } from '@/src/components/Screen';
import { getProfile, resetLocalData } from '@/src/db/repository';
import { deleteCloudAccount, signIn, signUp } from '@/src/services/auth';
import { normalizeError } from '@/src/services/errors';
import { isCloudConfigured } from '@/src/services/supabase';
import { syncNow } from '@/src/services/sync';
import { spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';
import { useAppStore } from '@/src/state/appStore';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ delete?: string }>();
  const { colors } = useTheme();
  const setProfile = useAppStore((state) => state.setProfile);
  const bump = useAppStore((state) => state.bumpDbRevision);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (mode: 'in' | 'up') => {
    setLoading(true); setMessage(null);
    try {
      if (mode === 'in') await signIn(email, password);
      else { const result = await signUp(email, password); if (result.confirmationRequired) { setMessage('Check your email to confirm the account, then sign in.'); return; } }
      await syncNow(); setProfile(await getProfile()); bump(); router.replace('/(tabs)/settings');
    } catch (error) { setMessage(normalizeError(error).message); }
    finally { setLoading(false); }
  };
  const removeAccount = () => Alert.alert('Permanently delete account?', 'This deletes cloud data and the authentication account, then resets this device. This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete permanently', style: 'destructive', onPress: () => { setLoading(true); void deleteCloudAccount().then(resetLocalData).then(async () => { setProfile(await getProfile()); bump(); router.replace('/onboarding'); }).catch((error) => setMessage(normalizeError(error).message)).finally(() => setLoading(false)); } }]);

  if (!isCloudConfigured) return <Screen title="Local-only mode"><Card><Text style={[styles.copy, { color: colors.text }]}>Supabase is not configured. Add the public URL and publishable key described in README, then rebuild the app. Every local feature remains available.</Text></Card><Button label="Continue locally" onPress={() => router.replace('/(tabs)')} /></Screen>;
  if (params.delete === '1') return <Screen title="Delete account" subtitle="This protected operation removes cloud data and your sign-in identity."><Card><Text style={[styles.copy, { color: colors.text }]}>Local and cloud deletion are separate so an accidental sign-out cannot erase your ledger. Continuing will delete both after confirmation.</Text></Card>{message ? <Text style={{ color: colors.danger }}>{message}</Text> : null}<Button label="Delete account and all data" variant="danger" loading={loading} onPress={removeAccount} /></Screen>;
  return <Screen title="Backup & sync" subtitle="Optional. Local tracking works without an account."><Card><Text style={[styles.copy, { color: colors.textMuted }]}>Signing in links this device’s local records to your account. Row Level Security keeps each user’s cloud rows isolated.</Text></Card><FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />{message ? <Text accessibilityRole="alert" style={{ color: message.startsWith('Check') ? colors.primary : colors.danger }}>{message}</Text> : null}<Button label="Sign in" loading={loading} disabled={!email || password.length < 6} onPress={() => void submit('in')} /><Button label="Create account" variant="secondary" disabled={loading || !email || password.length < 6} onPress={() => void submit('up')} /><Button label="Not now" variant="ghost" onPress={() => router.replace('/(tabs)')} /></Screen>;
}

const styles = StyleSheet.create({ copy: { fontSize: 14, lineHeight: 21, marginBottom: spacing.xs } });
