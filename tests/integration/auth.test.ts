import * as repository from "@/src/db/repository";
import * as OAuthBrowser from "@/src/services/oauthBrowser";

import { signIn, signInWithGoogle } from "@/src/services/auth";
import { requireSupabase } from "@/src/services/supabase";

jest.mock("@/src/db/repository", () => ({
  getProfile: jest.fn(),
  linkLocalDataToUser: jest.fn(),
  preparePristineLocalDataForCloudRestore: jest.fn(),
  unlinkCloudUser: jest.fn(),
}));

jest.mock("@/src/services/supabase", () => ({ requireSupabase: jest.fn() }));
jest.mock("expo-linking", () => ({
  createURL: jest.fn(() => "spendspeak://auth"),
}));
jest.mock("@/src/services/oauthBrowser", () => ({
  openOAuthSession: jest.fn(),
}));

const profile = {
  id: "local-owner-1",
  userId: null,
  defaultCurrency: "PKR",
  locale: "en-PK",
  timezone: "Asia/Karachi",
  onboardingCompleted: true,
  cloudAiEnabled: false,
  theme: "system" as const,
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() };
chain.select.mockReturnValue(chain);
chain.eq.mockReturnValue(chain);

const session = { user: { id: "user-1", email: "user@example.com" } };
const supabase = {
  auth: {
    signInWithPassword: jest.fn(),
    signInWithOAuth: jest.fn(),
    exchangeCodeForSession: jest.fn(),
    setSession: jest.fn(),
    signOut: jest.fn(),
  },
  from: jest.fn(() => chain),
};

describe("authentication and local-ledger ownership integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    jest.mocked(requireSupabase).mockReturnValue(supabase as never);
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session },
      error: null,
    });
    supabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: "https://project.supabase.co/auth/v1/authorize" },
      error: null,
    });
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    supabase.auth.setSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    supabase.auth.signOut.mockResolvedValue({ error: null });
    jest.mocked(OAuthBrowser.openOAuthSession).mockResolvedValue({
      type: "success",
      url: "spendspeak://auth?code=google-code",
    });
    jest.mocked(repository.getProfile).mockResolvedValue(profile);
    jest
      .mocked(repository.preparePristineLocalDataForCloudRestore)
      .mockResolvedValue(false);
  });

  it("links unsynced local data when the account has no cloud profile", async () => {
    await signIn("user@example.com", "password");
    expect(repository.linkLocalDataToUser).toHaveBeenCalledWith("user-1");
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it("prepares an empty local shell for restore when cloud backup exists", async () => {
    chain.maybeSingle.mockResolvedValueOnce({
      data: { user_id: "user-1" },
      error: null,
    });
    jest
      .mocked(repository.preparePristineLocalDataForCloudRestore)
      .mockResolvedValueOnce(true);
    await signIn("user@example.com", "password");
    expect(
      repository.preparePristineLocalDataForCloudRestore,
    ).toHaveBeenCalledWith("user-1");
    expect(repository.linkLocalDataToUser).not.toHaveBeenCalled();
  });

  it("rejects a different account and immediately clears the newly created session", async () => {
    jest
      .mocked(repository.getProfile)
      .mockResolvedValueOnce({ ...profile, userId: "another-user" });
    await expect(signIn("user@example.com", "password")).rejects.toThrow(
      "linked to a different account",
    );
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(repository.linkLocalDataToUser).not.toHaveBeenCalled();
  });

  it("signs in with Google using PKCE and adopts the local ledger", async () => {
    await expect(signInWithGoogle()).resolves.toBe(session);
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "spendspeak://auth",
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    expect(OAuthBrowser.openOAuthSession).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/authorize",
      "spendspeak://auth",
    );
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(
      "google-code",
    );
    expect(repository.linkLocalDataToUser).toHaveBeenCalledWith("user-1");
  });

  it("leaves the ledger untouched when Google sign-in is cancelled", async () => {
    jest
      .mocked(OAuthBrowser.openOAuthSession)
      .mockResolvedValueOnce({ type: "cancel" } as never);
    await expect(signInWithGoogle()).resolves.toBeNull();
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(repository.linkLocalDataToUser).not.toHaveBeenCalled();
  });

  it("rejects an OAuth callback sent to an unexpected application address", async () => {
    jest.mocked(OAuthBrowser.openOAuthSession).mockResolvedValueOnce({
      type: "success",
      url: "malicious://auth?code=google-code",
    });
    await expect(signInWithGoogle()).rejects.toThrow(
      "unexpected application address",
    );
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
