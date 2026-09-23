import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/src/components/Card";
import { IconButton } from "@/src/components/IconButton";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { formatMoney } from "@/src/domain/money";
import type { BudgetProgress } from "@/src/domain/types";
import { useAppStore } from "@/src/state/appStore";

interface Props {
  progress: BudgetProgress;
  onOpen?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function BudgetProgressCard({
  progress,
  onOpen,
  onEdit,
  onDelete,
}: Props) {
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const { budget, spentMinor, remainingMinor } = progress;
  const overBudget = remainingMinor < 0;
  const ratio = budget.amountMinor > 0 ? spentMinor / budget.amountMinor : 0;
  const percentage = Math.round(ratio * 100);
  const barWidth =
    `${Math.min(Math.max(ratio * 100, 0), 100)}%` as `${number}%`;
  const title = budget.budgetCategoryName ?? "Archived budget category";
  const icon = (budget.budgetCategoryIcon ??
    "pie-chart-outline") as keyof typeof Ionicons.glyphMap;
  const accent = overBudget
    ? colors.danger
    : (budget.budgetCategoryColor ?? colors.primary);

  return (
    <Card>
      <Pressable
        accessibilityRole={onOpen ? "button" : undefined}
        accessibilityLabel={
          onOpen ? `View transactions in ${title}` : undefined
        }
        disabled={!onOpen}
        onPress={onOpen}
        style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
      >
        <View style={styles.cardHeading}>
          <View style={[styles.icon, { backgroundColor: `${accent}20` }]}>
            <Ionicons name={icon} size={22} color={accent} />
          </View>
          <View style={styles.headingText}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {title}
            </Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {formatMoney(spentMinor, budget.currency, profile.locale)} spent
              of{" "}
              {formatMoney(budget.amountMinor, budget.currency, profile.locale)}
            </Text>
          </View>
          {onOpen ? (
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          ) : null}
        </View>
        <View style={styles.remainingRow}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.remainingAmount, { color: accent }]}
          >
            {formatMoney(
              Math.abs(remainingMinor),
              budget.currency,
              profile.locale,
            )}
          </Text>
          <Text
            style={[
              styles.remainingLabel,
              { color: overBudget ? colors.danger : colors.textMuted },
            ]}
          >
            {overBudget ? "over budget" : "left"}
          </Text>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${title}: ${percentage} percent used`}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.min(Math.max(percentage, 0), 100),
          }}
          style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
        >
          <View
            style={[styles.fill, { backgroundColor: accent, width: barWidth }]}
          />
        </View>
      </Pressable>
      <View style={styles.cardActions}>
        <IconButton
          icon="create-outline"
          label={`Edit ${title}`}
          onPress={onEdit}
        />
        <IconButton
          icon="trash-outline"
          label={`Delete ${title}`}
          danger
          onPress={onDelete}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headingText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  remainingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  remainingAmount: {
    flexShrink: 1,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  remainingLabel: { fontSize: 13, fontWeight: "600" },
  track: {
    height: 10,
    borderRadius: radius.pill,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  fill: { height: "100%", borderRadius: radius.pill },
  cardActions: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
});
