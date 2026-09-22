import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function parseEnvironment(source) {
  const values = new Map();
  for (const sourceLine of source.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.set(name, value);
  }
  return values;
}

function requireValue(values, name) {
  const value = values.get(name)?.trim();
  if (!value || /replace_me|your-project|substitute/i.test(value)) {
    throw new Error(`${name} is missing or still contains a placeholder.`);
  }
  return value;
}

async function main() {
  const source = await readFile(resolve(process.cwd(), ".env"), "utf8");
  const values = parseEnvironment(source);
  const url = requireValue(values, "EXPO_PUBLIC_SUPABASE_URL");
  const publishableKey = requireValue(
    values,
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL must use HTTP or HTTPS.");
  }

  const settingsUrl = new URL("/auth/v1/settings", parsedUrl).toString();
  const response = await fetch(settingsUrl, {
    headers: { apikey: publishableKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(
      `Supabase rejected the configuration (HTTP ${response.status}). Verify the project URL and publishable key.`,
    );
  }
  const settings = await response.json();
  const googleEnabled = settings?.external?.google === true;
  process.stdout.write(
    `Supabase URL and publishable key are valid, and the Auth service is reachable. Google provider: ${googleEnabled ? "enabled" : "disabled"}.\n`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Supabase check failed: ${message}`);
  process.exitCode = 1;
});
