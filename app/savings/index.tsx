import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/src/components/Card";
import { DonutChart } from "@/src/components/DonutChart";
import { FeedbackState } from "@/src/components/FeedbackState";
import { MonthNavigator } from "@/src/components/MonthNavigator";
import { Screen } from "@/src/components/Screen";
import { monthBounds, monthStartFor } from "@/src/domain/dates";
import { formatMoney } from "@/src/domain/money";
import { spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import {
  getSavingsTotal,
  listSavings,
} from "@/src/features/savings/repository";
import { useReloadable } from "@/src/hooks/useReloadable";
import { useAppStore } from "@/src/state/appStore";

export default function SavingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const currentMonth = monthStartFor(new Date(), profile.timezone);
  const [month, setMonth] = useState(() => currentMonth);
  const loader = useCallback(async () => {
    const bounds = monthBounds(new Date(`${month}T12:00:00`), profile.timezone);
    const [entries, total] = await Promise.all([
      listSavings({ dateFrom: bounds.start, dateTo: bounds.end }),
      getSavingsTotal(bounds.start, bounds.end),
    ]);
    return { entries, total };
  }, [month, profile.timezone]);
  const { data, loading, error, reload } = useReloadable(loader, {
    entries: [],
    total: 0,
  });
  const groups = data.entries.reduce<Record<string, number>>((result, item) => {
    result[item.name] = (result[item.name] ?? 0) + item.amountMinor;
    return result;
  }, {});
  const chartColors = [
    colors.primary,
    colors.income,
    colors.info,
    colors.warning,
    "#D977FF",
  ];
  return (
    <Screen
      title="Savings"
      subtitle="Logged separately from income and spending."
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
      <MonthNavigator
        monthStart={month}
        currentMonthStart={currentMonth}
        locale={profile.locale}
        onChange={setMonth}
      />
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
          <Card style={styles.hero}>
            <DonutChart
              segments={Object.values(groups).map((value, index) => ({
                value,
                color: chartColors[index % chartColors.length]!,
              }))}
              centerLabel={formatMoney(
                data.total,
                profile.defaultCurrency,
                profile.locale,
              )}
            />
            <View style={styles.heroCopy}>
              <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
                Saved this month
              </Text>
              <Text style={[styles.heroValue, { color: colors.text }]}>
                {formatMoney(
                  data.total,
                  profile.defaultCurrency,
                  profile.locale,
                )}
              </Text>
              <Text style={[styles.heroNote, { color: colors.textMuted }]}>
                Savings never alter transaction or budget totals.
              </Text>
            </View>
          </Card>
          <Text style={[styles.heading, { color: colors.text }]}>
            Savings history
          </Text>
          <Card>
            {data.entries.length ? (
              data.entries.map((entry) => (
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
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                      {new Date(entry.occurredAt).toLocaleDateString(
                        profile.locale,
                      )}
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
              ))
            ) : (
              <FeedbackState
                kind="empty"
                message="No savings logged for this month."
                actionLabel="Log savings"
                onAction={() => router.push("/savings/add")}
              />
            )}
          </Card>
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
  heroCopy: { flex: 1, gap: 5 },
  heroLabel: { fontSize: 12 },
  heroValue: { fontSize: 22, fontWeight: "800" },
  heroNote: { fontSize: 11, lineHeight: 16 },
  heading: { fontSize: 18, fontWeight: "800", marginTop: spacing.sm },
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
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "700" },
  rowMeta: { marginTop: 3, fontSize: 11 },
  amount: { fontSize: 13, fontWeight: "800" },
});
