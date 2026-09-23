import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { Transaction } from "@/src/domain/types";
import { minorToDecimal } from "@/src/domain/money";

function quote(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function transactionsToCsv(transactions: Transaction[]): string {
  const headers = [
    "id",
    "type",
    "amount",
    "currency",
    "merchant",
    "category",
    "budget_category",
    "account",
    "occurred_at",
    "note",
    "source",
    "original_transcript",
  ];
  const rows = transactions.map((transaction) =>
    [
      transaction.id,
      transaction.type,
      minorToDecimal(transaction.amountMinor, transaction.currency),
      transaction.currency,
      transaction.merchant,
      transaction.categoryName,
      transaction.budgetCategoryName,
      transaction.accountName,
      transaction.occurredAt,
      transaction.note,
      transaction.source,
      transaction.originalTranscript,
    ]
      .map(quote)
      .join(","),
  );
  return `\uFEFF${headers.join(",")}\r\n${rows.join("\r\n")}\r\n`;
}

export async function exportTransactionsCsv(
  transactions: Transaction[],
): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("File sharing is unavailable on this device.");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = new File(Paths.cache, `walletwise-transactions-${stamp}.csv`);
  file.create({ overwrite: true, intermediates: true });
  file.write(transactionsToCsv(transactions));
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "Export WalletWise transactions",
    UTI: "public.comma-separated-values-text",
  });
}
