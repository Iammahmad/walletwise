import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { ConfirmationDialog } from "@/src/components/ConfirmationDialog";
import { FeedbackState } from "@/src/components/FeedbackState";
import { Screen } from "@/src/components/Screen";
import { spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { formatMoney } from "@/src/domain/money";
import type { SplitParticipant, SplitSettlement } from "@/src/domain/types";
import {
  deleteSplit,
  getSplit,
  listSplitSettlements,
} from "@/src/features/splits/repository";
import { useReloadable } from "@/src/hooks/useReloadable";
import { normalizeError } from "@/src/services/errors";
import { getFirebaseAuth } from "@/src/services/firebase/config";
import { syncNow } from "@/src/services/sync";
import { useAppStore } from "@/src/state/appStore";

function settlementAdjustment(settlements: SplitSettlement[]): number {
  return settlements.reduce(
    (sum, item) =>
      sum +
      (item.direction === "received" ? -item.amountMinor : item.amountMinor),
    0,
  );
}

export default function SplitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const bump = useAppStore((state) => state.bumpDbRevision);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const loader = useCallback(async () => {
    if (!id) return null;
    const [split, settlements] = await Promise.all([
      getSplit(id),
      listSplitSettlements(id),
    ]);
    return split ? { split, settlements } : null;
  }, [id]);
  const { data, loading, error, reload } = useReloadable(loader, null);
  const settlementsByContact = useMemo(() => {
    const grouped = new Map<string, SplitSettlement[]>();
    for (const settlement of data?.settlements ?? []) {
      grouped.set(settlement.contactId, [
        ...(grouped.get(settlement.contactId) ?? []),
        settlement,
      ]);
    }
    return grouped;
  }, [data?.settlements]);

  if (loading)
    return (
      <Screen>
        <FeedbackState kind="loading" />
      </Screen>
    );
  if (error || !data)
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

  const { split, settlements } = data;
  const contacts = split.participants.filter((item) => !item.isOwner);
  const contactOutstanding = new Map(
    contacts.map((participant) => [
      participant.id,
      participant.shareMinor -
        participant.paidMinor +
        settlementAdjustment(
          participant.contactId
            ? (settlementsByContact.get(participant.contactId) ?? [])
            : [],
        ),
    ]),
  );
  const contactBalanceTotal = [...contactOutstanding.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  const currentUserId = getFirebaseAuth()?.currentUser?.uid ?? null;
  const canDelete =
    !split.createdByUserId || split.createdByUserId === currentUserId;

  const participantDisplay = (participant: SplitParticipant) => {
    if (participant.isOwner) {
      const settlementPaid = settlements
        .filter((item) => item.direction === "paid")
        .reduce((sum, item) => sum + item.amountMinor, 0);
      return {
        paid: participant.paidMinor + settlementPaid,
        owes: Math.max(0, -contactBalanceTotal),
        net: contactBalanceTotal,
      };
    }
    const contactSettlements = participant.contactId
      ? (settlementsByContact.get(participant.contactId) ?? [])
      : [];
    const settlementPaid = contactSettlements
      .filter((item) => item.direction === "received")
      .reduce((sum, item) => sum + item.amountMinor, 0);
    const outstanding = contactOutstanding.get(participant.id) ?? 0;
    return {
      paid: participant.paidMinor + settlementPaid,
      owes: Math.max(0, outstanding),
      net: -outstanding,
    };
  };

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSplit(split.id);
      if (currentUserId) await syncNow();
      bump();
      setShowDelete(false);
      router.replace("/(tabs)/splits");
    } catch (caught) {
      setDeleteError(normalizeError(caught).message);
      setDeleting(false);
      setShowDelete(false);
    }
  };

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
            {split.status === "settled" ? "Settled" : "Open"}
          </Text>
        </View>
      </Card>
      <Text style={[styles.heading, { color: colors.text }]}>
        Who paid and who owes
      </Text>
      <Card>
        {split.participants.map((participant) => {
          const display = participantDisplay(participant);
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
                  {formatMoney(display.paid, split.currency, profile.locale)} ·
                  Owe{" "}
                  {formatMoney(display.owes, split.currency, profile.locale)}
                </Text>
              </View>
              <Text
                style={[
                  styles.net,
                  { color: display.net >= 0 ? colors.income : colors.expense },
                ]}
              >
                {display.net >= 0 ? "+" : "−"}
                {formatMoney(
                  Math.abs(display.net),
                  split.currency,
                  profile.locale,
                )}
              </Text>
            </Pressable>
          );
        })}
      </Card>
      {contacts.map((contact) => {
        const balance = contactOutstanding.get(contact.id) ?? 0;
        return contact.contactId && balance !== 0 ? (
          <Button
            key={contact.id}
            label={`Record settlement · ${contact.displayName}`}
            icon="checkmark-done-outline"
            onPress={() =>
              router.push({
                pathname: "/split/settle",
                params: {
                  contactId: contact.contactId!,
                  splitId: split.id,
                  currency: split.currency,
                  balance: String(balance),
                  name: contact.displayName,
                },
              })
            }
          />
        ) : null;
      })}
      {settlements.length ? (
        <>
          <Text style={[styles.heading, { color: colors.text }]}>
            Settlement history
          </Text>
          <Card>
            {settlements.map((settlement) => {
              const contact = contacts.find(
                (item) => item.contactId === settlement.contactId,
              );
              return (
                <View
                  key={settlement.id}
                  style={[
                    styles.historyRow,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.text }]}>
                      {settlement.direction === "received"
                        ? `${contact?.displayName ?? "Friend"} paid you`
                        : `You paid ${contact?.displayName ?? "friend"}`}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {new Date(settlement.occurredAt).toLocaleDateString(
                        profile.locale,
                      )}
                      {settlement.note ? ` · ${settlement.note}` : ""}
                    </Text>
                  </View>
                  <Text
                    style={[styles.historyAmount, { color: colors.primary }]}
                  >
                    {formatMoney(
                      settlement.amountMinor,
                      settlement.currency,
                      profile.locale,
                    )}
                  </Text>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}
      {split.note ? (
        <Card>
          <Text style={[styles.label, { color: colors.textMuted }]}>Note</Text>
          <Text style={[styles.note, { color: colors.text }]}>
            {" "}
            {split.note}
          </Text>
        </Card>
      ) : null}
      {deleteError ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {deleteError}
        </Text>
      ) : null}
      {canDelete ? (
        <Button
          label="Delete split"
          variant="danger"
          icon="trash-outline"
          onPress={() => {
            setDeleteError(null);
            setShowDelete(true);
          }}
        />
      ) : null}
      <Text style={[styles.audit, { color: colors.textMuted }]}>
        Created {new Date(split.createdAt).toLocaleString(profile.locale)}
      </Text>
      <ConfirmationDialog
        visible={showDelete}
        title="Delete split?"
        message={`Delete “${split.description}”? This action cannot be undone.`}
        loading={deleting}
        onCancel={() => {
          if (!deleting) setShowDelete(false);
        }}
        onConfirm={() => void remove()}
      />
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
  historyRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyAmount: { fontSize: 13, fontWeight: "800" },
  note: { marginTop: 5, fontSize: 14, lineHeight: 20 },
  audit: { fontSize: 10, lineHeight: 15, textAlign: "center" },
});
