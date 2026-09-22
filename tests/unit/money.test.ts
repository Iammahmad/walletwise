import { decimalToMinor, formatMoney, minorToDecimal, normalizeDecimalInput } from '@/src/domain/money';

describe('precise money conversion', () => {
  it('converts grouped PKR decimal strings without floating point arithmetic', () => {
    expect(decimalToMinor('1,250.50', 'PKR', 'en-PK')).toBe(125050);
    expect(minorToDecimal(125050, 'PKR')).toBe('1250.50');
  });

  it('supports zero and three minor-unit currencies', () => {
    expect(decimalToMinor('1250', 'JPY')).toBe(1250);
    expect(decimalToMinor('12.345', 'KWD')).toBe(12345);
    expect(() => decimalToMinor('12.5', 'JPY')).toThrow('at most 0 decimal places');
  });

  it('normalizes locale separators conservatively', () => {
    expect(normalizeDecimalInput('1.234,56', 'de-DE')).toBe('1234.56');
    expect(decimalToMinor('1.234,56', 'EUR', 'de-DE')).toBe(123456);
  });

  it('rejects invalid, zero, negative, and unsafe values', () => {
    expect(() => decimalToMinor('0', 'USD')).toThrow('greater than zero');
    expect(() => decimalToMinor('-3', 'USD')).toThrow('valid positive');
    expect(() => decimalToMinor('1.234', 'USD')).toThrow('at most 2');
    expect(() => decimalToMinor('999999999999999999', 'USD')).toThrow('too large');
  });

  it('formats using the requested currency instead of a hard-coded symbol', () => {
    expect(formatMoney(125000, 'PKR', 'en-PK')).toContain('1,250');
    expect(formatMoney(125000, 'USD', 'en-US')).toContain('$');
  });

  it('formats exact large and negative sub-unit values without floating-point conversion', () => {
    expect(formatMoney(9_007_199_254_740_001, 'PKR', 'en-US')).toContain('90,071,992,547,400.01');
    expect(formatMoney(-1, 'USD', 'en-US')).toBe('-$0.01');
  });

  it('formats zero without passing BigInt values to Intl', () => {
    const originalFormatToParts = Intl.NumberFormat.prototype.formatToParts;
    const formatToPartsSpy = jest
      .spyOn(Intl.NumberFormat.prototype, 'formatToParts')
      .mockImplementation(function formatToParts(this: Intl.NumberFormat, value) {
        if (typeof value === 'bigint') throw new TypeError('Cannot convert BigInt to number');
        return originalFormatToParts.call(this, value);
      });

    try {
      expect(formatMoney(0, 'PKR', 'en-PK')).toContain('0.00');
      expect(formatToPartsSpy).toHaveBeenCalled();
    } finally {
      formatToPartsSpy.mockRestore();
    }
  });

  it('preserves locale-specific Indian digit grouping', () => {
    expect(formatMoney(123456789, 'INR', 'en-IN')).toContain('12,34,567.89');
  });
});
