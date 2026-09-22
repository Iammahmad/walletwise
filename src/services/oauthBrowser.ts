import type { WebBrowserAuthSessionResult } from "expo-web-browser";

type OAuthBrowser = Pick<
  typeof import("expo-web-browser"),
  "maybeCompleteAuthSession" | "openAuthSessionAsync"
>;

export type OAuthBrowserImporter = () => Promise<unknown>;

const importNativeBrowser: OAuthBrowserImporter = () =>
  import("expo-web-browser");

function defaultExport(value: unknown): unknown {
  return typeof value === "object" && value !== null && "default" in value
    ? value.default
    : undefined;
}

function isOAuthBrowser(value: unknown): value is OAuthBrowser {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.openAuthSessionAsync === "function" &&
    typeof candidate.maybeCompleteAuthSession === "function"
  );
}

export async function loadOAuthBrowser(
  importer: OAuthBrowserImporter = importNativeBrowser,
): Promise<OAuthBrowser> {
  try {
    const imported = await importer();
    const firstDefault = defaultExport(imported);
    const browser = [imported, firstDefault, defaultExport(firstDefault)].find(
      isOAuthBrowser,
    );
    if (!browser) throw new Error("ExpoWebBrowser is unavailable");
    browser.maybeCompleteAuthSession();
    return browser;
  } catch {
    throw new Error(
      "Google sign-in requires the latest SpendSpeak development build. Install the newly built app, then try again.",
    );
  }
}

export async function openOAuthSession(
  authorizationUrl: string,
  redirectUrl: string,
): Promise<WebBrowserAuthSessionResult> {
  const browser = await loadOAuthBrowser();
  return browser.openAuthSessionAsync(authorizationUrl, redirectUrl);
}
