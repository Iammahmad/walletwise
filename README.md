# SpendSpeak

SpendSpeak is a local-first personal money tracker for iOS and Android. It records expenses and income manually or from reviewed English voice commands, stores the ledger in SQLite, and keeps optional Supabase backup, synchronization, authentication, and Gemini-assisted parsing behind explicit user choices.

## What is implemented

- First-run selection of currency, locale, and timezone with seeded Cash/Bank accounts and default categories.
- Precise integer-minor-unit money storage and locale-aware display.
- Manual expense/income creation, editing, soft deletion, undo, search, filters, date grouping, and CSV export.
- Home totals, remaining monthly budget, category breakdown, recent transactions, and offline feedback.
- Monthly overall and per-category budgets.
- Native iOS `SFSpeechRecognizer` and Android `SpeechRecognizer` integration through `expo-speech-recognition`.
- Explicit voice permission/listening/processing/review/error states, interim transcript, Stop/Cancel, silence timeout, lifecycle cleanup, and no audio persistence.
- Deterministic English parsing for amounts, currencies, intent, categories, merchants, accounts, relative/explicit dates, multiple transactions, and reviewed deletion commands.
- Mandatory editable review before every voice-created write.
- Optional Supabase email authentication, secure session storage, durable SQLite outbox, reconnect/manual sync, idempotent UUID upserts, tombstones, and latest-`updated_at` conflict handling.
- Optional authenticated Gemini parsing through a protected Edge Function with strict schemas, request limits, timeout, server-side rate limiting, and redacted logs.
- Complete RLS policies, protected account deletion, local reset, light/dark themes, accessibility labels, dynamic-text-friendly layouts, and reduced decorative motion.

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

The speech config plugin adds `RECORD_AUDIO` and speech-service package visibility on Android, plus microphone and speech-recognition usage descriptions on iOS. Any permission/plugin change requires a new native binary.

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

Generated `android/` and `ios/` directories are intentionally ignored. Expo Continuous Native Generation recreates them from `app.json` and the installed config plugins.

## Environment variables

Copy `.env.example` to `.env` and set the public mobile values only if cloud features are wanted:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

When either value is absent, SpendSpeak visibly runs in local-only mode. Do not place a service-role key or Gemini key in `.env`, `app.json`, EAS public variables, or any `EXPO_PUBLIC_*` value.

## Local database

`src/db/database.ts` opens `spendspeak.db`, enables WAL and foreign keys, runs numbered migrations, and seeds idempotently. SQLite remains the immediate UI source even for signed-in users.

Local records contain:

- Device-generated UUIDs shared with cloud rows.
- Nullable authenticated `user_id` and a stable `local_owner_id`.
- `updated_at`, `deleted_at`, `sync_status`, `local_updated_at`, and `last_synced_at` metadata.
- A durable `sync_outbox` with retry count, backoff timestamp, and error code.

Financial values use integer `amount_minor`. Decimal text is parsed with string/`BigInt` arithmetic and checked against currency precision before conversion to a safe JavaScript integer.

## Supabase setup

Initialize/link the project if needed, then apply the committed migration:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migration at `supabase/migrations/202608300001_initial_schema.sql` creates profiles, accounts, categories, transactions, budgets, protected AI rate limits, indexes, ownership triggers, timestamp triggers, and RLS.

Every user-data table enables RLS and has explicit select/insert/update/delete policies requiring `user_id = auth.uid()`. Additional triggers reject transaction or budget relationships whose account/category belongs to another user.

For local Supabase development:

```bash
npx supabase start
npx supabase db reset
```

Use two disposable test users to verify that cross-user select, insert, update, and delete operations are denied before deploying to production.

## Edge Functions and Gemini

Set secrets on Supabase; these values never enter the mobile bundle:

```bash
npx supabase secrets set GEMINI_API_KEY=YOUR_KEY
npx supabase secrets set GEMINI_MODEL=YOUR_CONFIGURED_FREE_TIER_FLASH_MODEL
npx supabase secrets set AI_RATE_LIMIT_PER_HOUR=30
```

Deploy the functions:

```bash
npx supabase functions deploy parse-transcript
npx supabase functions deploy delete-account
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
2. Signed-in writes upsert one durable outbox item per entity UUID.
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

The current suite covers precise amount conversion and formatting, currency precision, locale separators, relative dates/weekdays/explicit dates, timezone month bounds, category mapping, all requested voice examples, multiple transactions, deletion intent, AI schema validation, CSV escaping, repository create/edit/soft-delete/undo behavior, pristine cloud restore, outbox push/retry, incremental pull, and stale-write conflict prevention.

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
src/providers/               App initialization and connectivity
src/services/                Auth, AI, CSV, Supabase, sync, errors
src/state/                   Ephemeral Zustand state
supabase/migrations/          Cloud schema and RLS
supabase/functions/           Protected Edge Functions
tests/unit/                   Pure domain tests
tests/integration/            Sync/outbox integration tests
```

See `codex.md` for the complete implementation plan and `docs/design-spec.md` for the visual acceptance reference.
