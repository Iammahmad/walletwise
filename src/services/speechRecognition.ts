import { EN_CATEGORY_ALIASES, EN_CURRENCY_ALIASES } from '@/src/i18n/en';

export interface SpeechAlternative {
  confidence: number;
  transcript: string;
}

const ACTION_WORDS = /\b(spent|paid|received|earned|salary|delete|remove|expense|income)\b/i;
const AMOUNT = /\b\d[\d,.]*\b/;
const GOOGLE_RECOGNITION_SERVICES = [
  'com.google.android.googlequicksearchbox',
  'com.google.android.as',
  'com.google.android.tts',
] as const;
const ON_DEVICE_GOOGLE_SERVICE = 'com.google.android.as';
const NETWORK_GOOGLE_SERVICE = 'com.google.android.googlequicksearchbox';

function normalizeLocale(locale: string): string {
  return locale.trim().replace('_', '-').toLowerCase();
}

export function chooseSupportedSpeechLocale(preferredLocale: string, supportedLocales: readonly string[]): string {
  if (!supportedLocales.length) return preferredLocale;
  const preferred = normalizeLocale(preferredLocale);
  const exact = supportedLocales.find((locale) => normalizeLocale(locale) === preferred);
  if (exact) return exact;

  const language = preferred.split('-')[0];
  const sameLanguage = supportedLocales.filter((locale) => normalizeLocale(locale).split('-')[0] === language);
  if (sameLanguage.length) {
    const defaultDialect = sameLanguage.find((locale) => normalizeLocale(locale) === `${language}-us`);
    return defaultDialect ?? sameLanguage[0]!;
  }
  return preferredLocale.startsWith('en') ? 'en-US' : preferredLocale;
}

export function chooseAndroidRecognitionService(
  services: readonly string[],
  defaultService?: string,
  preferNetworkQuality = true,
): string | undefined {
  const preferredGoogleService = preferNetworkQuality ? NETWORK_GOOGLE_SERVICE : ON_DEVICE_GOOGLE_SERVICE;
  if (services.includes(preferredGoogleService)) return preferredGoogleService;
  if (defaultService && services.includes(defaultService)) {
    return defaultService;
  }
  return GOOGLE_RECOGNITION_SERVICES.find((service) => services.includes(service)) ?? defaultService;
}

export function buildSpeechVocabulary(accounts: readonly string[], categories: readonly string[], currency: string): string[] {
  const currencyTerms = EN_CURRENCY_ALIASES[currency.toUpperCase()] ?? [];
  const categoryTerms = Object.values(EN_CATEGORY_ALIASES).flat();
  return [...new Set([
    'I spent 1250 rupees on groceries',
    'Paid 600 for fuel yesterday from cash',
    'Spent 300 on lunch and 150 on coffee',
    'I received my salary today',
    'Delete the coffee expense',
    'spent',
    'paid',
    'received',
    'salary',
    'today',
    'yesterday',
    ...accounts,
    ...categories,
    ...currencyTerms,
    ...categoryTerms,
  ].map((value) => value.trim()).filter(Boolean))].slice(0, 100);
}

export function selectBestTranscript(
  alternatives: readonly SpeechAlternative[],
  vocabulary: readonly string[],
): string {
  const usable = alternatives.filter((alternative) => alternative.transcript.trim());
  if (!usable.length) return '';
  const normalizedVocabulary = vocabulary.map((word) => word.toLowerCase());

  let best = usable[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const alternative of usable) {
    const transcript = alternative.transcript.trim();
    const lower = transcript.toLowerCase();
    const confidenceScore = alternative.confidence >= 0 ? alternative.confidence * 50 : 0;
    const vocabularyMatches = normalizedVocabulary.reduce(
      (count, word) => count + (lower.includes(word) ? 1 : 0),
      0,
    );
    const score = confidenceScore
      + (ACTION_WORDS.test(transcript) ? 3 : 0)
      + (AMOUNT.test(transcript) ? 3 : 0)
      + Math.min(vocabularyMatches, 5) * 3;
    if (score > bestScore) {
      best = alternative;
      bestScore = score;
    }
  }
  return best.transcript.trim();
}
