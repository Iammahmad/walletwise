import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/src/components/Card";
import { DonutChart } from "@/src/components/DonutChart";
import { FeedbackState } from "@/src/components/FeedbackState";
import { Screen } from "@/src/components/Screen";
import { spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { formatMoney } from "@/src/domain/money";
import type { SavingEntry } from "@/src/domain/types";
import {
  getSavingsTotals,
  listSavings,
} from "@/src/features/savings/repository";
import { useReloadable } from "@/src/hooks/useReloadable";
import { useAppStore } from "@/src/state/appStore";

interface MonthGroup {
  key: string;
  label: string;
  entries: SavingEntry[];
  totals: Record<string, number>;
}

function monthKey(value: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: timezone,
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  return `${year}-${month}`;
}

export default function SavingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const loader = useCallback(async () => {
    const [entries, totals] = await Promise.all([
      listSavings(),
      getSavingsTotals(),
    ]);
    return { entries, totals };
  }, []);
  const { data, loading, error, reload } = useReloadable(loader, {
    entries: [],
    totals: {},
  });
  const months = useMemo<MonthGroup[]>(() => {
    const grouped = new Map<string, MonthGroup>();
    for (const entry of data.entries) {
      const key = monthKey(entry.occurredAt, profile.timezone);
      const existing = grouped.get(key) ?? {
        key,
        label: new Intl.DateTimeFormat(profile.locale, {
          month: "long",
          year: "numeric",
          timeZone: profile.timezone,
        }).format(new Date(entry.occurredAt)),
        entries: [],
        totals: {},
      };
      existing.entries.push(entry);
      existing.totals[entry.currency] =
        (existing.totals[entry.currency] ?? 0) + entry.amountMinor;
      grouped.set(key, existing);
    }
    return [...grouped.values()].sort((left, right) =>
      right.key.localeCompare(left.key),
    );
  }, [data.entries, profile.locale, profile.timezone]);
  const chartColors = [
    colors.primary,
    colors.income,
    colors.info,
    colors.warning,
    "#D977FF",
  ];
  const defaultTotal = data.totals[profile.defaultCurrency] ?? 0;

  return (
    <Screen
      title="Savings"
      subtitle="Your complete savings history, organized by month."
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add savings"
          onPress={() => router.push("/savings/add")}
          style={[styles.add, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={24} color={colors.background} />
        </Pressable>
      }
    >
      {loading ? (
        <FeedbackState kind="loading" />
      ) : error ? (
        <FeedbackState
          kind="error"
          message={error}
          actionLabel="Try again"
          onAction={() => void reload()}
        />
      ) : !data.entries.length ? (
        <FeedbackState
          kind="empty"
          title="No savings yet"
          message="Your savings totals and monthly history will appear here."
          actionLabel="Log savings"
          onAction={() => router.push("/savings/add")}
        />
      ) : (
        <>
          <Card style={styles.hero}>
            <DonutChart
              segments={months
                .map((month, index) => ({
                  value: month.totals[profile.defaultCurrency] ?? 0,
                  color: chartColors[index % chartColors.length]!,
                }))
                .filter((segment) => segment.value > 0)}
              centerLabel={formatMoney(
                defaultTotal,
                profile.defaultCurrency,
                profile.locale,
              )}
            />
            <View style={styles.heroCopy}>
              <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
                Total savings
              </Text>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                numberOfLines={1}
                style={[styles.heroValue, { color: colors.text }]}
              >
                {formatMoney(
                  defaultTotal,
                  profile.defaultCurrency,
                  profile.locale,
                )}
              </Text>
              {Object.entries(data.totals)
                .filter(([currency]) => currency !== profile.defaultCurrency)
                .map(([currency, total]) => (
                  <Text
                    key={currency}
                    style={[styles.otherTotal, { color: colors.textMuted }]}
                  >
                    {formatMoney(total, currency, profile.locale)}
                  </Text>
                ))}
            </View>
          </Card>
          <Text style={[styles.heading, { color: colors.text }]}>
            Savings by month
          </Text>
          {months.map((month) => (
            <View key={month.key} style={styles.monthSection}>
              <View style={styles.monthHeader}>
                <Text style={[styles.monthTitle, { color: colors.text }]}>
                  {month.label}
                </Text>
                <View style={styles.monthTotals}>
                  {Object.entries(month.totals).map(([currency, total]) => (
                    <Text
                      key={currency}
                      style={[styles.monthTotal, { color: colors.primary }]}
                    >
                      {formatMoney(total, currency, profile.locale)}
                    </Text>
                  ))}
                </View>
              </View>
              <Card>
                {month.entries.map((entry) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${entry.name}`}
                    onPress={() =>
                      router.push({
                        pathname: "/savings/[id]",
                        params: { id: entry.id },
                      })
                    }
                    key={entry.id}
                    style={[styles.row, { borderBottomColor: colors.border }]}
                  >
                    <View
                      style={[
                        styles.icon,
                        { backgroundColor: colors.primarySoft },
                      ]}
                    >
                      <Ionicons
                        name="wallet-outline"
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>
                        {entry.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[styles.rowMeta, { color: colors.textMuted }]}
                      >
                        {new Intl.DateTimeFormat(profile.locale, {
                          day: "numeric",
                          month: "short",
                          timeZone: profile.timezone,
                        }).format(new Date(entry.occurredAt))}
                        {entry.note ? ` · ${entry.note}` : ""}
                      </Text>
                    </View>
                    <Text style={[styles.amount, { color: colors.income }]}>
                      {formatMoney(
                        entry.amountMinor,
                        entry.currency,
                        profile.locale,
                      )}
                    </Text>
                  </Pressable>
                ))}
              </Card>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  add: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  heroCopy: { flex: 1, minWidth: 0, gap: 5 },
  heroLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  heroValue: { fontSize: 24, fontWeight: "900" },
  otherTotal: { fontSize: 12, fontWeight: "700" },
  heading: { fontSize: 18, fontWeight: "800", marginTop: spacing.sm },
  monthSection: { gap: spacing.xs },
  monthHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  monthTitle: { flex: 1, fontSize: 16, fontWeight: "800" },
  monthTotals: { alignItems: "flex-end" },
  monthTotal: { fontSize: 12, fontWeight: "800" },
  row: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: "700" },
  rowMeta: { marginTop: 3, fontSize: 11 },
  amount: { fontSize: 13, fontWeight: "800" },
});
