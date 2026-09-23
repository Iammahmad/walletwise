import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/src/components/Card";
import { DonutChart } from "@/src/components/DonutChart";
import { FeedbackState } from "@/src/components/FeedbackState";
import { Screen } from "@/src/components/Screen";
import { TransactionRow } from "@/src/components/TransactionRow";
import { getDashboardSummary, listTransactions } from "@/src/db/repository";
import { monthBounds, monthStartFor } from "@/src/domain/dates";
import { formatMoney } from "@/src/domain/money";
import type { DashboardSummary, Transaction } from "@/src/domain/types";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { getSavingsTotal } from "@/src/features/savings/repository";
import { useReloadable } from "@/src/hooks/useReloadable";
import { useAppStore } from "@/src/state/appStore";

interface HomeData {
  summary: DashboardSummary;
  recent: Transaction[];
  savingsMinor: number;
}
const EMPTY: HomeData = {
  summary: {
    spendingMinor: 0,
    incomeMinor: 0,
    budgetMinor: null,
    categoryTotals: [],
  },
  recent: [],
  savingsMinor: 0,
};

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const online = useAppStore((state) => state.isOnline);
  const loader = useCallback(async () => {
    const reference = new Date();
    const bounds = monthBounds(reference, profile.timezone);
    const monthStart = monthStartFor(reference, profile.timezone);
    const [summary, recent, savingsMinor] = await Promise.all([
      getDashboardSummary(bounds.start, bounds.end, monthStart),
      listTransactions({ limit: 5 }),
      getSavingsTotal(bounds.start, bounds.end),
    ]);
    return { summary, recent, savingsMinor };
  }, [profile.timezone]);
  const { data, loading, error, reload } = useReloadable(loader, EMPTY);
  const remaining =
    data.summary.budgetMinor == null
      ? null
      : data.summary.budgetMinor - data.summary.spendingMinor;
  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 18
        ? "Good afternoon"
        : "Good evening";
  const monthLabel = new Intl.DateTimeFormat(profile.locale, {
    month: "long",
    year: "numeric",
    timeZone: profile.timezone,
  }).format(new Date());
  const totalChart = Math.max(
    data.summary.categoryTotals.reduce(
      (sum, item) => sum + item.amountMinor,
      0,
    ),
    1,
  );
  return (
    <Screen
      title={greeting}
      subtitle={`${monthLabel} money snapshot`}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => router.push("/settings")}
          style={[styles.avatar, { backgroundColor: colors.primarySoft }]}
        >
          <Ionicons name="person-outline" size={20} color={colors.primary} />
        </Pressable>
      }
    >
      {!online ? (
        <Card style={{ backgroundColor: colors.warningSoft }}>
          <Text style={{ color: colors.warning }}>
            Offline — entries stay on this device and sync later.
          </Text>
        </Card>
      ) : null}
      {loading ? (
        <FeedbackState kind="loading" />
      ) : error ? (
        <FeedbackState
          kind="error"
          message={error}
          actionLabel="Try again"
          onAction={() => void reload()}
        />
      ) : (
        <>
          <Card
            style={[
              styles.hero,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
              Available after monthly spending
            </Text>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[styles.heroAmount, { color: colors.text }]}
            >
              {formatMoney(
                Math.max(
                  0,
                  data.summary.incomeMinor - data.summary.spendingMinor,
                ),
                profile.defaultCurrency,
                profile.locale,
              )}
            </Text>
            <View style={styles.metrics}>
              <Metric
                label="Spent"
                value={formatMoney(
                  data.summary.spendingMinor,
                  profile.defaultCurrency,
                  profile.locale,
                )}
                color={colors.expense}
              />
              <Metric
                label="Income"
                value={formatMoney(
                  data.summary.incomeMinor,
                  profile.defaultCurrency,
                  profile.locale,
                )}
                color={colors.income}
              />
              <Metric
                label="Budget left"
                value={
                  remaining == null
                    ? "Not set"
                    : formatMoney(
                        remaining,
                        profile.defaultCurrency,
                        profile.locale,
                      )
                }
                color={
                  remaining != null && remaining < 0
                    ? colors.expense
                    : colors.primary
                }
              />
            </View>
          </Card>
          <View style={styles.quickGrid}>
            <QuickAction
              icon="mic"
              label="Speak expense"
              onPress={() => router.push("/voice")}
            />
            <QuickAction
              icon="card-outline"
              label="Add manually"
              onPress={() => router.push("/(tabs)/add")}
            />
            <QuickAction
              icon="people-outline"
              label="New split"
              onPress={() => router.push("/split/new")}
            />
          </View>
          <SectionTitle
            title="Spending by category"
            action="Activity"
            onPress={() => router.push("/(tabs)/transactions")}
          />
          <Card style={styles.chartCard}>
            {data.summary.categoryTotals.length ? (
              <>
                <DonutChart
                  segments={data.summary.categoryTotals
                    .slice(0, 5)
                    .map((item) => ({
                      value: item.amountMinor,
                      color: item.color,
                    }))}
                  centerLabel={formatMoney(
                    data.summary.spendingMinor,
                    profile.defaultCurrency,
                    profile.locale,
                  )}
                />
                <View style={styles.legend}>
                  {data.summary.categoryTotals.slice(0, 5).map((item) => (
                    <View key={item.categoryId} style={styles.legendRow}>
                      <View
                        style={[styles.dot, { backgroundColor: item.color }]}
                      />
                      <Text
                        numberOfLines={1}
                        style={[styles.legendName, { color: colors.textMuted }]}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[styles.legendPercent, { color: colors.text }]}
                      >
                        {Math.round((item.amountMinor / totalChart) * 100)}%
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <FeedbackState
                kind="empty"
                message="Add an expense to see your spending chart."
              />
            )}
          </Card>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/savings")}
            style={[
              styles.savingsCard,
              {
                backgroundColor: colors.primarySoft,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[styles.savingsIcon, { backgroundColor: colors.primary }]}
            >
              <Ionicons
                name="wallet-outline"
                size={22}
                color={colors.background}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.savingsLabel, { color: colors.textMuted }]}>
                Savings logged this month
              </Text>
              <Text style={[styles.savingsValue, { color: colors.text }]}>
                {formatMoney(
                  data.savingsMinor,
                  profile.defaultCurrency,
                  profile.locale,
                )}
              </Text>
            </View>
            <Ionicons name="chevron-forward" color={colors.primary} size={20} />
          </Pressable>
          <SectionTitle
            title="Recent activity"
            action="See all"
            onPress={() => router.push("/(tabs)/transactions")}
          />
          <Card>
            {data.recent.length ? (
              data.recent.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  locale={profile.locale}
                  timezone={profile.timezone}
                  onPress={() =>
                    router.push({
                      pathname: "/transaction/[id]",
                      params: { id: transaction.id },
                    })
                  }
                />
              ))
            ) : (
              <FeedbackState
                kind="empty"
                message="Your first entry takes only a few seconds."
                actionLabel="Add expense"
                onAction={() => router.push("/(tabs)/add")}
              />
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: colors.background }]}>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text numberOfLines={1} style={[styles.metricValue, { color }]}>
        {value}
      </Text>
    </View>
  );
}
function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.quick,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={[styles.quickLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}
function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string;
  action: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        style={[styles.sectionTitle, { color: colors.text }]}
      >
        {title}
      </Text>
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text style={{ color: colors.primary, fontWeight: "700" }}>
          {action}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { padding: spacing.lg, borderWidth: 1 },
  heroLabel: { fontSize: 12, fontWeight: "700" },
  heroAmount: {
    fontSize: 33,
    lineHeight: 43,
    fontWeight: "900",
    marginVertical: spacing.xs,
  },
  metrics: { flexDirection: "row", gap: spacing.xs },
  metric: { flex: 1, padding: spacing.sm, borderRadius: radius.md },
  metricLabel: { fontSize: 9 },
  metricValue: { fontSize: 11, fontWeight: "800", marginTop: 5 },
  quickGrid: { flexDirection: "row", gap: spacing.xs },
  quick: {
    flex: 1,
    minHeight: 92,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    justifyContent: "space-between",
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 11, lineHeight: 15, fontWeight: "800" },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  chartCard: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  legend: { flex: 1, gap: spacing.xs },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { flex: 1, fontSize: 11 },
  legendPercent: { fontSize: 11, fontWeight: "800" },
  savingsCard: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  savingsIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  savingsLabel: { fontSize: 11 },
  savingsValue: { fontSize: 17, fontWeight: "900", marginTop: 3 },
});
