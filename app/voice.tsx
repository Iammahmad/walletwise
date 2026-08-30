import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { VoiceButton } from '@/src/components/VoiceButton';
import { findRecentTransaction, listAccounts, listCategories, setTransactionDeleted } from '@/src/db/repository';
import type { Transaction, VoiceDraft, VoiceState } from '@/src/domain/types';
import { parseVoiceCommand } from '@/src/domain/voiceParser';
import { parseWithCloudAi } from '@/src/services/ai';
import { normalizeError } from '@/src/services/errors';
import { spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';
import { useAppStore } from '@/src/state/appStore';

const MAX_LISTENING_MS = 30_000;
const SILENCE_AFTER_RESULT_MS = 5_000;

export default function VoiceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((item) => item.profile)!;
  const online = useAppStore((item) => item.isOnline);
  const setVoiceReview = useAppStore((item) => item.setVoiceReview);
  const bump = useAppStore((item) => item.bumpDbRevision);
  const setLastDeleted = useAppStore((item) => item.setLastDeletedTransactionId);
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');
  const [message, setMessage] = useState('Tap the microphone and speak naturally.');
  const [candidates, setCandidates] = useState<Transaction[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);
  const interpreting = useRef(false);

  const clearTimer = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null; }, []);
  const scheduleStop = useCallback((delay: number) => { clearTimer(); timer.current = setTimeout(() => { ExpoSpeechRecognitionModule.stop(); setState('processingTranscript'); }, delay); }, [clearTimer]);

  const openReview = useCallback((drafts: VoiceDraft[], original: string) => {
    setVoiceReview(drafts, original);
    setState(drafts.some((draft) => draft.lowConfidenceFields.length) ? 'needsClarification' : 'readyForReview');
    router.replace('/review');
  }, [router, setVoiceReview]);

  const interpret = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || interpreting.current || cancelled.current) return;
    interpreting.current = true;
    setState('interpreting');
    setMessage('Interpreting your entry on this device…');
    try {
      const [accounts, categories] = await Promise.all([listAccounts(), listCategories()]);
      const result = parseVoiceCommand(clean, {
        defaultCurrency: profile.defaultCurrency,
        timezone: profile.timezone,
        accounts: accounts.map((item) => item.name),
        categories: categories.map((item) => item.name),
        referenceTime: new Date(),
      });
      if (result.kind === 'delete') {
        const matches = await findRecentTransaction(result.query);
        setCandidates(matches);
        if (!matches.length) { setState('needsClarification'); setMessage('I could not find a matching recent transaction. Open Transactions to choose one.'); }
        else { setState('needsClarification'); setMessage(matches.length === 1 ? 'Review the matching transaction before deleting it.' : 'Choose the transaction you meant.'); }
        return;
      }
      if (result.kind === 'transactions') {
        let drafts = result.drafts;
        if (result.missingFields.length && profile.cloudAiEnabled && online) {
          setMessage('Local parsing needs help. Asking the protected cloud parser…');
          try {
            const ai = await parseWithCloudAi({ transcript: clean, locale: profile.locale, timezone: profile.timezone, defaultCurrency: profile.defaultCurrency, accounts: accounts.map((item) => item.name), categories: categories.map((item) => item.name), referenceTime: new Date().toISOString() });
            drafts = ai.transactions.map((item, index) => {
              const local = drafts[index];
              const missing = ['amount', 'category', 'account'].filter((field) => !item[field as keyof typeof item]);
              return {
                id: local?.id ?? Crypto.randomUUID(),
                type: local?.type ?? item.type,
                amount: local?.amount ?? item.amount,
                currency: local?.currency ?? item.currency ?? profile.defaultCurrency,
                merchant: local?.merchant ?? item.merchant,
                category: local?.category ?? item.category,
                account: local?.account ?? item.account,
                occurredAt: local?.occurredAt ?? item.occurredAt,
                note: local?.note ?? item.note,
                confidence: Math.max(local?.confidence ?? 0, item.confidence),
                lowConfidenceFields: missing,
                originalTranscript: clean,
              };
            });
          } catch (error) { setMessage(`Cloud parsing was unavailable: ${normalizeError(error).message} You can complete the review manually.`); }
        }
        openReview(drafts, clean);
        return;
      }
      openReview([{
        id: Crypto.randomUUID(), type: 'expense', amount: null, currency: profile.defaultCurrency, merchant: null,
        category: null, account: null, occurredAt: new Date().toISOString(), note: null, confidence: 0.2,
        lowConfidenceFields: ['amount', 'category', 'account'], originalTranscript: clean,
      }], clean);
    } catch (error) {
      setState('error'); setMessage(normalizeError(error).message);
    } finally { interpreting.current = false; }
  }, [online, openReview, profile]);

  useSpeechRecognitionEvent('result', (event) => {
    const next = event.results[0]?.transcript?.trim() ?? '';
    if (next) { transcriptRef.current = next; setTranscript(next); if (!event.isFinal) scheduleStop(SILENCE_AFTER_RESULT_MS); }
    if (event.isFinal && next) { clearTimer(); void interpret(next); }
  });
  useSpeechRecognitionEvent('error', (event) => {
    clearTimer();
    if (cancelled.current || event.error === 'aborted') return;
    setState('error');
    setMessage(event.error === 'not-allowed' ? 'Microphone or speech permission was denied. Enable it in device Settings to use voice entry.' : event.error === 'no-speech' || event.error === 'speech-timeout' ? 'I did not hear any speech. Try again or enter it manually.' : `Speech recognition error: ${event.message}`);
  });
  useSpeechRecognitionEvent('end', () => {
    clearTimer();
    if (cancelled.current || interpreting.current) return;
    if (transcriptRef.current) void interpret(transcriptRef.current);
    else {
      setState('error');
      setMessage('I did not hear any speech. Try again or enter it manually.');
    }
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => { if (next !== 'active') { cancelled.current = true; clearTimer(); ExpoSpeechRecognitionModule.abort(); } });
    return () => { subscription.remove(); clearTimer(); ExpoSpeechRecognitionModule.abort(); };
  }, [clearTimer]);

  const start = async () => {
    cancelled.current = false; interpreting.current = false; transcriptRef.current = ''; setTranscript(''); setCandidates([]);
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) { setState('error'); setMessage('Speech recognition is unavailable on this device. You can still add the entry manually.'); return; }
    setState('requestingPermission'); setMessage('Requesting microphone and speech recognition permission…');
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) { setState('error'); setMessage(permission.restricted ? 'Speech recognition is restricted by device settings.' : 'Permission was denied. Enable microphone and speech recognition in Settings.'); return; }
      setState('listening'); setMessage('Listening… Try “Paid 600 for fuel yesterday from cash.”');
      ExpoSpeechRecognitionModule.start({
        lang: profile.locale.startsWith('en') ? profile.locale : 'en-US',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        contextualStrings: ['rupees', 'groceries', 'fuel', 'salary', 'cash', 'bank', 'expense', 'income'],
      });
      scheduleStop(MAX_LISTENING_MS);
    } catch (error) { setState('error'); setMessage(normalizeError(error).message); }
  };
  const stop = () => { clearTimer(); setState('processingTranscript'); setMessage('Finishing the transcript…'); ExpoSpeechRecognitionModule.stop(); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); };
  const cancel = () => { cancelled.current = true; clearTimer(); ExpoSpeechRecognitionModule.abort(); router.back(); };
  const confirmDelete = (transaction: Transaction) => Alert.alert('Delete this transaction?', `${transaction.merchant || transaction.categoryName || 'Transaction'} will be soft-deleted.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
    void setTransactionDeleted(transaction.id, true)
      .then(() => { setLastDeleted(transaction.id); bump(); router.replace('/(tabs)/transactions'); })
      .catch((error) => { setState('error'); setMessage(normalizeError(error).message); });
  } }]);

  return (
    <Screen scroll={false}>
      <View style={styles.content}>
        <View style={styles.status}><Ionicons name={state === 'error' ? 'alert-circle-outline' : state === 'listening' ? 'radio-outline' : 'mic-outline'} size={22} color={state === 'error' ? colors.danger : colors.primary} /><Text accessibilityLiveRegion="polite" accessibilityRole="text" style={[styles.state, { color: colors.text }]}>{state.replace(/([A-Z])/g, ' $1')}</Text></View>
        <Card style={[styles.transcriptCard, state === 'listening' && { borderColor: colors.primary }]}>
          <Text style={[styles.transcriptLabel, { color: colors.textMuted }]}>Live transcript</Text>
          <Text style={[styles.transcript, { color: transcript ? colors.text : colors.textMuted }]}>{transcript || message}</Text>
        </Card>
        {candidates.map((candidate) => <Pressable key={candidate.id} accessibilityRole="button" onPress={() => confirmDelete(candidate)}><Card><Text style={[styles.candidateTitle, { color: colors.text }]}>{candidate.merchant || candidate.categoryName || 'Transaction'}</Text><Text style={{ color: colors.textMuted }}>Tap to review deletion · {candidate.categoryName}</Text></Card></Pressable>)}
        <View style={styles.mic}><VoiceButton state={state} onPress={state === 'listening' ? stop : () => void start()} label={state === 'error' ? 'Try again' : 'Start listening'} /></View>
        {state === 'listening' || state === 'processingTranscript' ? <View style={styles.controls}><Button label="Cancel" variant="secondary" onPress={cancel} /><Button label="Stop" icon="stop" onPress={stop} disabled={state !== 'listening'} /></View> : <Button label="Cancel" variant="ghost" onPress={cancel} />}
        {state === 'error' ? <Button label="Enter manually" variant="secondary" onPress={() => router.replace('/(tabs)/add')} /> : null}
        <Text style={[styles.privacy, { color: colors.textMuted }]}>Audio is processed by the device recognition service and is never saved by SpendSpeak.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { flex: 1, justifyContent: 'center', gap: spacing.md }, status: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center' }, state: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' }, transcriptCard: { minHeight: 180, justifyContent: 'center', gap: spacing.sm }, transcriptLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: '700' }, transcript: { fontSize: 24, lineHeight: 33, fontWeight: '600' }, candidateTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 }, mic: { alignItems: 'center' }, controls: { flexDirection: 'row', gap: spacing.sm }, privacy: { fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: spacing.lg } });
