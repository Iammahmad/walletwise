import { z } from 'zod';

const nullableTrimmedString = z.string().trim().max(160).nullable();

export const aiTransactionSchema = z
  .object({
    type: z.enum(['expense', 'income']),
    amount: z.string().regex(/^\d+(?:\.\d+)?$/).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    merchant: nullableTrimmedString,
    category: nullableTrimmedString,
    account: nullableTrimmedString,
    occurredAt: z.string().datetime({ offset: true }).nullable(),
    note: z.string().trim().max(500).nullable(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const aiOutputSchema = z
  .object({
    transactions: z.array(aiTransactionSchema).min(1).max(10),
    missingFields: z.array(z.string().trim().min(1).max(40)).max(30),
    needsConfirmation: z.literal(true),
  })
  .strict();

export const aiRequestSchema = z
  .object({
    transcript: z.string().trim().min(1).max(2000),
    locale: z.string().trim().min(2).max(35),
    timezone: z.string().trim().min(1).max(80),
    defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
    accounts: z.array(z.string().trim().min(1).max(80)).max(50),
    categories: z.array(z.string().trim().min(1).max(80)).max(100),
    referenceTime: z.string().datetime({ offset: true }),
  })
  .strict();

export type AiOutput = z.infer<typeof aiOutputSchema>;

export const transactionFormSchema = z.object({
  type: z.enum(['expense', 'income']),
  amount: z.string().trim().min(1, 'Enter an amount'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Choose a currency'),
  accountId: z.string().min(1, 'Choose an account'),
  categoryId: z.string().min(1, 'Choose a category'),
  merchant: z.string().trim().max(160),
  note: z.string().trim().max(500),
  occurredAt: z.string().datetime({ offset: true }),
});

export const profilePreferencesSchema = z.object({
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.string().trim().min(2).max(35),
  timezone: z.string().trim().min(1).max(80),
});
