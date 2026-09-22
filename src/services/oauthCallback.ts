export type OAuthCallbackCredentials =
  | { flow: "pkce"; code: string }
  | { flow: "implicit"; accessToken: string; refreshToken: string };

function callbackParameters(url: string): URLSearchParams {
  const questionIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");
  const queryEnd = hashIndex >= 0 ? hashIndex : url.length;
  const query =
    questionIndex >= 0 ? url.slice(questionIndex + 1, queryEnd) : "";
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";
  const parameters = new URLSearchParams(query);
  const hashParameters = new URLSearchParams(hash);
  hashParameters.forEach((value, key) => {
    if (!parameters.has(key)) parameters.set(key, value);
  });
  return parameters;
}

export function hasOAuthCallbackParameters(url: string): boolean {
  const parameters = callbackParameters(url);
  return Boolean(
    parameters.get("code") ||
    parameters.get("access_token") ||
    parameters.get("error"),
  );
}

export function parseOAuthCallback(url: string): OAuthCallbackCredentials {
  const parameters = callbackParameters(url);
  if (parameters.get("error") || parameters.get("error_code")) {
    throw new Error("Google sign-in was not completed. Please try again.");
  }

  const code = parameters.get("code")?.trim();
  if (code) return { flow: "pkce", code };

  const accessToken = parameters.get("access_token")?.trim();
  const refreshToken = parameters.get("refresh_token")?.trim();
  if (accessToken && refreshToken)
    return { flow: "implicit", accessToken, refreshToken };

  throw new Error(
    "Google did not return a valid authentication response. Please try again.",
  );
}

export function isExpectedOAuthRedirect(
  callbackUrl: string,
  expectedRedirectUrl: string,
): boolean {
  const base = (value: string) =>
    (value.split(/[?#]/, 1)[0] ?? "").replace(/\/+$/, "").toLowerCase();
  return base(callbackUrl) === base(expectedRedirectUrl);
}
