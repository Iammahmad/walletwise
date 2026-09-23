export type TransactionType = "expense" | "income";
export type TransactionSource = "manual" | "voice";
export type BudgetAssignmentMode = "auto" | "explicit" | "none";
export type SyncStatus = "local" | "pending" | "synced" | "error";
export type AccountType = "cash" | "bank" | "wallet" | "credit" | "other";

export interface LocalProfile {
  id: string;
  userId: string | null;
  defaultCurrency: string;
  locale: string;
  timezone: string;
  onboardingCompleted: boolean;
  cloudAiEnabled: boolean;
  theme: "system" | "light" | "dark";
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

export interface CategoryInput {
  name: string;
  icon: string;
  color: string;
  transactionType: TransactionType;
}

export interface BudgetCategory {
  id: string;
  userId: string | null;
  localOwnerId: string;
  sourceCategoryId: string | null;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  lastSyncedAt: string | null;
  sourceCategoryName?: string | null;
}

export interface BudgetCategoryInput {
  id?: string;
  sourceCategoryId?: string | null;
  name: string;
  icon: string;
  color: string;
}

export interface Transaction {
  id: string;
  userId: string | null;
  localOwnerId: string;
  accountId: string;
  categoryId: string;
  budgetCategoryId: string | null;
  budgetAssignmentMode: BudgetAssignmentMode;
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
  budgetCategoryName?: string;
  budgetCategoryIcon?: string;
  budgetCategoryColor?: string;
}

export interface Budget {
  id: string;
  userId: string | null;
  localOwnerId: string;
  budgetCategoryId: string | null;
  amountMinor: number;
  currency: string;
  period: "monthly";
  startDate: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  lastSyncedAt: string | null;
  budgetCategoryName?: string | null;
  budgetCategoryIcon?: string | null;
  budgetCategoryColor?: string | null;
}

export interface BudgetProgress {
  budget: Budget;
  spentMinor: number;
  remainingMinor: number;
}

export interface TransactionInput {
  id?: string;
  accountId: string;
  categoryId: string;
  /** Undefined matches a same-name budget; null explicitly excludes category budgets. */
  budgetCategoryId?: string | null;
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
  type?: TransactionType | "all";
  accountId?: string;
  categoryId?: string;
  budgetCategoryId?: string;
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
  budget: string | null;
  account: string | null;
  occurredAt: string | null;
  note: string | null;
  confidence: number;
  lowConfidenceFields: string[];
  originalTranscript: string;
}

export type ParsedVoiceCommand =
  | { kind: "transactions"; drafts: VoiceDraft[]; missingFields: string[] }
  | { kind: "delete"; query: string; confidence: number }
  | { kind: "unknown"; transcript: string; reason: string };

export type VoiceState =
  | "idle"
  | "requestingPermission"
  | "listening"
  | "processingTranscript"
  | "interpreting"
  | "needsClarification"
  | "readyForReview"
  | "error";

export interface DashboardSummary {
  spendingMinor: number;
  incomeMinor: number;
  budgetMinor: number | null;
  categoryTotals: {
    categoryId: string;
    name: string;
    color: string;
    amountMinor: number;
  }[];
}

export type SavingSource = "manual" | "voice";

export interface SavingEntry {
  id: string;
  userId: string | null;
  localOwnerId: string;
  name: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  note: string | null;
  source: SavingSource;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  lastSyncedAt: string | null;
}

export interface SavingInput {
  id?: string;
  name: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  note: string | null;
  source: SavingSource;
}

export type SplitContactStatus = "local" | "invited" | "connected";

export interface SplitContact {
  id: string;
  userId: string | null;
  localOwnerId: string;
  remoteUserId: string | null;
  displayName: string;
  email: string | null;
  status: SplitContactStatus;
  inviteToken: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  lastSyncedAt: string | null;
}

export type SplitType = "equal" | "loan";
export type LoanDirection = "lent" | "borrowed";
export type SplitStatus = "open" | "settled";

export interface SplitParticipant {
  id: string;
  splitId: string;
  contactId: string | null;
  remoteUserId: string | null;
  displayName: string;
  isOwner: boolean;
  shareMinor: number;
  paidMinor: number;
  createdAt: string;
  updatedAt: string;
}

export interface SplitEntry {
  id: string;
  userId: string | null;
  localOwnerId: string;
  createdByUserId: string | null;
  description: string;
  splitType: SplitType;
  loanDirection: LoanDirection | null;
  totalMinor: number;
  currency: string;
  occurredAt: string;
  status: SplitStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  lastSyncedAt: string | null;
  participants: SplitParticipant[];
}

export interface SplitParticipantInput {
  contactId?: string | null;
  remoteUserId?: string | null;
  displayName: string;
  isOwner: boolean;
  shareMinor: number;
  paidMinor: number;
}

export interface SplitInput {
  id?: string;
  description: string;
  splitType: SplitType;
  loanDirection?: LoanDirection | null;
  totalMinor: number;
  currency: string;
  occurredAt: string;
  note: string | null;
  participants: SplitParticipantInput[];
}

export interface SplitSettlement {
  id: string;
  userId: string | null;
  localOwnerId: string;
  splitId: string | null;
  contactId: string;
  direction: "received" | "paid";
  amountMinor: number;
  currency: string;
  occurredAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  lastSyncedAt: string | null;
}

export interface ContactBalance {
  contact: SplitContact;
  balanceMinor: number;
  openSplitCount: number;
}
