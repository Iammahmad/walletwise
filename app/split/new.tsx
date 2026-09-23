import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { FormField } from "@/src/components/FormField";
import { Screen } from "@/src/components/Screen";
import { decimalToMinor, formatMoney } from "@/src/domain/money";
import type {
  LoanDirection,
  SplitContact,
  SplitParticipantInput,
  SplitType,
} from "@/src/domain/types";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import {
  createConnectionInvite,
  shareInviteOnWhatsApp,
} from "@/src/features/splits/invites";
import { allocateEqualShares } from "@/src/features/splits/calculations";
import {
  listContacts,
  saveContact,
  saveSplit,
} from "@/src/features/splits/repository";
import { normalizeError } from "@/src/services/errors";
import {
  getFirebaseAuth,
  isFirebaseFunctionsEnabled,
} from "@/src/services/firebase/config";
import { syncNow } from "@/src/services/sync";
import { useAppStore } from "@/src/state/appStore";

export default function NewSplitScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile)!;
  const bump = useAppStore((state) => state.bumpDbRevision);
  const [type, setType] = useState<SplitType>("equal");
  const [direction, setDirection] = useState<LoanDirection>("lent");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [contacts, setContacts] = useState<SplitContact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [payer, setPayer] = useState<string>("owner");
  const [newFriend, setNewFriend] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void listContacts()
      .then(setContacts)
      .catch((caught) => setError(normalizeError(caught).message));
  }, []);
  const chosen = useMemo(
    () => contacts.filter((item) => selected.includes(item.id)),
    [contacts, selected],
  );
  const previewMinor = useMemo(() => {
    try {
      return amount.trim()
        ? decimalToMinor(amount, profile.defaultCurrency)
        : null;
    } catch {
      return null;
    }
  }, [amount, profile.defaultCurrency]);

  const addLocalFriend = async () => {
    try {
      const contact = await saveContact({ displayName: newFriend });
      setContacts((value) => [...value, contact]);
      setSelected((value) => [...value, contact.id]);
      setNewFriend("");
      bump();
    } catch (caught) {
      setError(normalizeError(caught).message);
    }
  };
  const invite = async () => {
    if (!getFirebaseAuth()?.currentUser) {
      router.push("/auth");
      return;
    }
    try {
      const result = await createConnectionInvite();
      await shareInviteOnWhatsApp(result.url);
    } catch (caught) {
      setError(normalizeError(caught).message);
    }
  };
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const totalMinor = decimalToMinor(amount, profile.defaultCurrency);
      const activeContacts = type === "loan" ? chosen.slice(0, 1) : chosen;
      if (!activeContacts.length)
        throw new Error("Choose at least one friend.");
      const authUser = getFirebaseAuth()?.currentUser;
      let participants: SplitParticipantInput[];
      if (type === "loan") {
        const contact = activeContacts[0]!;
        participants =
          direction === "lent"
            ? [
                {
                  displayName: "You",
                  remoteUserId: authUser?.uid ?? null,
                  isOwner: true,
                  shareMinor: 0,
                  paidMinor: totalMinor,
                },
                {
                  contactId: contact.id,
                  remoteUserId: contact.remoteUserId,
                  displayName: contact.displayName,
                  isOwner: false,
                  shareMinor: totalMinor,
                  paidMinor: 0,
                },
              ]
            : [
                {
                  displayName: "You",
                  remoteUserId: authUser?.uid ?? null,
                  isOwner: true,
                  shareMinor: totalMinor,
                  paidMinor: 0,
                },
                {
                  contactId: contact.id,
                  remoteUserId: contact.remoteUserId,
                  displayName: contact.displayName,
                  isOwner: false,
                  shareMinor: 0,
                  paidMinor: totalMinor,
                },
              ];
      } else {
        const shares = allocateEqualShares(
          totalMinor,
          activeContacts.length + 1,
        );
        participants = [
          {
            displayName: "You",
            remoteUserId: authUser?.uid ?? null,
            isOwner: true,
            shareMinor: shares[0]!,
            paidMinor: payer === "owner" ? totalMinor : 0,
          },
          ...activeContacts.map((contact, index) => ({
            contactId: contact.id,
            remoteUserId: contact.remoteUserId,
            displayName: contact.displayName,
            isOwner: false,
            shareMinor: shares[index + 1]!,
            paidMinor: payer === contact.id ? totalMinor : 0,
          })),
        ];
      }
      const saved = await saveSplit({
        description,
        splitType: type,
        loanDirection: type === "loan" ? direction : null,
        totalMinor,
        currency: profile.defaultCurrency,
        occurredAt: new Date().toISOString(),
        note: null,
        participants,
      });
      bump();
      if (authUser) void syncNow().catch(() => undefined);
      router.replace({ pathname: "/split/[id]", params: { id: saved.id } });
    } catch (caught) {
      setError(normalizeError(caught).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title="New split"
      subtitle="This stays separate from your money tracker."
    >
      <View style={[styles.toggle, { backgroundColor: colors.surface }]}>
        <Pressable
          onPress={() => setType("equal")}
          style={[
            styles.toggleItem,
            type === "equal" && { backgroundColor: colors.primarySoft },
          ]}
        >
          <Text
            style={{
              color: type === "equal" ? colors.primary : colors.textMuted,
              fontWeight: "800",
            }}
          >
            Equal split
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setType("loan")}
          style={[
            styles.toggleItem,
            type === "loan" && { backgroundColor: colors.primarySoft },
          ]}
        >
          <Text
            style={{
              color: type === "loan" ? colors.primary : colors.textMuted,
              fontWeight: "800",
            }}
          >
            Loan
          </Text>
        </Pressable>
      </View>
      {type === "loan" ? (
        <View style={[styles.toggle, { backgroundColor: colors.surface }]}>
          <Pressable
            onPress={() => setDirection("lent")}
            style={[
              styles.toggleItem,
              direction === "lent" && { backgroundColor: colors.primarySoft },
            ]}
          >
            <Text style={{ color: colors.text }}>I lent money</Text>
          </Pressable>
          <Pressable
            onPress={() => setDirection("borrowed")}
            style={[
              styles.toggleItem,
              direction === "borrowed" && {
                backgroundColor: colors.primarySoft,
              },
            ]}
          >
            <Text style={{ color: colors.text }}>I borrowed</Text>
          </Pressable>
        </View>
      ) : null}
      <FormField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder={
          type === "loan" ? "Personal loan" : "Dinner, trip, or shared bill"
        }
        maxLength={160}
      />
      <FormField
        label={`Amount (${profile.defaultCurrency})`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />
      <View style={styles.headingRow}>
        <Text style={[styles.heading, { color: colors.text }]}>
          {type === "loan" ? "Choose one friend" : "Choose friends"}
        </Text>
        <Button
          label={isFirebaseFunctionsEnabled ? "Invite" : "Local only"}
          icon="logo-whatsapp"
          variant="ghost"
          disabled={!isFirebaseFunctionsEnabled}
          onPress={() => void invite()}
        />
      </View>
      <Card>
        {contacts.map((contact) => {
          const checked = selected.includes(contact.id);
          return (
            <Pressable
              key={contact.id}
              onPress={() =>
                setSelected((value) =>
                  type === "loan"
                    ? [contact.id]
                    : checked
                      ? value.filter((id) => id !== contact.id)
                      : [...value, contact.id],
                )
              }
              style={[styles.contact, { borderBottomColor: colors.border }]}
            >
              <Ionicons
                name={checked ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={checked ? colors.primary : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactName, { color: colors.text }]}>
                  {contact.displayName}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {contact.status === "connected"
                    ? "Connected · notifications enabled"
                    : "Local contact"}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {!contacts.length ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            No friends yet. Add one locally or send an invitation.
          </Text>
        ) : null}
      </Card>
      <View style={styles.localFriend}>
        <View style={{ flex: 1 }}>
          <FormField
            label="Add a local friend"
            value={newFriend}
            onChangeText={setNewFriend}
            placeholder="Friend’s name"
          />
        </View>
        <Button
          label="Add"
          disabled={!newFriend.trim()}
          onPress={() => void addLocalFriend()}
        />
      </View>
      {type === "equal" && chosen.length ? (
        <>
          <Text style={[styles.heading, { color: colors.text }]}>
            Who paid?
          </Text>
          <View style={styles.payerGrid}>
            <Pressable
              onPress={() => setPayer("owner")}
              style={[
                styles.payer,
                {
                  borderColor:
                    payer === "owner" ? colors.primary : colors.border,
                  backgroundColor:
                    payer === "owner" ? colors.primarySoft : colors.surface,
                },
              ]}
            >
              <Text style={{ color: colors.text }}>You paid</Text>
            </Pressable>
            {chosen.map((contact) => (
              <Pressable
                key={contact.id}
                onPress={() => setPayer(contact.id)}
                style={[
                  styles.payer,
                  {
                    borderColor:
                      payer === contact.id ? colors.primary : colors.border,
                    backgroundColor:
                      payer === contact.id
                        ? colors.primarySoft
                        : colors.surface,
                  },
                ]}
              >
                <Text style={{ color: colors.text }}>
                  {contact.displayName} paid
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      {previewMinor != null && chosen.length ? (
        <Text style={[styles.preview, { color: colors.textMuted }]}>
          {type === "equal"
            ? `${formatMoney(previewMinor, profile.defaultCurrency, profile.locale)} split between ${chosen.length + 1} people`
            : `${direction === "lent" ? "They owe you" : "You owe them"} ${formatMoney(previewMinor, profile.defaultCurrency, profile.locale)}`}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <Button
        label={type === "loan" ? "Save loan" : "Save split"}
        icon="checkmark"
        loading={saving}
        disabled={!description.trim() || !amount.trim() || !chosen.length}
        onPress={() => void submit()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", padding: 4, borderRadius: radius.md },
  toggleItem: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: { fontSize: 16, fontWeight: "800" },
  contact: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contactName: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 11, marginTop: 3 },
  empty: { paddingVertical: spacing.lg, textAlign: "center" },
  localFriend: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  payerGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  payer: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: { fontSize: 12, lineHeight: 18, textAlign: "center" },
});
