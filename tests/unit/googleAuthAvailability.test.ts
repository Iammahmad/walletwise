import { loadOAuthBrowser } from "@/src/services/oauthBrowser";

describe("Google authentication native availability", () => {
  it("returns an actionable error when an old build lacks the native module", async () => {
    const unavailableImporter = async () => {
      throw new Error("Cannot find native module 'ExpoWebBrowser'");
    };

    await expect(loadOAuthBrowser(unavailableImporter)).rejects.toThrow(
      "requires the latest SpendSpeak development build",
    );
  });

  it("accepts the native module namespace and completes browser setup", async () => {
    const maybeCompleteAuthSession = jest.fn();
    const openAuthSessionAsync = jest.fn();
    const browser = await loadOAuthBrowser(async () => ({
      maybeCompleteAuthSession,
      openAuthSessionAsync,
    }));

    expect(browser.openAuthSessionAsync).toBe(openAuthSessionAsync);
    expect(maybeCompleteAuthSession).toHaveBeenCalledTimes(1);
  });
});
