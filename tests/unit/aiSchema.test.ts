import { aiOutputSchema } from '@/src/domain/schemas';

const valid = {
  transactions: [{ type: 'expense', amount: '1250.00', currency: 'PKR', merchant: 'Metro', category: 'Groceries', account: 'Cash', occurredAt: '2026-08-30T10:15:00.000Z', note: null, confidence: 0.94 }],
  missingFields: [],
  needsConfirmation: true,
};

describe('AI output contract', () => {
  it('accepts the exact structured contract', () => expect(aiOutputSchema.parse(valid)).toEqual(valid));
  it('allows unknown financial fields to be null', () => expect(aiOutputSchema.safeParse({ ...valid, transactions: [{ ...valid.transactions[0], amount: null, merchant: null, occurredAt: null }] }).success).toBe(true));
  it('rejects numbers in place of decimal strings', () => expect(aiOutputSchema.safeParse({ ...valid, transactions: [{ ...valid.transactions[0], amount: 1250 }] }).success).toBe(false));
  it('rejects unreviewed responses, bad confidence, and extra keys', () => {
    expect(aiOutputSchema.safeParse({ ...valid, needsConfirmation: false }).success).toBe(false);
    expect(aiOutputSchema.safeParse({ ...valid, transactions: [{ ...valid.transactions[0], confidence: 1.2 }] }).success).toBe(false);
    expect(aiOutputSchema.safeParse({ ...valid, rawModelText: 'do not trust me' }).success).toBe(false);
  });
});
