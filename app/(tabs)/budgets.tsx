import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FeedbackState } from '@/src/components/FeedbackState';
import { FormField } from '@/src/components/FormField';
import { Screen } from '@/src/components/Screen';
import { SelectionSheet } from '@/src/components/SelectionSheet';
import { deleteBudget, listBudgets, listCategories, saveBudget } from '@/src/db/repository';
import { getZonedParts } from '@/src/domain/dates';
import { decimalToMinor, formatMoney, minorToDecimal } from '@/src/domain/money';
import type { Budget, Category } from '@/src/domain/types';
import { useReloadable } from '@/src/hooks/useReloadable';
import { normalizeError } from '@/src/services/errors';
import { radius, spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';
import { useAppStore } from '@/src/state/appStore';

interface Data { budgets: Budget[]; categories: Category[] }

export default function BudgetsScreen() {
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const bump = useAppStore((state) => state.bumpDbRevision);
  const loader = useCallback(async (): Promise<Data> => ({ budgets: await listBudgets(), categories: await listCategories('expense') }), []);
  const { data, loading, error, reload } = useReloadable<Data>(loader, { budgets: [], categories: [] });
  const [editing, setEditing] = useState<Budget | 'new' | null>(null);

  const remove = (budget: Budget) => Alert.alert('Delete budget?', 'Historical transactions will not be changed.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => {
      void deleteBudget(budget.id).then(() => bump()).catch((caught) => Alert.alert('Could not delete budget', normalizeError(caught).message));
    } },
  ]);

  return (
    <Screen title="Budgets" subtitle="Set an overall or category monthly spending limit." action={<Button label="New" icon="add" variant="secondary" onPress={() => setEditing('new')} />}>
      {loading ? <FeedbackState kind="loading" /> : error ? <FeedbackState kind="error" message={error} actionLabel="Try again" onAction={() => void reload()} /> : !data.budgets.length ? <FeedbackState kind="empty" title="No monthly budget yet" message="A simple limit makes the Home screen more useful." actionLabel="Create a budget" onAction={() => setEditing('new')} /> : data.budgets.map((budget) => (
        <Pressable key={budget.id} accessibilityRole="button" accessibilityLabel={`Edit ${budget.categoryName ?? 'overall'} budget`} onPress={() => setEditing(budget)}>
          <Card style={styles.row}><View><Text style={[styles.name, { color: colors.text }]}>{budget.categoryName ?? 'Overall monthly budget'}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>Monthly · starts {budget.startDate}</Text></View><View style={styles.amountWrap}><Text style={[styles.amount, { color: colors.primary }]}>{formatMoney(budget.amountMinor, budget.currency, profile.locale)}</Text><Pressable accessibilityRole="button" accessibilityLabel="Delete budget" hitSlop={10} onPress={() => remove(budget)}><Text style={{ color: colors.danger }}>Delete</Text></Pressable></View></Card>
        </Pressable>
      ))}
      {editing !== null ? <BudgetModal key={editing === 'new' ? 'new' : editing.id} visible budget={editing === 'new' ? null : editing} categories={data.categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); bump(); }} /> : null}
    </Screen>
  );
}

function BudgetModal({ visible, budget, categories, onClose, onSaved }: { visible: boolean; budget: Budget | null; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const [amount, setAmount] = useState(budget ? minorToDecimal(budget.amountMinor, budget.currency) : '');
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? 'overall');
  const [categorySheet, setCategorySheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const selected = categoryId === 'overall' ? 'Overall budget' : categories.find((item) => item.id === categoryId)?.name ?? 'Choose category';

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const minor = decimalToMinor(amount, profile.defaultCurrency, profile.locale);
      const now = getZonedParts(new Date(), profile.timezone);
      const startDate = `${now.year}-${String(now.month).padStart(2, '0')}-01`;
      await saveBudget({ ...(budget ? { id: budget.id } : {}), categoryId: categoryId === 'overall' ? null : categoryId, amountMinor: minor, currency: profile.defaultCurrency, startDate });
      onSaved();
    } catch (caught) { setError(normalizeError(caught).message); }
    finally { setSaving(false); }
  };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={[styles.overlay, { backgroundColor: colors.overlay }]}><View style={[styles.modal, { backgroundColor: colors.background }]}><Text accessibilityRole="header" style={[styles.modalTitle, { color: colors.text }]}>{budget ? 'Edit budget' : 'New monthly budget'}</Text><FormField label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" suffix={profile.defaultCurrency} placeholder="0.00" error={error ?? undefined} /><View style={{ gap: spacing.xs }}><Text style={[styles.label, { color: colors.text }]}>Scope</Text><Pressable accessibilityRole="button" onPress={() => setCategorySheet(true)} style={[styles.selector, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.text, fontSize: 16 }}>{selected}</Text></Pressable></View><Button label="Save budget" onPress={() => void submit()} loading={saving} /><Button label="Cancel" variant="ghost" onPress={onClose} /><SelectionSheet visible={categorySheet} title="Budget scope" selected={categoryId} options={[{ value: 'overall', label: 'Overall budget' }, ...categories.map((item) => ({ value: item.id, label: item.name }))]} onSelect={(value) => { setCategoryId(value); setCategorySheet(false); }} onClose={() => setCategorySheet(false)} /></View></View></Modal>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  name: { fontSize: 16, fontWeight: '700' }, meta: { fontSize: 13, marginTop: 4 },
  amountWrap: { alignItems: 'flex-end', gap: spacing.xs }, amount: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  overlay: { flex: 1, justifyContent: 'flex-end' }, modal: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  modalTitle: { fontSize: 22, fontWeight: '700' }, label: { fontSize: 14, fontWeight: '600' },
  selector: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, justifyContent: 'center' },
});
