export type TransactionType = 'expense' | 'income';
export type TransactionSource = 'manual' | 'voice';
export type SyncStatus = 'local' | 'pending' | 'synced' | 'error';
export type AccountType = 'cash' | 'bank' | 'wallet' | 'credit' | 'other';

export interface LocalProfile {
  id: string;
  userId: string | null;
  defaultCurrency: string;
  locale: string;
  timezone: string;
  onboardingCompleted: boolean;
  cloudAiEnabled: boolean;
  theme: 'system' | 'light' | 'dark';
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  userId: string | null;
  localOwnerId: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalanceMinor: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  lastSyncedAt: string | null;
}

export interface Category {
  id: string;
  userId: string | null;
  localOwnerId: string;
  name: string;
  icon: string;
  color: string;
  transactionType: TransactionType;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  lastSyncedAt: string | null;
}

export interface Transaction {
  id: string;
  userId: string | null;
  localOwnerId: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amountMinor: number;
  currency: string;
  merchant: string | null;
  note: string | null;
  occurredAt: string;
  source: TransactionSource;
  originalTranscript: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  lastSyncedAt: string | null;
  accountName?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
}

export interface Budget {
  id: string;
  userId: string | null;
  localOwnerId: string;
  categoryId: string | null;
  amountMinor: number;
  currency: string;
  period: 'monthly';
  startDate: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  lastSyncedAt: string | null;
  categoryName?: string | null;
}

export interface TransactionInput {
  id?: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amountMinor: number;
  currency: string;
  merchant: string | null;
  note: string | null;
  occurredAt: string;
  source: TransactionSource;
  originalTranscript: string | null;
}

export interface TransactionFilters {
  search?: string;
  type?: TransactionType | 'all';
  accountId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface VoiceDraft {
  id: string;
  type: TransactionType;
  amount: string | null;
  currency: string | null;
  merchant: string | null;
  category: string | null;
  account: string | null;
  occurredAt: string | null;
  note: string | null;
  confidence: number;
  lowConfidenceFields: string[];
  originalTranscript: string;
}

export type ParsedVoiceCommand =
  | { kind: 'transactions'; drafts: VoiceDraft[]; missingFields: string[] }
  | { kind: 'delete'; query: string; confidence: number }
  | { kind: 'unknown'; transcript: string; reason: string };

export type VoiceState =
  | 'idle'
  | 'requestingPermission'
  | 'listening'
  | 'processingTranscript'
  | 'interpreting'
  | 'needsClarification'
  | 'readyForReview'
  | 'error';

export interface DashboardSummary {
  spendingMinor: number;
  incomeMinor: number;
  budgetMinor: number | null;
  categoryTotals: { categoryId: string; name: string; color: string; amountMinor: number }[];
}
