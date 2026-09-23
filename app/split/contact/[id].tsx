import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { FeedbackState } from "@/src/components/FeedbackState";
import { Screen } from "@/src/components/Screen";
import { formatMoney } from "@/src/domain/money";
import { spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import {
  listContactBalances,
  listSplits,
} from "@/src/features/splits/repository";
import { useReloadable } from "@/src/hooks/useReloadable";
import { useAppStore } from "@/src/state/appStore";

export default function ContactBalanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const loader = useCallback(async () => {
    const [balances, splits] = await Promise.all([
      listContactBalances(),
      listSplits(500),
    ]);
    return {
      balance: balances.find((item) => item.contact.id === id) ?? null,
      splits: splits.filter((item) =>
        item.participants.some((participant) => participant.contactId === id),
      ),
    };
  }, [id]);
  const { data, loading, error, reload } = useReloadable(loader, {
    balance: null,
    splits: [],
  });
  if (loading)
    return (
      <Screen>
        <FeedbackState kind="loading" />
      </Screen>
    );
  if (error || !data.balance)
    return (
      <Screen>
        <FeedbackState
          kind="error"
          message={error ?? "This friend could not be found."}
          actionLabel="Try again"
          onAction={() => void reload()}
        />
      </Screen>
    );
  const { contact, balanceMinor } = data.balance;
  return (
    <Screen title={contact.displayName}>
      <Card style={[styles.hero, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {balanceMinor >= 0
            ? `${contact.displayName} owes you`
            : "You owe them"}
        </Text>
        <Text
          style={[
            styles.amount,
            { color: balanceMinor >= 0 ? colors.income : colors.expense },
          ]}
        >
          {formatMoney(
            Math.abs(balanceMinor),
            profile.defaultCurrency,
            profile.locale,
          )}
        </Text>
      </Card>
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button
            label="Add split"
            variant="secondary"
            onPress={() => router.push("/split/new")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Settle up"
            disabled={balanceMinor === 0}
            onPress={() =>
              router.push({
                pathname: "/split/settle",
                params: {
                  contactId: contact.id,
                  currency: profile.defaultCurrency,
                  balance: String(balanceMinor),
                  name: contact.displayName,
                },
              })
            }
          />
        </View>
      </View>
      <Text style={[styles.heading, { color: colors.text }]}>
        Balance history
      </Text>
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
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>
                  {split.description}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {new Date(split.occurredAt).toLocaleDateString(
                    profile.locale,
                  )}{" "}
                  · {split.splitType}
                </Text>
              </View>
              <Text style={[styles.value, { color: colors.text }]}>
                {formatMoney(split.totalMinor, split.currency, profile.locale)}
              </Text>
            </Pressable>
          ))
        ) : (
          <FeedbackState
            kind="empty"
            message="No shared entries with this friend yet."
          />
        )}
      </Card>
    </Screen>
  );
}
const styles = StyleSheet.create({
  hero: { gap: spacing.xs },
  label: { fontSize: 12 },
  amount: { fontSize: 30, fontWeight: "900" },
  actions: { flexDirection: "row", gap: spacing.sm },
  heading: { fontSize: 18, fontWeight: "800" },
  row: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 11, marginTop: 3 },
  value: { fontSize: 12, fontWeight: "800" },
});
