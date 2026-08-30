import * as Crypto from 'expo-crypto';

import { resolveSpokenDate } from './dates';
import type { ParsedVoiceCommand, TransactionType, VoiceDraft } from './types';
import { EN_CATEGORY_ALIASES, EN_CURRENCY_ALIASES } from '@/src/i18n/en';

export interface VoiceParserContext {
  defaultCurrency: string;
  timezone: string;
  accounts: string[];
  categories: string[];
  referenceTime?: Date;
}

function matchAlias(text: string, aliases: Readonly<Record<string, readonly string[]>>, allowed?: string[]): string | null {
  const entries = Object.entries(aliases).filter(([name]) => !allowed || allowed.some((item) => item.toLowerCase() === name.toLowerCase()));
  for (const [name, terms] of entries) {
    if (terms.some((term) => new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text))) return name;
  }
  return null;
}

function extractAmount(text: string): string | null {
  const candidates = [...text.matchAll(/\b\d[\d,]*(?:\.\d{1,3})?\b/g)].map((match) => match[0]);
  const amount = candidates.find((candidate) => !/^20\d{2}$/.test(candidate));
  return amount?.replace(/,/g, '') ?? null;
}

function extractCurrency(text: string, fallback: string): string {
  return matchAlias(text, EN_CURRENCY_ALIASES) ?? fallback.toUpperCase();
}

function extractAccount(text: string, accounts: string[]): string | null {
  const explicit = text.match(/\b(?:from|using|via)\s+([\p{L}\d][\p{L}\d '-]{0,40}?)(?=\s+(?:today|yesterday|on|at|for)\b|[.,]|$)/iu)?.[1];
  if (explicit) {
    const account = accounts.find((name) => name.toLowerCase() === explicit.trim().toLowerCase());
    if (account) return account;
  }
  return accounts.find((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) ?? null;
}

function extractMerchant(text: string): string | null {
  const match = text.match(/\bat\s+([\p{L}\d][\p{L}\d &'_-]{0,70}?)(?=\s+(?:today|yesterday|from|using|via)\b|[.,]|$)/iu);
  return match?.[1]?.trim() || null;
}

function inferType(text: string): TransactionType {
  return /\b(received|receive|salary|income|earned|got paid|refund)\b/i.test(text) ? 'income' : 'expense';
}

function splitTransactions(transcript: string): string[] {
  return transcript
    .split(/\s+(?:and|,\s*and)\s+(?=(?:(?:spent|paid|received|earned)\s+)?\d)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseDraft(segment: string, fullTranscript: string, context: VoiceParserContext): VoiceDraft {
  const type = inferType(`${fullTranscript} ${segment}`);
  const amount = extractAmount(segment);
  const currency = extractCurrency(fullTranscript, context.defaultCurrency);
  const category =
    matchAlias(segment, EN_CATEGORY_ALIASES, context.categories) ??
    (type === 'income' ? context.categories.find((name) => name.toLowerCase() === 'income') ?? null : null);
  const account = extractAccount(fullTranscript, context.accounts);
  const merchant = extractMerchant(segment);
  const occurredAt = resolveSpokenDate(fullTranscript, context.referenceTime ?? new Date(), context.timezone) ??
    (context.referenceTime ?? new Date()).toISOString();
  const lowConfidenceFields = [
    ...(amount ? [] : ['amount']),
    ...(category ? [] : ['category']),
    ...(account ? [] : ['account']),
  ];
  const confidence = Math.max(0.25, 1 - lowConfidenceFields.length * 0.22 - (merchant ? 0 : 0.05));
  return {
    id: Crypto.randomUUID(),
    type,
    amount,
    currency,
    merchant,
    category,
    account,
    occurredAt,
    note: null,
    confidence,
    lowConfidenceFields,
    originalTranscript: fullTranscript,
  };
}

export function parseVoiceCommand(transcript: string, context: VoiceParserContext): ParsedVoiceCommand {
  const clean = transcript.trim();
  if (!clean) return { kind: 'unknown', transcript, reason: 'No transcript was captured.' };
  if (/^\s*(delete|remove|undo)\b/i.test(clean)) {
    const query = clean.replace(/^\s*(delete|remove|undo)\s+(?:the\s+)?/i, '').trim();
    return { kind: 'delete', query, confidence: query ? 0.72 : 0.35 };
  }
  const segments = splitTransactions(clean);
  const drafts = segments.map((segment) => parseDraft(segment, clean, context));
  if (!drafts.some((draft) => draft.amount)) {
    return { kind: 'unknown', transcript: clean, reason: 'I could not find an amount. You can complete the entry manually.' };
  }
  const missingFields = [...new Set(drafts.flatMap((draft) => draft.lowConfidenceFields))];
  return { kind: 'transactions', drafts, missingFields };
}
