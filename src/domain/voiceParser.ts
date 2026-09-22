import * as Crypto from "expo-crypto";

import { hasSpokenDateIntent, resolveSpokenDate } from "./dates";
import { extractEnglishSpokenNumber } from "./spokenNumbers";
import type { ParsedVoiceCommand, TransactionType, VoiceDraft } from "./types";
import { EN_CATEGORY_ALIASES, EN_CURRENCY_ALIASES } from "@/src/i18n/en";

export interface VoiceParserContext {
  defaultCurrency: string;
  locale?: string;
  timezone: string;
  accounts: string[];
  categories: string[];
  budgetCategories: string[];
  referenceTime?: Date;
}

function matchAlias(
  text: string,
  aliases: Readonly<Record<string, readonly string[]>>,
  allowed?: string[],
): string | null {
  const entries = Object.entries(aliases).filter(
    ([name]) =>
      !allowed ||
      allowed.some((item) => item.toLowerCase() === name.toLowerCase()),
  );
  for (const [name, terms] of entries) {
    if (
      terms.some((term) =>
        new RegExp(`\\b${term.replace(/\s+/g, "\\s+")}\\b`, "i").test(text),
      )
    )
      return name;
  }
  return null;
}

function matchCategory(text: string, categories: string[]): string | null {
  const alias = matchAlias(text, EN_CATEGORY_ALIASES, categories);
  if (alias) return alias;
  return (
    categories.find((name) =>
      new RegExp(
        `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`,
        "i",
      ).test(text),
    ) ?? null
  );
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

function extractBudget(
  text: string,
  budgetCategories: string[],
): string | null {
  const ordered = [...budgetCategories].sort(
    (left, right) => right.length - left.length,
  );
  return (
    ordered.find((name) => {
      const budget = escapePattern(name);
      return (
        new RegExp(
          `\\b(?:in|under|towards?|against)\\s+(?:the\\s+)?${budget}(?:\\s+budget)?\\b`,
          "i",
        ).test(text) ||
        new RegExp(`\\bbudget\\s+(?:called\\s+)?${budget}\\b`, "i").test(text)
      );
    }) ?? null
  );
}

function extractAmount(text: string): string | null {
  const candidates = [...text.matchAll(/\b\d[\d,]*(?:\.\d{1,3})?\b/g)].map(
    (match) => match[0],
  );
  const amount = candidates.find((candidate) => !/^20\d{2}$/.test(candidate));
  if (amount) return amount.replace(/,/g, "");
  const afterAmountCue = text.match(
    /\b(?:spent|paid|received|earned|salary|income|amount|costs?|got\s+paid)\b([\s\S]*)/i,
  )?.[1];
  if (!afterAmountCue) return null;
  const amountRegion =
    afterAmountCue.split(
      /\b(?:on|for|at|from|using|via|today|yesterday)\b/i,
    )[0] ?? "";
  return extractEnglishSpokenNumber(amountRegion);
}

function extractCurrency(text: string, fallback: string): string {
  return matchAlias(text, EN_CURRENCY_ALIASES) ?? fallback.toUpperCase();
}

function extractAccount(text: string, accounts: string[]): string | null {
  const explicit = text.match(
    /\b(?:from|using|via)\s+([\p{L}\d][\p{L}\d '-]{0,40}?)(?=\s+(?:today|yesterday|on|at|for)\b|[.,]|$)/iu,
  )?.[1];
  if (explicit) {
    const account = accounts.find(
      (name) => name.toLowerCase() === explicit.trim().toLowerCase(),
    );
    if (account) return account;
  }
  return (
    accounts.find((name) =>
      new RegExp(
        `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i",
      ).test(text),
    ) ?? null
  );
}

function extractMerchant(text: string): string | null {
  const match = text.match(
    /\bat\s+([\p{L}\d][\p{L}\d &'_-]{0,70}?)(?=\s+(?:today|yesterday|from|using|via)\b|[.,]|$)/iu,
  );
  return match?.[1]?.trim() || null;
}

function inferType(text: string): TransactionType {
  return /\b(received|receive|salary|income|earned|got paid|refund)\b/i.test(
    text,
  )
    ? "income"
    : "expense";
}

function splitTransactions(transcript: string): string[] {
  return transcript
    .split(/\s+(?:and|,\s*and)\s+(?=(?:(?:spent|paid|received|earned)\s+)?\d)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseDraft(
  segment: string,
  fullTranscript: string,
  context: VoiceParserContext,
): VoiceDraft {
  const type = inferType(`${fullTranscript} ${segment}`);
  const amount = extractAmount(segment);
  const currency = extractCurrency(fullTranscript, context.defaultCurrency);
  const category =
    matchCategory(segment, context.categories) ??
    (type === "income"
      ? (context.categories.find((name) => name.toLowerCase() === "income") ??
        null)
      : null);
  const budget =
    type === "expense"
      ? extractBudget(segment, context.budgetCategories)
      : null;
  const account = extractAccount(fullTranscript, context.accounts);
  const merchant = extractMerchant(segment);
  const referenceTime = context.referenceTime ?? new Date();
  const resolvedDate = resolveSpokenDate(
    fullTranscript,
    referenceTime,
    context.timezone,
    context.locale,
  );
  const occurredAt = resolvedDate ?? referenceTime.toISOString();
  const lowConfidenceFields = [
    ...(amount ? [] : ["amount"]),
    ...(category ? [] : ["category"]),
    ...(account ? [] : ["account"]),
    ...(/\bbudget\b/i.test(segment) && !budget ? ["budget"] : []),
    ...(hasSpokenDateIntent(fullTranscript) && !resolvedDate ? ["date"] : []),
  ];
  const confidence = Math.max(
    0.25,
    1 - lowConfidenceFields.length * 0.22 - (merchant ? 0 : 0.05),
  );
  return {
    id: Crypto.randomUUID(),
    type,
    amount,
    currency,
    merchant,
    category,
    budget,
    account,
    occurredAt,
    note: null,
    confidence,
    lowConfidenceFields,
    originalTranscript: fullTranscript,
  };
}

export function parseVoiceCommand(
  transcript: string,
  context: VoiceParserContext,
): ParsedVoiceCommand {
  const clean = transcript.trim();
  if (!clean)
    return {
      kind: "unknown",
      transcript,
      reason: "No transcript was captured.",
    };
  if (/^\s*(delete|remove|undo)\b/i.test(clean)) {
    const query = clean
      .replace(/^\s*(delete|remove|undo)\s+(?:the\s+)?/i, "")
      .trim();
    return { kind: "delete", query, confidence: query ? 0.72 : 0.35 };
  }
  const segments = splitTransactions(clean);
  const drafts = segments.map((segment) => parseDraft(segment, clean, context));
  if (!drafts.some((draft) => draft.amount)) {
    return {
      kind: "unknown",
      transcript: clean,
      reason:
        "I could not find an amount. You can complete the entry manually.",
    };
  }
  const missingFields = [
    ...new Set(drafts.flatMap((draft) => draft.lowConfidenceFields)),
  ];
  return { kind: "transactions", drafts, missingFields };
}
