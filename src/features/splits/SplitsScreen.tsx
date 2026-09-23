import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { FeedbackState } from "@/src/components/FeedbackState";
import { Screen } from "@/src/components/Screen";
import { formatMoney } from "@/src/domain/money";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { listContactBalances, listSplits } from "./repository";
import { useReloadable } from "@/src/hooks/useReloadable";
import { useAppStore } from "@/src/state/appStore";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function SplitsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const loader = useCallback(async () => {
    const [balances, splits] = await Promise.all([
      listContactBalances(),
      listSplits(5),
    ]);
    return { balances, splits };
  }, []);
  const { data, loading, error, reload } = useReloadable(loader, {
    balances: [],
    splits: [],
  });
  const owed = data.balances.reduce(
    (sum, item) => sum + Math.max(0, item.balanceMinor),
    0,
  );
  const owing = data.balances.reduce(
    (sum, item) => sum + Math.max(0, -item.balanceMinor),
    0,
  );

  return (
    <Screen
      title="Splits"
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add split"
          onPress={() => router.push("/split/new")}
          style={[styles.add, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={25} color={colors.background} />
        </Pressable>
      }
    >
      <Card
        style={[styles.balanceCard, { backgroundColor: colors.surfaceMuted }]}
      >
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
          Overall split balance
        </Text>
        <Text
          style={[
            styles.net,
            { color: owed - owing >= 0 ? colors.income : colors.expense },
          ]}
        >
          {owed - owing >= 0 ? "+" : "−"}{" "}
          {formatMoney(
            Math.abs(owed - owing),
            profile.defaultCurrency,
            profile.locale,
          )}
        </Text>
        <View style={styles.balanceGrid}>
          <View>
            <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
              You are owed
            </Text>
            <Text style={[styles.balanceValue, { color: colors.income }]}>
              {formatMoney(owed, profile.defaultCurrency, profile.locale)}
            </Text>
          </View>
          <View>
            <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
              You owe
            </Text>
            <Text style={[styles.balanceValue, { color: colors.expense }]}>
              {formatMoney(owing, profile.defaultCurrency, profile.locale)}
            </Text>
          </View>
        </View>
      </Card>
      <Button
        label="New split"
        icon="people-outline"
        onPress={() => router.push("/split/new")}
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
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Friends
            </Text>
            <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
              {data.balances.length} friends
            </Text>
          </View>
          <Card>
            {data.balances.length ? (
              data.balances.map(({ contact, balanceMinor, openSplitCount }) => (
                <Pressable
                  key={contact.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/split/contact/[id]",
                      params: { id: contact.id },
                    })
                  }
                  style={[styles.friend, { borderBottomColor: colors.border }]}
                >
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: colors.primarySoft },
                    ]}
                  >
                    <Text
                      style={[styles.avatarText, { color: colors.primary }]}
                    >
                      {initials(contact.displayName)}
                    </Text>
                  </View>
                  <View style={styles.friendCopy}>
                    <Text style={[styles.friendName, { color: colors.text }]}>
                      {contact.displayName}
                    </Text>
                    <Text
                      style={[styles.friendMeta, { color: colors.textMuted }]}
                    >
                      {openSplitCount} open{" "}
                      {openSplitCount === 1 ? "split" : "splits"}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.friendAmount,
                        {
                          color:
                            balanceMinor >= 0 ? colors.income : colors.expense,
                        },
                      ]}
                    >
                      {balanceMinor >= 0 ? "+" : "−"}
                      {formatMoney(
                        Math.abs(balanceMinor),
                        profile.defaultCurrency,
                        profile.locale,
                      )}
                    </Text>
                    <Text
                      style={[styles.friendStatus, { color: colors.textMuted }]}
                    >
                      {balanceMinor >= 0 ? "owes you" : "you owe"}
                    </Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <FeedbackState
                kind="empty"
                message="Add a friend while creating your first split."
                actionLabel="New split"
                onAction={() => router.push("/split/new")}
              />
            )}
          </Card>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent split activity
            </Text>
          </View>
          <Card>
            {data.splits.length ? (
              data.splits.map((split) => (
                <Pressable
                  key={split.id}
                  onPress={() =>
                    router.push({
                      pathname: "/split/[id]",
                      params: { id: split.id },
                    })
                  }
                  style={[
                    styles.splitRow,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.splitIcon,
                      { backgroundColor: colors.primarySoft },
                    ]}
                  >
                    <Ionicons
                      name={
                        split.splitType === "loan"
                          ? "hand-left-outline"
                          : "receipt-outline"
                      }
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.friendCopy}>
                    <Text style={[styles.friendName, { color: colors.text }]}>
                      {split.description}
                    </Text>
                    <Text
                      style={[styles.friendMeta, { color: colors.textMuted }]}
                    >
                      {split.splitType === "loan"
                        ? "Loan"
                        : `${split.participants.length} people`}{" "}
                      ·{" "}
                      {new Date(split.occurredAt).toLocaleDateString(
                        profile.locale,
                      )}
                    </Text>
                  </View>
                  <Text style={[styles.friendAmount, { color: colors.text }]}>
                    {formatMoney(
                      split.totalMinor,
                      split.currency,
                      profile.locale,
                    )}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                No split activity yet.
              </Text>
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
  balanceCard: { gap: spacing.xs },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  net: { fontSize: 30, fontWeight: "800" },
  balanceGrid: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.sm },
  balanceLabel: { fontSize: 11 },
  balanceValue: { fontSize: 14, fontWeight: "800", marginTop: 3 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  sectionMeta: { fontSize: 11 },
  friend: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 12, fontWeight: "900" },
  friendCopy: { flex: 1 },
  friendName: { fontSize: 14, fontWeight: "700" },
  friendMeta: { fontSize: 11, marginTop: 3 },
  friendAmount: { fontSize: 12, fontWeight: "800", textAlign: "right" },
  friendStatus: { fontSize: 9, marginTop: 2, textAlign: "right" },
  splitRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  splitIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { paddingVertical: spacing.xl, textAlign: "center" },
});
