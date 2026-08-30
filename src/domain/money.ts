const MINOR_UNIT_DIGITS: Readonly<Record<string, number>> = {
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  CLP: 0,
  JPY: 0,
  KRW: 0,
  PKR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  INR: 2,
  AED: 2,
  SAR: 2,
  CAD: 2,
  AUD: 2,
};

export const SUPPORTED_CURRENCIES = [
  'PKR',
  'USD',
  'EUR',
  'GBP',
  'INR',
  'AED',
  'SAR',
  'CAD',
  'AUD',
  'JPY',
  'KWD',
] as const;

export function getMinorUnitDigits(currency: string): number {
  return MINOR_UNIT_DIGITS[currency.toUpperCase()] ?? 2;
}

export function normalizeDecimalInput(input: string, locale = 'en-US'): string {
  const trimmed = input.trim().replace(/\s+/g, '');
  if (!trimmed) return '';

  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.';
  const group = parts.find((part) => part.type === 'group')?.value ?? ',';
  let normalized = trimmed;
  if (group) normalized = normalized.split(group).join('');
  if (decimal !== '.') normalized = normalized.replace(decimal, '.');

  // English voice transcripts commonly use commas as grouping even when the UI locale differs.
  if (/^\d{1,3}(,\d{3})+(?:\.\d+)?$/.test(trimmed)) normalized = trimmed.replace(/,/g, '');
  return normalized;
}

export function decimalToMinor(input: string, currency: string, locale = 'en-US'): number {
  const normalized = normalizeDecimalInput(input, locale);
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error('Enter a valid positive amount.');

  const digits = getMinorUnitDigits(currency);
  const [whole = '0', fraction = ''] = normalized.split('.');
  if (fraction.length > digits) {
    throw new Error(`${currency.toUpperCase()} supports at most ${digits} decimal places.`);
  }
  const paddedFraction = fraction.padEnd(digits, '0');
  const scale = 10n ** BigInt(digits);
  const result = BigInt(whole) * scale + BigInt(paddedFraction || '0');
  if (result <= 0n) throw new Error('Amount must be greater than zero.');
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large.');
  return Number(result);
}

export function minorToDecimal(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor)) throw new Error('Money value must be a safe integer.');
  const digits = getMinorUnitDigits(currency);
  const negative = amountMinor < 0;
  const absolute = Math.abs(amountMinor).toString().padStart(digits + 1, '0');
  const whole = digits === 0 ? absolute : absolute.slice(0, -digits);
  const fraction = digits === 0 ? '' : absolute.slice(-digits);
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function formatMoney(amountMinor: number, currency: string, locale: string): string {
  const decimal = minorToDecimal(amountMinor, currency);
  const [wholePart = '0', fractionPart = ''] = decimal.replace('-', '').split('.');
  const digits = getMinorUnitDigits(currency);
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const positiveParts = formatter.formatToParts(BigInt(wholePart));
  const withExactFraction = (parts: Intl.NumberFormatPart[]) => parts.map((part) =>
    part.type === 'fraction' ? fractionPart.padEnd(digits, '0') : part.value,
  );
  if (!decimal.startsWith('-')) return withExactFraction(positiveParts).join('');

  // Preserve the locale's negative affixes, including for values between -1 and 0.
  const negativeTemplate = formatter.formatToParts(-1n);
  const numericTypes = new Set<Intl.NumberFormatPartTypes>(['integer', 'group', 'decimal', 'fraction']);
  const firstNumeric = negativeTemplate.findIndex((part) => numericTypes.has(part.type));
  let lastNumeric = negativeTemplate.length - 1;
  while (lastNumeric >= 0 && !numericTypes.has(negativeTemplate[lastNumeric]!.type)) lastNumeric -= 1;
  const firstPositiveNumeric = positiveParts.findIndex((part) => numericTypes.has(part.type));
  let lastPositiveNumeric = positiveParts.length - 1;
  while (lastPositiveNumeric >= 0 && !numericTypes.has(positiveParts[lastPositiveNumeric]!.type)) lastPositiveNumeric -= 1;
  const numericCore = withExactFraction(positiveParts.slice(firstPositiveNumeric, lastPositiveNumeric + 1));
  return [
    ...negativeTemplate.slice(0, firstNumeric).map((part) => part.value),
    ...numericCore,
    ...negativeTemplate.slice(lastNumeric + 1).map((part) => part.value),
  ].join('');
}
