import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { FeedbackState } from "@/src/components/FeedbackState";
import { Screen } from "@/src/components/Screen";
import { formatMoney } from "@/src/domain/money";
import { spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { deleteSplit, getSplit } from "@/src/features/splits/repository";
import { useReloadable } from "@/src/hooks/useReloadable";
import { getFirebaseAuth } from "@/src/services/firebase/config";
import { syncNow } from "@/src/services/sync";
import { useAppStore } from "@/src/state/appStore";

export default function SplitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const bump = useAppStore((state) => state.bumpDbRevision);
  const loader = useCallback(async () => (id ? getSplit(id) : null), [id]);
  const { data: split, loading, error, reload } = useReloadable(loader, null);
  if (loading)
    return (
      <Screen>
        <FeedbackState kind="loading" />
      </Screen>
    );
  if (error || !split)
    return (
      <Screen>
        <FeedbackState
          kind="error"
          message={error ?? "This split could not be found."}
          actionLabel="Try again"
          onAction={() => void reload()}
        />
      </Screen>
    );
  const owner = split.participants.find((item) => item.isOwner);
  const contacts = split.participants.filter((item) => !item.isOwner);
  const currentUserId = getFirebaseAuth()?.currentUser?.uid ?? null;
  const canDelete =
    !split.createdByUserId || split.createdByUserId === currentUserId;
  const remove = () =>
    Alert.alert(
      "Delete split?",
      "This removes the split for its participants. It never changes transactions, savings, or budgets.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteSplit(split.id)
              .then(async () => {
                if (currentUserId) await syncNow();
                bump();
                router.replace("/(tabs)/splits");
              })
              .catch(() =>
                Alert.alert(
                  "Could not delete",
                  "The split is still safely stored. Try again.",
                ),
              );
          },
        },
      ],
    );
  return (
    <Screen
      title={split.description}
      subtitle={`${split.splitType === "loan" ? "Loan" : "Equal split"} · ${new Date(split.occurredAt).toLocaleDateString(profile.locale)}`}
    >
      <Card style={[styles.hero, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Total</Text>
        <Text style={[styles.total, { color: colors.text }]}>
          {formatMoney(split.totalMinor, split.currency, profile.locale)}
        </Text>
        <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
          <Text style={{ color: colors.primary, fontWeight: "800" }}>
            {split.status}
          </Text>
        </View>
      </Card>
      <Card style={[styles.notice, { backgroundColor: colors.primarySoft }]}>
        <Ionicons
          name="shield-checkmark-outline"
          size={22}
          color={colors.primary}
        />
        <Text style={[styles.noticeText, { color: colors.textMuted }]}>
          This entry exists only in Splits. It is excluded from transactions,
          savings, and every budget calculation.
        </Text>
      </Card>
      <Text style={[styles.heading, { color: colors.text }]}>
        Who paid and who owes
      </Text>
      <Card>
        {split.participants.map((participant) => {
          const net = participant.paidMinor - participant.shareMinor;
          return (
            <Pressable
              key={participant.id}
              disabled={participant.isOwner || !participant.contactId}
              onPress={() =>
                participant.contactId &&
                router.push({
                  pathname: "/split/contact/[id]",
                  params: { id: participant.contactId },
                })
              }
              style={[styles.participant, { borderBottomColor: colors.border }]}
            >
              <View
                style={[styles.avatar, { backgroundColor: colors.primarySoft }]}
              >
                <Text style={{ color: colors.primary, fontWeight: "900" }}>
                  {participant.isOwner
                    ? "YO"
                    : participant.displayName.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>
                  {participant.displayName}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  Paid{" "}
                  {formatMoney(
                    participant.paidMinor,
                    split.currency,
                    profile.locale,
                  )}{" "}
                  · Share{" "}
                  {formatMoney(
                    participant.shareMinor,
                    split.currency,
                    profile.locale,
                  )}
                </Text>
              </View>
              <Text
                style={[
                  styles.net,
                  { color: net >= 0 ? colors.income : colors.expense },
                ]}
              >
                {net >= 0 ? "+" : "−"}
                {formatMoney(Math.abs(net), split.currency, profile.locale)}
              </Text>
            </Pressable>
          );
        })}
      </Card>
      {split.note ? (
        <Card>
          <Text style={[styles.label, { color: colors.textMuted }]}>Note</Text>
          <Text style={[styles.note, { color: colors.text }]}>
            {split.note}
          </Text>
        </Card>
      ) : null}
      {contacts[0]?.contactId ? (
        <Button
          label="Record a settlement"
          icon="checkmark-done-outline"
          onPress={() =>
            router.push({
              pathname: "/split/settle",
              params: {
                contactId: contacts[0]!.contactId!,
                splitId: split.id,
                currency: split.currency,
                balance: String(
                  contacts[0]!.shareMinor - contacts[0]!.paidMinor,
                ),
                name: contacts[0]!.displayName,
              },
            })
          }
        />
      ) : null}
      {canDelete ? (
        <Button
          label="Delete split"
          variant="danger"
          icon="trash-outline"
          onPress={remove}
        />
      ) : null}
      <Text style={[styles.audit, { color: colors.textMuted }]}>
        Created {new Date(split.createdAt).toLocaleString(profile.locale)} ·{" "}
        {split.syncStatus === "synced"
          ? "Synced with participants"
          : "Stored locally"}
        {owner ? "" : " · Owner unavailable"}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 6 },
  label: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  total: { fontSize: 31, fontWeight: "900" },
  badge: {
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  notice: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  heading: { fontSize: 17, fontWeight: "800" },
  participant: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 10, marginTop: 3 },
  net: { fontSize: 12, fontWeight: "900" },
  note: { marginTop: 5, fontSize: 14, lineHeight: 20 },
  audit: { fontSize: 10, lineHeight: 15, textAlign: "center" },
});
