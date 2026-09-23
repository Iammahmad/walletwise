import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { Screen } from "@/src/components/Screen";
import { useTheme } from "@/src/design/ThemeProvider";
import { acceptConnectionInvite } from "@/src/features/splits/invites";
import { saveContact } from "@/src/features/splits/repository";
import { normalizeError } from "@/src/services/errors";
import {
  getFirebaseAuth,
  isFirebaseFunctionsEnabled,
} from "@/src/services/firebase/config";
import { syncNow } from "@/src/services/sync";
import { useAppStore } from "@/src/state/appStore";

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const bump = useAppStore((state) => state.bumpDbRevision);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const accept = async () => {
    if (!getFirebaseAuth()?.currentUser) {
      router.push({
        pathname: "/auth",
        params: { returnTo: `/invite/${token}` },
      });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const friend = await acceptConnectionInvite(token);
      await saveContact({
        id: friend.contactId,
        displayName: friend.displayName,
        email: friend.email,
        remoteUserId: friend.remoteUserId,
        status: "connected",
      });
      await syncNow();
      bump();
      router.replace("/(tabs)/splits");
    } catch (caught) {
      setMessage(normalizeError(caught).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Screen
      title="WalletWise invitation"
      subtitle="Connect for shared expenses and loans."
    >
      <Card style={{ backgroundColor: colors.primarySoft }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 16,
            fontWeight: "800",
            marginBottom: 8,
          }}
        >
          A friend invited you to connect
        </Text>
        <Text style={{ color: colors.textMuted, lineHeight: 21 }}>
          Once connected, either of you can add the other to a split. You
          receive a notification when a new shared entry is created. Your
          private transactions, savings, and budgets remain private.
        </Text>
      </Card>
      {!isFirebaseFunctionsEnabled ? (
        <Text style={{ color: colors.textMuted }}>
          Connected invitations are unavailable while WalletWise uses free cloud
          mode. You can still add this person as a local friend.
        </Text>
      ) : null}
      {message ? <Text style={{ color: colors.danger }}>{message}</Text> : null}
      <Button
        label={
          getFirebaseAuth()?.currentUser
            ? "Accept invitation"
            : "Sign in to accept"
        }
        icon="people-outline"
        loading={loading}
        disabled={!isFirebaseFunctionsEnabled}
        onPress={() => void accept()}
      />
      <Button
        label="Not now"
        variant="ghost"
        onPress={() => router.replace("/(tabs)/splits")}
      />
    </Screen>
  );
}
