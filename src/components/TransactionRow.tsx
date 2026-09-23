import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { formatDate } from "@/src/domain/dates";
import { formatMoney } from "@/src/domain/money";
import type { Transaction } from "@/src/domain/types";

interface Props {
  transaction: Transaction;
  locale: string;
  timezone: string;
  onPress?: () => void;
  showDivider?: boolean;
}

export function TransactionRow({
  transaction,
  locale,
  timezone,
  onPress,
  showDivider = false,
}: Props) {
  const { colors } = useTheme();
  const amountColor =
    transaction.type === "income" ? colors.income : colors.expense;
  const amountPrefix = transaction.type === "income" ? "+" : "−";
  const title =
    transaction.merchant || transaction.categoryName || "Transaction";
  const label = `${title}, ${amountPrefix}${formatMoney(transaction.amountMinor, transaction.currency, locale)}`;
  const metadata = [
    transaction.categoryName,
    formatDate(transaction.occurredAt, locale, timezone, {
      month: "short",
      day: "numeric",
    }),
    transaction.source,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        showDivider && {
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View
        style={[
          styles.icon,
          {
            backgroundColor: `${transaction.categoryColor ?? colors.primary}20`,
          },
        ]}
      >
        <Ionicons
          name={
            (transaction.categoryIcon ??
              "receipt-outline") as keyof typeof Ionicons.glyphMap
          }
          size={20}
          color={transaction.categoryColor ?? colors.primary}
        />
      </View>
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.meta, { color: colors.textMuted }]}
        >
          {metadata}
        </Text>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>
        {amountPrefix}
        {formatMoney(transaction.amountMinor, transaction.currency, locale)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "600" },
  meta: { fontSize: 12, marginTop: 3 },
  amount: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
