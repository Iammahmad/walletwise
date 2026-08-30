import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Transaction } from '@/src/domain/types';
import { formatMoney } from '@/src/domain/money';
import { formatDate } from '@/src/domain/dates';
import { radius, spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';

interface Props { transaction: Transaction; locale: string; timezone: string; onPress?: () => void }

export function TransactionRow({ transaction, locale, timezone, onPress }: Props) {
  const { colors } = useTheme();
  const amountColor = transaction.type === 'income' ? colors.income : colors.expense;
  const amountPrefix = transaction.type === 'income' ? '+' : '−';
  const label = `${transaction.merchant || transaction.categoryName || 'Transaction'}, ${amountPrefix}${formatMoney(transaction.amountMinor, transaction.currency, locale)}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: `${transaction.categoryColor ?? colors.primary}20` }]}>
        <Ionicons name={(transaction.categoryIcon ?? 'receipt-outline') as never} size={20} color={transaction.categoryColor ?? colors.primary} />
      </View>
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{transaction.merchant || transaction.categoryName || 'Transaction'}</Text>
        <Text numberOfLines={1} style={[styles.meta, { color: colors.textMuted }]}>{transaction.categoryName} · {formatDate(transaction.occurredAt, locale, timezone, { month: 'short', day: 'numeric' })} · {transaction.source}</Text>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>{amountPrefix}{formatMoney(transaction.amountMinor, transaction.currency, locale)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 3 },
  amount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
