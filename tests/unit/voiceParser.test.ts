import { parseVoiceCommand } from '@/src/domain/voiceParser';

const context = {
  defaultCurrency: 'PKR',
  timezone: 'Asia/Karachi',
  accounts: ['Cash', 'Bank'],
  categories: ['Food', 'Groceries', 'Transport', 'Fuel', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Rent', 'Travel', 'Other', 'Income'],
  referenceTime: new Date('2026-08-30T10:15:00.000Z'),
};

describe('deterministic English voice parser', () => {
  it('parses amount, currency, groceries, merchant, and today', () => {
    const result = parseVoiceCommand('I spent 1,250 rupees on groceries at Metro today.', context);
    expect(result.kind).toBe('transactions');
    if (result.kind !== 'transactions') return;
    expect(result.drafts[0]).toMatchObject({ type: 'expense', amount: '1250', currency: 'PKR', category: 'Groceries', merchant: 'Metro', occurredAt: context.referenceTime.toISOString() });
  });

  it('parses fuel, yesterday, and Cash account', () => {
    const result = parseVoiceCommand('Paid 600 for fuel yesterday from cash.', context);
    expect(result.kind).toBe('transactions');
    if (result.kind !== 'transactions') return;
    expect(result.drafts[0]).toMatchObject({ amount: '600', category: 'Fuel', account: 'Cash', occurredAt: '2026-08-29T10:15:00.000Z' });
  });

  it('creates multiple drafts from one sentence', () => {
    const result = parseVoiceCommand('Spent 300 on lunch and 150 on coffee.', context);
    expect(result.kind).toBe('transactions');
    if (result.kind !== 'transactions') return;
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts.map((item) => [item.amount, item.category])).toEqual([['300', 'Food'], ['150', 'Food']]);
  });

  it('recognizes income and salary', () => {
    const result = parseVoiceCommand('I received my salary of 120,000 rupees today.', context);
    expect(result.kind).toBe('transactions');
    if (result.kind !== 'transactions') return;
    expect(result.drafts[0]).toMatchObject({ type: 'income', amount: '120000', currency: 'PKR', category: 'Income' });
  });

  it('returns a reviewed delete command rather than mutating data', () => {
    expect(parseVoiceCommand('Delete the coffee expense I added a minute ago.', context)).toMatchObject({ kind: 'delete', query: expect.stringContaining('coffee') });
  });

  it('preserves an unparsed transcript for manual completion', () => {
    expect(parseVoiceCommand('Something about lunch', context)).toEqual({ kind: 'unknown', transcript: 'Something about lunch', reason: expect.any(String) });
  });
});
