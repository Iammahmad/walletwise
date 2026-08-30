import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FeedbackState } from '@/src/components/FeedbackState';
import { Screen } from '@/src/components/Screen';
import { TransactionRow } from '@/src/components/TransactionRow';
import { VoiceButton } from '@/src/components/VoiceButton';
import { getDashboardSummary, listTransactions } from '@/src/db/repository';
import { monthBounds } from '@/src/domain/dates';
import { formatMoney } from '@/src/domain/money';
import type { DashboardSummary, Transaction } from '@/src/domain/types';
import { useReloadable } from '@/src/hooks/useReloadable';
import { spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';
import { useAppStore } from '@/src/state/appStore';

interface HomeData { summary: DashboardSummary; recent: Transaction[] }
const EMPTY: HomeData = { summary: { spendingMinor: 0, incomeMinor: 0, budgetMinor: null, categoryTotals: [] }, recent: [] };

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const online = useAppStore((state) => state.isOnline);
  const loader = useCallback(async () => {
    const bounds = monthBounds(new Date(), profile.timezone);
    const [summary, recent] = await Promise.all([getDashboardSummary(bounds.start, bounds.end), listTransactions({ limit: 5 })]);
    return { summary, recent };
  }, [profile.timezone]);
  const { data, loading, error, reload } = useReloadable(loader, EMPTY);
  const remaining = data.summary.budgetMinor == null ? null : data.summary.budgetMinor - data.summary.spendingMinor;
  const largestCategory = Math.max(...data.summary.categoryTotals.map((item) => item.amountMinor), 1);
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen title={greeting} subtitle="Here is your money at a glance.">
      {!online ? <Card style={{ backgroundColor: colors.warningSoft }}><Text style={{ color: colors.warning }}>Offline — entries stay on this device and sync later.</Text></Card> : null}
      {loading ? <FeedbackState kind="loading" /> : error ? <FeedbackState kind="error" message={error} actionLabel="Try again" onAction={() => void reload()} /> : (
        <>
          <Card style={[styles.summary, { backgroundColor: colors.primary }] }>
            <Text style={styles.summaryLabel}>Spent this month</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.summaryAmount}>{formatMoney(data.summary.spendingMinor, profile.defaultCurrency, profile.locale)}</Text>
            <View style={styles.summaryDetails}>
              <SummaryDetail label="Income" value={formatMoney(data.summary.incomeMinor, profile.defaultCurrency, profile.locale)} />
              <SummaryDetail label="Budget left" value={remaining == null ? 'Not set' : formatMoney(remaining, profile.defaultCurrency, profile.locale)} />
            </View>
          </Card>

          <View style={styles.quickActions}>
            <View style={styles.voice}><VoiceButton onPress={() => router.push('/voice')} /></View>
            <Button label="Manual expense" icon="add" variant="secondary" onPress={() => router.push('/(tabs)/add')} />
          </View>

          <SectionTitle title="Spending by category" />
          <Card>
            {data.summary.categoryTotals.length ? data.summary.categoryTotals.slice(0, 5).map((item) => (
              <View key={item.categoryId} accessible accessibilityLabel={`${item.name}, ${formatMoney(item.amountMinor, profile.defaultCurrency, profile.locale)}`} style={styles.categoryRow}>
                <View style={styles.categoryHeading}><Text style={[styles.categoryName, { color: colors.text }]}>{item.name}</Text><Text style={[styles.categoryAmount, { color: colors.textMuted }]}>{formatMoney(item.amountMinor, profile.defaultCurrency, profile.locale)}</Text></View>
                <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}><View style={[styles.bar, { backgroundColor: item.color, width: `${Math.max(7, (item.amountMinor / largestCategory) * 100)}%` }]} /></View>
              </View>
            )) : <Text style={[styles.emptyText, { color: colors.textMuted }]}>Add an expense to see your category breakdown.</Text>}
          </Card>

          <SectionTitle title="Recent transactions" action="See all" onPress={() => router.push('/(tabs)/transactions')} />
          <Card>
            {data.recent.length ? data.recent.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} locale={profile.locale} timezone={profile.timezone} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })} />) : <Text style={[styles.emptyText, { color: colors.textMuted }]}>No transactions yet. Your first entry takes only a few seconds.</Text>}
          </Card>
        </>
      )}
    </Screen>
  );
}

function SummaryDetail({ label, value }: { label: string; value: string }) { return <View><Text style={styles.detailLabel}>{label}</Text><Text numberOfLines={1} style={styles.detailValue}>{value}</Text></View>; }
function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return <View style={styles.sectionHeader}><Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>{action ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.sectionAction}><Text style={{ color: colors.primary, fontWeight: '600' }}>{action}</Text><Ionicons name="chevron-forward" color={colors.primary} /></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  summary: { borderWidth: 0, padding: spacing.lg },
  summaryLabel: { color: '#DDF2E9', fontSize: 14, fontWeight: '600' },
  summaryAmount: { color: '#FFFFFF', fontSize: 36, lineHeight: 45, fontWeight: '700', fontVariant: ['tabular-nums'], marginVertical: spacing.xs },
  summaryDetails: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md },
  detailLabel: { color: '#C7EBDD', fontSize: 12 },
  detailValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 3, maxWidth: 150, fontVariant: ['tabular-nums'] },
  quickActions: { alignItems: 'center', gap: spacing.xs },
  voice: { marginTop: -8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  categoryRow: { gap: 6, paddingVertical: spacing.xs },
  categoryHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  categoryName: { fontSize: 14, fontWeight: '600' },
  categoryAmount: { fontSize: 13, fontVariant: ['tabular-nums'] },
  track: { height: 7, borderRadius: 7, overflow: 'hidden' },
  bar: { height: 7, borderRadius: 7 },
  emptyText: { paddingVertical: spacing.lg, textAlign: 'center', lineHeight: 21 },
});
