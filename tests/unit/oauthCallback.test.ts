import {
  hasOAuthCallbackParameters,
  isExpectedOAuthRedirect,
  parseOAuthCallback,
} from "@/src/services/oauthCallback";

describe("OAuth callback validation", () => {
  it("parses a PKCE authorization code", () => {
    expect(parseOAuthCallback("spendspeak://auth?code=one-time-code")).toEqual({
      flow: "pkce",
      code: "one-time-code",
    });
  });

  it("supports a validated implicit callback for compatibility", () => {
    expect(
      parseOAuthCallback(
        "spendspeak://auth#access_token=access&refresh_token=refresh",
      ),
    ).toEqual({
      flow: "implicit",
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  it("rejects provider errors and incomplete token pairs without exposing raw details", () => {
    expect(() =>
      parseOAuthCallback(
        "spendspeak://auth?error=access_denied&error_description=sensitive",
      ),
    ).toThrow("Google sign-in was not completed");
    expect(() =>
      parseOAuthCallback("spendspeak://auth#access_token=access"),
    ).toThrow("valid authentication response");
  });

  it("recognizes callbacks and requires the configured redirect address", () => {
    expect(hasOAuthCallbackParameters("spendspeak://auth?code=abc")).toBe(true);
    expect(hasOAuthCallbackParameters("spendspeak://auth")).toBe(false);
    expect(
      isExpectedOAuthRedirect(
        "SPENDSPEAK://AUTH/?code=abc",
        "spendspeak://auth",
      ),
    ).toBe(true);
    expect(
      isExpectedOAuthRedirect("malicious://auth?code=abc", "spendspeak://auth"),
    ).toBe(false);
  });
});
