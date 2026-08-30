import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card } from '@/src/components/Card';
import { FeedbackState } from '@/src/components/FeedbackState';
import { Screen } from '@/src/components/Screen';
import { TransactionForm } from '@/src/components/TransactionForm';
import { saveTransaction } from '@/src/db/repository';
import { spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';
import { useAppStore } from '@/src/state/appStore';

export default function ReviewScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const drafts = useAppStore((state) => state.voiceDrafts);
  const transcript = useAppStore((state) => state.voiceTranscript);
  const clear = useAppStore((state) => state.clearVoiceReview);
  const bump = useAppStore((state) => state.bumpDbRevision);
  const [index, setIndex] = useState(0);
  const draft = drafts[index];
  if (!draft) return <Screen><FeedbackState kind="empty" title="No voice draft" message="Nothing was saved. Start a new voice entry when you are ready." actionLabel="Return home" onAction={() => router.replace('/(tabs)')} /></Screen>;
  const missing = draft.lowConfidenceFields;
  return (
    <Screen title={drafts.length > 1 ? `Review entry ${index + 1} of ${drafts.length}` : 'Review voice entry'} subtitle="Nothing is saved until you confirm this form.">
      {missing.length ? <Card style={{ backgroundColor: colors.warningSoft }}><Text accessibilityRole="alert" style={[styles.warningTitle, { color: colors.warning }]}>Please check {missing.join(', ')}</Text><Text style={[styles.warningBody, { color: colors.text }]}>These fields were missing or interpreted with low confidence.</Text></Card> : <Card style={{ backgroundColor: colors.primarySoft }}><Text style={[styles.warningTitle, { color: colors.primary }]}>Ready for your review</Text><Text style={[styles.warningBody, { color: colors.text }]}>Check every field, then confirm explicitly.</Text></Card>}
      <TransactionForm
        key={draft.id}
        source="voice"
        originalTranscript={transcript}
        preset={{ type: draft.type, amount: draft.amount ?? '', currency: draft.currency ?? '', merchant: draft.merchant ?? '', categoryName: draft.category ?? '', accountName: draft.account ?? '', occurredAt: draft.occurredAt ?? new Date().toISOString(), note: draft.note ?? '' }}
        submitLabel={index < drafts.length - 1 ? 'Confirm and review next' : drafts.length > 1 ? 'Confirm final entry' : 'Confirm entry'}
        onSubmit={async (input) => {
          await saveTransaction(input); bump();
          if (index < drafts.length - 1) setIndex((value) => value + 1);
          else { clear(); router.replace('/(tabs)/transactions'); }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ warningTitle: { fontSize: 15, fontWeight: '700' }, warningBody: { fontSize: 13, lineHeight: 19, marginTop: spacing.xs } });
