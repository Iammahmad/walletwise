import { z } from "zod";

import type { BudgetCategoryInput, CategoryInput } from "./types";

const nullableTrimmedString = z.string().trim().max(160).nullable();

export const aiTransactionSchema = z
  .object({
    type: z.enum(["expense", "income"]),
    amount: z
      .string()
      .regex(/^\d+(?:\.\d+)?$/)
      .nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    merchant: nullableTrimmedString,
    category: nullableTrimmedString,
    budget: nullableTrimmedString,
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
    budgetCategories: z.array(z.string().trim().min(1).max(80)).max(100),
    referenceTime: z.string().datetime({ offset: true }),
  })
  .strict();

export type AiOutput = z.infer<typeof aiOutputSchema>;

export const transactionFormSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: z.string().trim().min(1, "Enter an amount"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Choose a currency"),
  accountId: z.string().min(1, "Choose an account"),
  categoryId: z.string().min(1, "Choose a category"),
  budgetCategoryId: z.string().nullable().optional(),
  merchant: z.string().trim().max(160),
  note: z.string().trim().max(500),
  occurredAt: z.string().datetime({ offset: true }),
});

export const profilePreferencesSchema = z.object({
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.string().trim().min(2).max(35),
  timezone: z.string().trim().min(1).max(80),
});

export const categoryInputSchema: z.ZodType<CategoryInput> = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a category name")
    .max(40, "Use 40 characters or fewer")
    .regex(
      /^[\p{L}\p{N}][\p{L}\p{N}\s&'_-]*$/u,
      "Use letters, numbers, spaces, &, apostrophes, hyphens, or underscores",
    ),
  icon: z.string().trim().min(1).max(64),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Choose a category color"),
  transactionType: z.enum(["expense", "income"]),
});

export const budgetCategoryInputSchema: z.ZodType<BudgetCategoryInput> =
  z.object({
    id: z.string().uuid().optional(),
    sourceCategoryId: z.string().uuid().nullable().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Enter a budget category name")
      .max(40, "Use 40 characters or fewer")
      .regex(
        /^[\p{L}\p{N}][\p{L}\p{N}\s&'_-]*$/u,
        "Use letters, numbers, spaces, &, apostrophes, hyphens, or underscores",
      ),
    icon: z.string().trim().min(1).max(64),
    color: z.string().regex(/^#[0-9A-F]{6}$/i, "Choose a category color"),
  });

export const savingInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Enter a savings label").max(80),
  amountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  occurredAt: z.string().datetime({ offset: true }),
  note: z.string().trim().max(500).nullable(),
  source: z.enum(["manual", "voice"]),
});

export const splitParticipantInputSchema = z.object({
  contactId: z.string().uuid().nullable().optional(),
  remoteUserId: z.string().trim().min(1).max(128).nullable().optional(),
  displayName: z.string().trim().min(1).max(80),
  isOwner: z.boolean(),
  shareMinor: z.number().int().nonnegative(),
  paidMinor: z.number().int().nonnegative(),
});

export const splitInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    description: z.string().trim().min(1, "Enter a description").max(160),
    splitType: z.enum(["equal", "loan"]),
    loanDirection: z.enum(["lent", "borrowed"]).nullable().optional(),
    totalMinor: z.number().int().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    occurredAt: z.string().datetime({ offset: true }),
    note: z.string().trim().max(500).nullable(),
    participants: z.array(splitParticipantInputSchema).min(2).max(50),
  })
  .superRefine((value, context) => {
    const ownerCount = value.participants.filter((item) => item.isOwner).length;
    if (ownerCount !== 1) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "A split must contain exactly one owner participant",
      });
    }
    if (value.splitType === "loan" && !value.loanDirection) {
      context.addIssue({
        code: "custom",
        path: ["loanDirection"],
        message: "Choose whether the money was lent or borrowed",
      });
    }
    const shares = value.participants.reduce(
      (sum, item) => sum + item.shareMinor,
      0,
    );
    const payments = value.participants.reduce(
      (sum, item) => sum + item.paidMinor,
      0,
    );
    if (shares !== value.totalMinor || payments !== value.totalMinor) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "Participant shares and payments must equal the split total",
      });
    }
  });

export const splitInviteTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{24,128}$/, "This invitation link is invalid");
