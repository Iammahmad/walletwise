import * as Linking from "expo-linking";
import { httpsCallable } from "firebase/functions";
import { Share } from "react-native";

import { splitInviteTokenSchema } from "@/src/domain/schemas";
import {
  requireFirebaseAuth,
  requireFirebaseFunctions,
} from "@/src/services/firebase/config";

export async function createConnectionInvite(): Promise<{
  token: string;
  url: string;
}> {
  if (!requireFirebaseAuth().currentUser)
    throw new Error("Sign in to invite a friend.");
  const createInvite = httpsCallable<Record<string, never>, { token: string }>(
    requireFirebaseFunctions(),
    "createConnectionInvite",
  );
  const result = await createInvite({});
  const token = splitInviteTokenSchema.parse(result.data.token);
  const baseUrl = process.env.EXPO_PUBLIC_INVITE_BASE_URL?.trim().replace(
    /\/$/,
    "",
  );
  const url = baseUrl
    ? `${baseUrl}/invite/${token}`
    : Linking.createURL(`invite/${token}`);
  return { token, url };
}

export async function shareInviteOnWhatsApp(url: string): Promise<void> {
  const message = `Join me on WalletWise so we can track shared expenses and settle up easily: ${url}`;
  try {
    await Linking.openURL(
      `whatsapp://send?text=${encodeURIComponent(message)}`,
    );
  } catch {
    await Share.share({ message, title: "Join me on WalletWise" });
  }
}

export async function acceptConnectionInvite(token: string): Promise<{
  contactId: string;
  remoteUserId: string;
  displayName: string;
  email: string | null;
}> {
  splitInviteTokenSchema.parse(token);
  if (!requireFirebaseAuth().currentUser)
    throw new Error("Sign in before accepting an invitation.");
  const acceptInvite = httpsCallable<
    { token: string },
    {
      contactId: string;
      remoteUserId: string;
      displayName: string;
      email: string | null;
    }
  >(requireFirebaseFunctions(), "acceptConnectionInvite");
  const result = await acceptInvite({ token });
  return result.data;
}
