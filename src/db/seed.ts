import type { TransactionType } from '@/src/domain/types';

export const DEFAULT_CATEGORIES: readonly {
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
}[] = [
  { name: 'Food', icon: 'restaurant-outline', color: '#D97706', type: 'expense' },
  { name: 'Groceries', icon: 'basket-outline', color: '#059669', type: 'expense' },
  { name: 'Transport', icon: 'bus-outline', color: '#2563EB', type: 'expense' },
  { name: 'Fuel', icon: 'car-outline', color: '#EA580C', type: 'expense' },
  { name: 'Shopping', icon: 'bag-handle-outline', color: '#7C3AED', type: 'expense' },
  { name: 'Bills', icon: 'receipt-outline', color: '#475569', type: 'expense' },
  { name: 'Entertainment', icon: 'film-outline', color: '#DB2777', type: 'expense' },
  { name: 'Health', icon: 'medkit-outline', color: '#DC2626', type: 'expense' },
  { name: 'Education', icon: 'school-outline', color: '#4F46E5', type: 'expense' },
  { name: 'Rent', icon: 'home-outline', color: '#9333EA', type: 'expense' },
  { name: 'Travel', icon: 'airplane-outline', color: '#0284C7', type: 'expense' },
  { name: 'Other', icon: 'ellipsis-horizontal-outline', color: '#64748B', type: 'expense' },
  { name: 'Income', icon: 'arrow-down-circle-outline', color: '#047857', type: 'income' },
];
