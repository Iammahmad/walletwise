# SpendSpeak

SpendSpeak is a local-first personal money tracker for iOS and Android. It records expenses and income manually or from reviewed English voice commands, stores the ledger in SQLite, and keeps optional Supabase backup, synchronization, authentication, and Gemini-assisted parsing behind explicit user choices.

## What is implemented

- First-run selection of currency, locale, and timezone with seeded Cash/Bank accounts, default categories, local-first custom expense/income categories, and separately editable budget categories.
- Precise integer-minor-unit money storage and locale-aware display.
- Manual expense/income creation, editing, soft deletion, undo, search, filters, exact month browsing, date grouping, and CSV export.
- Home totals, remaining monthly budget, category breakdown, recent transactions, and offline feedback.
- A month-selectable budget dashboard with separate overall and per-category limits, exact spent/remaining amounts, over-budget states, accessible progress indicators, and transaction drill-down for every category budget. Budgets are isolated to their assigned calendar month and never silently carry forward.
- Native iOS `SFSpeechRecognizer` and Android `SpeechRecognizer` integration through `expo-speech-recognition`.
- Explicit voice permission/listening/processing/review/error states, interim transcript, Stop/Cancel, silence timeout, lifecycle cleanup, and no audio persistence.
- Deterministic English parsing for digit/spoken-word amounts, currencies, intent, transaction categories, explicit budget categories, merchants, accounts, timezone-aware relative dates, ordinal/month-name/validated explicit dates, multiple transactions, and reviewed deletion commands.
- Many-to-many automatic budget membership: a budget can include several transaction categories, and one transaction category can feed several budgets. A Food expense can count in both Food and Household automatically, while explicit voice/manual selection still overrides membership and **No budget** excludes it. For example, `Expense 600 spent on Food in Eating Out budget` explicitly assigns only Eating Out.
- Mandatory editable review before every voice-created write.
- Optional Supabase email/password or Google authentication, PKCE OAuth, secure session storage, durable SQLite outbox, reconnect/manual sync, idempotent UUID upserts, tombstones, and latest-`updated_at` conflict handling.
- Optional authenticated Gemini parsing through a protected Edge Function with strict schemas, request limits, timeout, server-side rate limiting, and redacted logs.
- Complete RLS policies, protected account deletion, local reset, light/dark themes, accessibility labels, dynamic-text-friendly layouts, and reduced decorative motion.

### Budget membership behavior

Open **Settings → Budget categories**, create or edit a budget category such as Household, and check Food, Groceries, or any other expense categories that it should include. The matching Food budget can keep Food selected at the same time. An expense saved with **Budget → Automatic** then contributes to every matching budget; an explicitly selected budget contributes only there, and **No budget** contributes to no category budget. Monthly limits are created separately from the Budgets tab.

## Requirements

- Node.js 22.13 or newer. Node 24 LTS is recommended.
- npm.
- Android Studio and Android SDK for local Android builds.
- macOS with Xcode for local iOS builds, or EAS Build for iOS from another platform.
- A physical device is strongly recommended for speech-recognition verification.
- Optional: Supabase CLI and a Supabase project for cloud features.

This project targets Expo SDK 57, React Native 0.86, and React 19.2. It uses a native speech module and therefore does **not** support speech-recognition testing in Expo Go.

## Install and verify

```bash
npm install
npm run typecheck
npm run lint
npm test
npx expo install --check
```

Start Metro for a development client:

```bash
npm run dev
```

## Native development builds

The speech config plugin adds `RECORD_AUDIO` and speech-service package visibility on Android, plus microphone and speech-recognition usage descriptions on iOS. `expo-web-browser` supplies the secure Google OAuth browser session. The native splash screen and adaptive app icon use Expo SDK 57 config. Any native dependency, permission, icon, splash, or plugin change requires a new native binary.

Local Android development build:

```bash
npm run android
```

Local iOS development build on macOS:

```bash
npm run ios
```

EAS development builds:

```bash
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
```

## Android APK builds

The latest directly installable testing build is SpendSpeak v1.1.0 (Android version code 3). The current source is v1.2.0 (version code 4) and adds many-to-many automatic budget membership; a new APK has not yet been built from that source.

- [Open the v1.1.0 EAS build page](https://expo.dev/accounts/iamm.ahmed/projects/spendspeak/builds/166240e2-bd50-414d-8a6d-e2b7b8f4d79b)
- [Download the v1.1.0 APK directly](https://expo.dev/artifacts/eas/90nAEg_BkaO-0GFHLe12C3NFZrarQNx4kxP9S2hCp7c.apk) (scheduled to expire on October 2, 2026)
- Local retained copy: `releases/SpendSpeak-v1.1.0.apk` (`109472964` bytes / 104.40 MB)
- SHA-256: `B109383EDE159BE8E9BE025EFE09358993013FEA7927FAFF902ED29BA0CA7A32`

SpendSpeak v1.0.1 (Android version code 2) remains below for release history. It fixed repeated screen refreshing and added exact historical-month navigation to Transactions and Budgets.

- [Open the v1.0.1 EAS build page](https://expo.dev/accounts/iamm.ahmed/projects/spendspeak/builds/e54ee811-b648-4271-b915-4f3bc8f3c47f)
- [Download the v1.0.1 APK directly](https://expo.dev/artifacts/eas/QICcTlOiU7ZA3cmVL69Rdzu0Jk1oLVibJxmo09r4eJk.apk) (scheduled to expire on September 21, 2026)
- Local retained copy: `releases/SpendSpeak-v1.0.1.apk` (104.40 MB)
- SHA-256: `4FE48515CE5F70A2FBCCEF14A7EC6FB0E29F14938545E8A47CCFC45A35F519A5`

The original first APK is also recorded below for release history.

SpendSpeak v1.0.0 (Android version code 1) was built successfully with the
`preview` EAS profile on September 7, 2026. This is a signed,
internal-distribution APK for direct device testing; it does not need Metro or
a development server after installation.

- [Open the permanent EAS build page](https://expo.dev/accounts/iamm.ahmed/projects/spendspeak/builds/ee412d80-c00f-4ca1-9c18-9b774e845e9e)
- [Download the APK directly](https://expo.dev/artifacts/eas/7KV6gVInDAJ3HIWR2bQzv3zSaQzcJUFaxfrIvr3DcuI.apk) (the EAS artifact is scheduled to expire on September 21, 2026)
- Local retained copy: `releases/SpendSpeak-v1.0.0.apk` (104.39 MB)
- SHA-256: `0723E59EA4928A85B1DAC45523EFA5493D6F8CD8BB95F059BA5E49E74A037735`

On Android, open the build page or APK link, download the file, allow the
browser or file manager to install unknown apps when prompted, and install it.
If Android reports a signing conflict with an earlier locally built app, export
or synchronize important data before uninstalling the older build because an
uninstall deletes that app's local SQLite data.

Create a future directly installable test APK with:

```bash
npx eas-cli build --profile preview --platform android
```

The preview profile explicitly uses `android.buildType: "apk"`. A later Google
Play release should use an Android App Bundle (`.aab`) through the production
profile instead.

Generated `android/` and `ios/` directories are intentionally ignored. Expo Continuous Native Generation recreates them from `app.json` and the installed config plugins.

## Environment variables

Copy `.env.example` to `.env` and set the public mobile values only if cloud features are wanted:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

When either value is absent, SpendSpeak visibly runs in local-only mode. Google OAuth uses the configured Supabase provider and does not require a Google client secret in the mobile environment. Do not place a Google client secret, service-role key, or Gemini key in `.env`, `app.json`, EAS public variables, or any `EXPO_PUBLIC_*` value.

The Supabase Dashboard may show framework-specific examples using `NEXT_PUBLIC_` variables. SpendSpeak is an Expo application and requires the exact `EXPO_PUBLIC_` names above. Validate the local values without printing them:

```bash
npm run supabase:check
```

If that command reports `fetch failed`, verify that the project still exists and copy its exact **Project URL** from Supabase **Settings → API**. A malformed, deleted, or unavailable project hostname cannot resolve and cloud authentication/synchronization will remain disabled, while local-only tracking continues to work.

## Local database

`src/db/database.ts` opens `spendspeak.db`, enables WAL and foreign keys, runs numbered migrations, and seeds idempotently. SQLite remains the immediate UI source even for signed-in users.

Local schema version 3 adds many-to-many category membership to `budget_categories` and an explicit `auto | explicit | none` assignment mode to transactions. Existing same-name category mappings become initial memberships without changing transaction UUIDs. Automatic transactions are evaluated against every matching budget; explicit assignments remain single-budget overrides.

- Device-generated UUIDs shared with cloud rows.
- Nullable authenticated `user_id` and a stable `local_owner_id`.
- `updated_at`, `deleted_at`, `sync_status`, `local_updated_at`, and `last_synced_at` metadata.
- A durable `sync_outbox` with retry count, backoff timestamp, and error code.

Financial values use integer `amount_minor`. Decimal text is parsed with string/`BigInt` arithmetic and checked against currency precision before conversion to a safe JavaScript integer.

## Supabase setup

The official Supabase CLI is installed as a pinned project development dependency. Initialize/link the hosted project if needed, then apply the committed migration:

```bash
npm run supabase:login
npm run supabase:link -- --project-ref YOUR_PROJECT_REF
npm run supabase:push
```

The initial migration at `supabase/migrations/202608300001_initial_schema.sql` creates profiles, accounts, categories, transactions, budgets, protected AI rate limits, indexes, ownership triggers, timestamp triggers, and RLS. `202609180001_budget_categories.sql` adds budget categories and `202609180002_budget_category_memberships.sql` adds membership arrays, assignment modes, ownership validation, and supporting indexes. Apply all migrations in timestamp order with `npm run supabase:push` before testing v1.2 cloud sync.

Every user-data table enables RLS and has explicit select/insert/update/delete policies requiring `user_id = auth.uid()`. Additional triggers reject transaction or budget relationships whose account/category belongs to another user.

For local Supabase development:

```bash
npm run supabase:start
npm run supabase:reset
```

The local stack requires Docker Desktop or another Docker-compatible runtime. It is optional when connecting directly to a hosted Supabase project.

Use two disposable test users to verify that cross-user select, insert, update, and delete operations are denied before deploying to production.

### Google sign-in setup

Google supplies identity only. SpendSpeak stores financial records in local SQLite and the authenticated user's RLS-protected Supabase rows; it does not store ledger data in Google Drive.

1. Open Google Auth Platform in a Google Cloud project and configure Branding, Audience, and Data Access. SpendSpeak needs only `openid`, email, and basic profile scopes.
2. Create an OAuth client with application type **Web application**.
3. In the Supabase Dashboard, open **Authentication → Providers → Google**. Copy the callback URL shown there. It normally has this form:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

4. Add that exact callback to the Google OAuth client's **Authorized redirect URIs**.
5. Paste the Google client ID and client secret into the Supabase Google provider and enable it. The secret remains in Supabase and must never be added to the mobile app.
6. In **Supabase Authentication → URL Configuration → Redirect URLs**, add the mobile callback:

   ```text
   spendspeak://auth
   ```

7. If the Google consent screen is in Testing mode, add each tester's Google account to the test-user list.
8. Set the public Supabase URL and publishable key in the app environment, apply the database migration, and create a new development build because `expo-web-browser` is a native dependency.

If Metro reports `Cannot find native module 'ExpoWebBrowser'`, the installed development APK predates the Google authentication dependency. JavaScript reloads and OTA updates cannot add native modules. Create and install a new development build; the app now defers this module so an older client shows an actionable Google-sign-in error instead of preventing routes from loading.

The mobile flow calls Supabase `signInWithOAuth` with Google, opens a protected browser session, returns through `spendspeak://auth`, exchanges the one-time PKCE code, and stores the resulting Supabase session in `expo-secure-store`. No Google refresh token or Drive scope is requested.

After successful sign-in, SpendSpeak immediately uses the existing storage flow:

- An unlinked local ledger is assigned to the authenticated Supabase user without changing record UUIDs, then uploaded through the durable outbox.
- A pristine local installation restores an existing cloud ledger.
- A device ledger already linked to another account is rejected until the user signs in with the original account or explicitly resets local data.
- Future local writes continue to commit to SQLite first and synchronize when connectivity is available.

## Edge Functions and Gemini

Set secrets on Supabase; these values never enter the mobile bundle:

```bash
npx supabase secrets set GEMINI_API_KEY=YOUR_KEY
npx supabase secrets set GEMINI_MODEL=YOUR_CONFIGURED_FREE_TIER_FLASH_MODEL
npx supabase secrets set AI_RATE_LIMIT_PER_HOUR=30
```

Deploy the functions:

```bash
npm run supabase:function:parse
npm run supabase:function:delete-account
```

Both functions validate the bearer session themselves. `parse-transcript` also caps the request at 16 KiB, validates input/output with Zod, times out the model call, atomically rate-limits by user/hour, always returns `needsConfirmation: true`, and never logs the full transcript. The model name is intentionally a secret/configuration value so it can track an available Gemini Flash free-tier model without a mobile release.

The AI contract is:

```json
{
  "transactions": [
    {
      "type": "expense",
      "amount": "1250.00",
      "currency": "PKR",
      "merchant": "Metro",
      "category": "Groceries",
      "budget": "Household food",
      "account": "Cash",
      "occurredAt": "2026-08-30T10:15:00.000Z",
      "note": null,
      "confidence": 0.94
    }
  ],
  "missingFields": [],
  "needsConfirmation": true
}
```

Unknown values must be `null`. The Edge Function and client independently reject malformed output. Model output never writes directly to SQLite.

## Synchronization behavior

1. A validated write commits to SQLite first.
2. Signed-in writes upsert one durable outbox item per entity UUID. Dependency ordering pushes profiles, accounts, transaction categories, budget categories, transactions, and budgets in that order.
3. Reconnect or manual sync reads the authenticated session and processes eligible items.
4. Before push, sync compares the remote `updated_at`; a stale local item cannot overwrite a newer cloud row.
5. Upserts use the device UUID, so retries do not duplicate records.
6. Pulls are incremental by `updated_at`, include soft-deletion tombstones, and merge remote rows locally.
7. Equal timestamps resolve deterministically to the remote row; otherwise the latest valid timestamp wins.
8. Failures remain queued with capped exponential backoff and jitter. Local work never waits for cloud success.

Signing out disables cloud AI and clears sync cursors, but preserves the ledger's account ownership and pending outbox writes. The ledger remains usable offline and resumes safely when the same account signs in again. To prevent cross-account data disclosure, switching to another account requires a deliberate local-data reset first.

## Tests

```bash
npm test
npm run test:watch
npm run check
```

The current suite has 15 suites and 84 tests covering precise amount conversion and formatting, currency precision, locale separators, relative dates/weekdays/explicit dates, timezone month bounds, many-to-many category/budget membership, automatic/explicit/excluded budget assignment, monthly overall/category budget progress, all requested voice examples, multiple transactions, deletion intent, AI schema validation, CSV escaping, repository create/edit/soft-delete/undo behavior, pristine cloud restore, outbox push/retry, incremental pull, and stale-write conflict prevention.

Native speech permissions and platform recognizer behavior must also be checked on real iOS and Android development builds. RLS isolation should be checked against a local Supabase stack or dedicated non-production project.

## Privacy decisions

- The microphone starts only after a tap and stops on Stop, Cancel, timeout, navigation, or app backgrounding.
- `recordingOptions.persist` is never enabled. SpendSpeak does not create or retain audio files.
- Voice transcripts remain in transient review state until confirmation. A confirmed voice transaction may store its original transcript for auditability.
- Cloud AI is off by default, requires sign-in, runs only when deterministic parsing is incomplete, and can be disabled in Settings.
- Production logging excludes transaction payloads, complete transcripts, auth tokens, and secrets.
- CSV export is user-initiated; the system share sheet moves that copy outside app-controlled storage.
- Local reset and cloud account deletion are separate destructive actions with confirmation.

## Project structure

```text
app/                         Expo Router screens
src/components/              Reusable accessible UI components
src/db/                      SQLite migrations and repositories
src/design/                  Theme and design tokens
src/domain/                  Types, Zod schemas, money/date/parser logic
src/features/categories/     Transaction-category UI and shared appearance fields
src/features/budgets/        Budget dashboard, management, drill-down, and components
src/providers/               App initialization and connectivity
src/services/                Auth, AI, CSV, Supabase, sync, errors
src/state/                   Ephemeral Zustand state
supabase/migrations/          Cloud schema and RLS
supabase/functions/           Protected Edge Functions
tests/unit/                   Pure domain tests
tests/integration/            Sync/outbox integration tests
```

See `codex.md` for the complete implementation plan and `docs/design-spec.md` for the visual acceptance reference.
