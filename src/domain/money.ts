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

const NUMERIC_PART_TYPES = new Set<Intl.NumberFormatPartTypes>([
  'integer',
  'group',
  'decimal',
  'fraction',
]);

function localizeDigits(value: string, digitMap: readonly string[]): string {
  return Array.from(value, (digit) => digitMap[Number(digit)] ?? digit).join('');
}

function formatExactInteger(wholePart: string, locale: string): {
  digitMap: readonly string[];
  value: string;
} {
  // Probe the locale with a small, safe number to discover its grouping pattern.
  // The actual money value remains a string and is never converted to a Number.
  const groupingFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  });
  const groupingParts = groupingFormatter.formatToParts(123456789);
  const integerPartLengths = groupingParts
    .filter((part) => part.type === 'integer')
    .map((part) => Array.from(part.value).length);
  const primaryGroupSize = integerPartLengths[integerPartLengths.length - 1] ?? 3;
  const secondaryGroupSize = integerPartLengths[integerPartLengths.length - 2] ?? primaryGroupSize;
  const groupSeparator = groupingParts.find((part) => part.type === 'group')?.value ?? ',';
  const digitFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: false,
  });
  const digitMap = Array.from({ length: 10 }, (_, digit) => digitFormatter.format(digit));

  const groups: string[] = [];
  let end = wholePart.length;
  let groupSize = primaryGroupSize;
  while (end > 0) {
    const start = Math.max(0, end - groupSize);
    groups.unshift(localizeDigits(wholePart.slice(start, end), digitMap));
    end = start;
    groupSize = secondaryGroupSize;
  }

  return { digitMap, value: groups.join(groupSeparator) };
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
  const isNegative = decimal.startsWith('-');
  // Hermes supports Intl, but some Android builds reject BigInt values passed to
  // formatToParts. Use a small Number only as an affix/decimal-symbol template.
  const template = formatter.formatToParts(isNegative ? -1 : 1);
  const { digitMap, value: localizedWholePart } = formatExactInteger(wholePart, locale);
  const decimalSeparator = template.find((part) => part.type === 'decimal')?.value ?? '.';
  const localizedFraction = localizeDigits(fractionPart.padEnd(digits, '0'), digitMap);
  const numericCore = `${localizedWholePart}${digits > 0 ? `${decimalSeparator}${localizedFraction}` : ''}`;

  const firstNumeric = template.findIndex((part) => NUMERIC_PART_TYPES.has(part.type));
  let lastNumeric = template.length - 1;
  while (lastNumeric >= 0 && !NUMERIC_PART_TYPES.has(template[lastNumeric]!.type)) lastNumeric -= 1;

  return [
    ...template.slice(0, firstNumeric).map((part) => part.value),
    numericCore,
    ...template.slice(lastNumeric + 1).map((part) => part.value),
  ].join('');
}
