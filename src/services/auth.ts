import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";

import {
  getProfile,
  linkLocalDataToUser,
  preparePristineLocalDataForCloudRestore,
  unlinkCloudUser,
} from "@/src/db/repository";
import { isExpectedOAuthRedirect, parseOAuthCallback } from "./oauthCallback";
import { openOAuthSession } from "./oauthBrowser";
import { requireSupabase } from "./supabase";

async function connectLocalData(userId: string): Promise<void> {
  const supabase = requireSupabase();
  const localProfile = await getProfile();
  if (localProfile.userId && localProfile.userId !== userId) {
    throw new Error(
      "This device ledger is linked to a different account. Sign in with that account, or reset local data before switching accounts.",
    );
  }
  if (localProfile.userId === userId) return;
  const { data: remoteProfile, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (remoteProfile && (await preparePristineLocalDataForCloudRestore(userId)))
    return;
  await linkLocalDataToUser(userId);
}

async function connectSession(session: Session): Promise<Session> {
  const supabase = requireSupabase();
  try {
    await connectLocalData(session.user.id);
  } catch (connectError) {
    await supabase.auth.signOut();
    throw connectError;
  }
  return session;
}

export async function getSession(): Promise<Session | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(
  email: string,
  password: string,
): Promise<Session> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  if (!data.session) throw new Error("Sign-in did not return a session.");
  return connectSession(data.session);
}

export async function signUp(
  email: string,
  password: string,
): Promise<{ session: Session | null; confirmationRequired: boolean }> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  if (data.session) await connectSession(data.session);
  return { session: data.session, confirmationRequired: !data.session };
}

export function getGoogleOAuthRedirectUrl(): string {
  return Linking.createURL("auth");
}

async function sessionFromOAuthCallback(
  callbackUrl: string,
  redirectUrl: string,
): Promise<Session> {
  if (!isExpectedOAuthRedirect(callbackUrl, redirectUrl)) {
    throw new Error(
      "Google returned to an unexpected application address. Sign-in was stopped.",
    );
  }

  const supabase = requireSupabase();
  const credentials = parseOAuthCallback(callbackUrl);
  const result =
    credentials.flow === "pkce"
      ? await supabase.auth.exchangeCodeForSession(credentials.code)
      : await supabase.auth.setSession({
          access_token: credentials.accessToken,
          refresh_token: credentials.refreshToken,
        });
  if (result.error) throw result.error;
  if (!result.data.session)
    throw new Error("Google sign-in did not return a session.");
  return connectSession(result.data.session);
}

export async function signInWithGoogle(): Promise<Session | null> {
  const supabase = requireSupabase();
  const redirectUrl = getGoogleOAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (!data.url)
    throw new Error("Google sign-in could not be started. Please try again.");

  const result = await openOAuthSession(data.url, redirectUrl);
  if (result.type !== "success") return null;
  return sessionFromOAuthCallback(result.url, redirectUrl);
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  await unlinkCloudUser();
}

export async function deleteCloudAccount(): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.functions.invoke("delete-account", {
    body: { confirmation: "DELETE" },
  });
  if (error) throw error;
  await unlinkCloudUser();
}
