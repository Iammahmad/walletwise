import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { TransactionForm } from '@/src/components/TransactionForm';
import { saveTransaction } from '@/src/db/repository';
import { spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';
import { useAppStore } from '@/src/state/appStore';

export default function AddScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const bump = useAppStore((state) => state.bumpDbRevision);
  return (
    <Screen title="Add entry" subtitle="Enter it manually or speak naturally.">
      <View style={[styles.voiceBanner, { backgroundColor: colors.primarySoft }]}>
        <View style={styles.voiceText}><Text style={[styles.voiceTitle, { color: colors.text }]}>Prefer to speak?</Text><Text style={[styles.voiceBody, { color: colors.textMuted }]}>You will review every field before anything is saved.</Text></View>
        <Button label="Use voice" icon="mic" variant="secondary" onPress={() => router.push('/voice')} />
      </View>
      <TransactionForm onSubmit={async (input) => { await saveTransaction(input); bump(); router.replace('/(tabs)/transactions'); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({ voiceBanner: { borderRadius: 18, padding: spacing.md, gap: spacing.sm }, voiceText: { gap: 2 }, voiceTitle: { fontSize: 16, fontWeight: '700' }, voiceBody: { fontSize: 13, lineHeight: 19 } });
