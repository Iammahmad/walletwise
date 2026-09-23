# WalletWise

WalletWise is a local-first money tracker for Android and iOS. It supports precise manual and reviewed voice entries, category-based monthly budgets, spending charts, separate savings history, and a standalone Splits ledger for equal expenses, loans, friend balances, and partial or full settlements.

SQLite is the immediate source of truth. An account is optional. Firebase Authentication, Firestore backup/synchronization, callable Cloud Functions, Google Sign-In, and cloud-assisted Gemini parsing are enabled only when configured.

## Current status

The v2 source is implemented and locally verified. It preserves the existing Android application ID (`com.spendspeak.app`), EAS project/slug, and SQLite filename so an installed SpendSpeak build can upgrade without losing local data. The visible product name, theme, icon, splash, and copy are WalletWise. Source changes made after preview build 5 require a new APK before device testing.

The repository is connected to Firebase project `budgetwise-f90a8`. Email/Password and Google Authentication, the protected Firestore database/rules/indexes, and the invitation Hosting site are live. Cloud Functions, Gemini, FCM v1, and physical device-to-device verification remain pending because the project is intentionally staying on Firebase's Spark plan.

The signed WalletWise **v2.0.0** Android preview APK (version code **5**) completed successfully on **2026-09-23**. It is retained locally at `releases/WalletWise-v2.0.0-build5.apk` and is also available from the [EAS artifact](https://expo.dev/artifacts/eas/aEga2DcFlev0-7gX-wjXnhwfvwWp4V6ZH1XSDy_Siis.apk). SHA-256: `42D202BA3481EABFC7DBDE1D8B38630C7EE667375F015FB3E72A3F3143822ACC`.

## Features

- Expense and income creation, editing, soft deletion, undo, search, filters, monthly navigation, grouped history, and CSV export.
- Integer-minor-unit money storage; no floating-point financial calculations.
- Reviewed voice capture using the platform recognizer. Audio is never retained.
- Deterministic English parser first; authenticated Gemini fallback is optional and Zod-validated.
- Category-based monthly budgets, automatic same-name matching, explicit alternate budget assignment, no-budget exclusion, and transaction drill-down. There is no overall monthly budget.
- Savings contributions tracked in their own SQLite table, with all-time totals and month-wise history. Savings never change income, spending, account balances, or budgets.
- Splits stored independently from the finance ledger: equal splits with exact remainder allocation, loans, friend balances, validated partial/full settlements, and settlement history.
- Signed-in users privately back up Splits under their own Firebase user tree. WhatsApp invitations and split notifications are disabled in the current release.
- Purple light/dark design tokens, dashboard donut charts, accessible labels, and large touch targets.
- About 70 category icons.

## Requirements

- Node.js 22.13 or newer.
- npm.
- Android Studio/JDK for local Android builds, or an Expo/EAS account for cloud builds.
- A development build. Expo Go is not supported because speech recognition and Google Sign-In use native modules.
- Optional: Firebase CLI access and a Firebase project for accounts, private backup, and future protected Gemini parsing.

## Install and run

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Build an Android development client:

```powershell
& "C:\Program Files\nodejs\npx.cmd" eas-cli@latest build --profile development --platform android
```

Build a directly installable preview APK:

```powershell
& "C:\Program Files\nodejs\npx.cmd" eas-cli@latest build --profile preview --platform android
```

After adding or removing native packages, permissions, config plugins, icons, or splash assets, create a new development build. A Metro reload cannot update native modules.

## Mobile environment

Copy `.env.example` to `.env` and replace the safe placeholders:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION=asia-south1
EXPO_PUBLIC_FIREBASE_FUNCTIONS_ENABLED=false

EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com

EXPO_PUBLIC_INVITE_BASE_URL=https://your-project.web.app
```

These Firebase web-app identifiers and OAuth client IDs are public configuration, not server secrets. Firestore Security Rules and authenticated callable functions provide authorization. Never add a Firebase Admin private key, Gemini key, OAuth client secret, or other private credential to an `EXPO_PUBLIC_*` variable.

Real `.env*` files, `google-services.json`, `GoogleService-Info.plist`, `.firebaserc`, service-account JSON, signing keys, local CLI token files, and credential directories are ignored by Git. Keep only `.env.example` and `.firebaserc.example` in source control. EAS builds obtain public mobile configuration from the named `preview` or `production` EAS environment; do not put real values in `eas.json`.

Because Git-ignored files are not uploaded with the repository, add `google-services.json` to EAS as a secret **file** environment variable named `GOOGLE_SERVICES_JSON` for each build environment you use (`development`, `preview`, and/or `production`). `app.config.ts` uses that generated file path on EAS and falls back to the ignored root file for local builds. This follows Expo's [file environment variable guidance](https://docs.expo.dev/eas/environment-variables/faq/#can-i-use-file-environment-variables-in-my-eas-project).

If any required Firebase web value is missing, WalletWise shows a local-only state and all local tracking remains available. Legacy `EXPO_PUBLIC_SUPABASE_*` variables are ignored and may be removed from your private `.env`.

Keep `EXPO_PUBLIC_FIREBASE_FUNCTIONS_ENABLED=false` on the Spark plan. Authentication and private Firestore backup—including Splits—continue to work, while connected invitations, push registration, and Gemini are disabled. Splits remain fully usable without those collaboration features. Change the flag only after the corresponding callable Functions are deployed and the disabled collaboration experience is intentionally re-enabled in the client.

## Firebase project setup

For a new environment:

1. Create a Firebase project and register a Web app. Copy its six public values into the ignored `.env.local` file.
2. Register the Android app and download its ignored `google-services.json` into the project root. For iOS, keep `GoogleService-Info.plist` local as well.
3. In Authentication, enable Email/Password and Google.
4. Create Firestore in the region appropriate for your users.
5. Copy `.firebaserc.example` to the ignored `.firebaserc` file and replace the project ID, or run `npm run firebase:use -- --add`.
6. Authenticate the project-scoped CLI with `npm run firebase:login`.
7. Deploy rules and indexes with `npm run firebase:deploy:rules`.
8. Deploy Authentication with `npm run firebase:deploy:auth`, then deploy Functions and Hosting as described below.

The active `budgetwise-f90a8` environment uses Firestore Standard in `asia-south1` with deletion protection. Its web and Android apps, EAS signing fingerprints, Authentication providers, Firestore rules/indexes, and Hosting invitation page are already configured.

The committed `firestore.rules` gives users access only to their own `users/{uid}` tree and read access to shared splits/connections that include their UID. Clients cannot directly write shared split, connection, or invite documents; callable functions validate those writes.

### Google Sign-In

WalletWise uses provider-native Google Sign-In and passes the resulting ID token to Firebase Authentication. It requests only identity/profile scopes and does not request Google Drive or contacts access.

Android configuration:

1. Register an Android app in Firebase using the existing package name `com.spendspeak.app`.
2. Add the SHA-1 fingerprints for the EAS development/preview signing key and, later, the Google Play app-signing key.
3. Ensure Firebase created an Android OAuth client for that package/SHA combination.
4. Create or select an OAuth Web client and set its client ID as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
5. Rebuild the development client.

iOS additionally needs an iOS OAuth client. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; `app.config.ts` derives and installs its reversed URL scheme at build time. The Google button remains disabled when required client IDs are absent.

Do not add an OAuth client secret to the app. If Android reports developer error 10, the installed APK's signing SHA-1 or package name does not match the Android OAuth client.

### Cloud Functions and Gemini

Functions are in `functions/` and use the Node.js 22 runtime. They provide:

- push-token registration;
- connection invitation creation/acceptance;
- validated, creator-authorized shared split upserts;
- authenticated/rate-limited Gemini transcript parsing;
- account deletion across private and shared records.

Cloud Functions deployment requires Firebase's Blaze plan. The current Spark configuration instead performs authenticated deletion of the user's private Firestore tree and Firebase Auth identity on the client. Connected sharing is disabled, so Spark mode does not create shared server records that would require trusted cleanup.

Configure the Gemini secret:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run firebase:secret:gemini
```

`GEMINI_MODEL` defaults to `gemini-2.5-flash-lite` and `AI_RATE_LIMIT_PER_HOUR` defaults to `30`. Firebase CLI may prompt for non-secret parameter values on deployment. Deploy with:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run firebase:deploy:functions
```

The server limits transcript/request fields, authenticates every callable request, rate-limits per user, requires structured JSON, validates model output with Zod, and never logs complete financial transcripts.

### WhatsApp invitations and Hosting (disabled)

The repository retains future invitation infrastructure, but the current app does not expose or send WhatsApp invitations. Firebase Dynamic Links is not used. If this feature is enabled in a future release, invitations use short-lived server tokens and an HTTPS Firebase Hosting URL that opens `walletwise://invite/{token}`.

Set `EXPO_PUBLIC_INVITE_BASE_URL` to the deployed Hosting origin, then deploy:

```powershell
& "C:\Program Files\nodejs\node.exe" "node_modules/firebase-tools/lib/bin/firebase.js" deploy --only hosting
```

If the HTTPS origin is omitted, WalletWise shares the custom-scheme URL directly. On devices without WhatsApp, the system share sheet is used.

### Push notifications (disabled)

The current release does not register for or send split notifications while Cloud Functions are disabled. The repository retains protected server-side notification infrastructure for a future release; no messaging or Admin secret is included in the mobile bundle.

Configure Android FCM v1 credentials for the EAS project before testing push delivery. Notification testing requires a physical device and a development/preview build; simulators and Expo Go are not sufficient for the complete path.

## Local data and synchronization

`src/db/database.ts` migrates SQLite through schema version 5. Savings, split contacts, splits, participants, and settlements use dedicated tables. They are not queried by transaction, income, account, or budget summaries. Version 5 retires legacy overall-budget rows.

Authenticated private records, including contacts, Splits, and settlements, are mirrored under `users/{uid}`. The durable SQLite outbox retries by device-generated UUID, so retries are idempotent. Reconnection or pull-to-refresh triggers synchronization; latest valid `updated_at` wins for the MVP. Signing out never disables local functionality or erases local data.

## Privacy and deletion

- Microphone capture starts only after an explicit tap and never runs continuously in the background.
- WalletWise stores transcripts only for confirmed voice-created entries; audio files are never retained.
- Cloud AI is off by default and can be disabled in Settings.
- Savings and Splits never alter the personal finance ledger.
- Local reset and cloud account deletion require confirmation.
- Cloud account deletion removes the private user tree, connections, invitations, and created shared splits; participation in another person's retained split is anonymized.
- Production logs contain error codes or hashed/non-financial identifiers, not complete transcripts or transaction payloads.

## Verification

Run the full local quality gate:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run check
& "C:\Program Files\nodejs\npm.cmd" --prefix functions run build
& "C:\Program Files\nodejs\npx.cmd" expo install --check
& "C:\Program Files\nodejs\npx.cmd" expo config --type public
```

The tests cover money parsing/formatting, dates, voice parsing, AI validation, categories, budgets, CRUD behavior, offline outbox synchronization, Firebase auth ownership, equal split remainder handling, loans/debt direction, settlements, and the savings separation contract.

Before a public release, verify on physical Android and iOS devices: pull-to-refresh, speech permissions and live transcription, Google sign-in/profile photo with each signing certificate, offline-to-online sync, two-account Firestore isolation, private Split backup/restore, partial and full settlements, account deletion, and migration from the last released APK.

## Key directories

```text
app/                         Expo Router screens
src/components/              Reusable accessible UI
src/db/                      SQLite migrations and repositories
src/domain/                  Types, Zod schemas, money/date/parser logic
src/features/savings/        Independent savings UI and repository
src/features/splits/         Split calculations, invites, UI, local/cloud merge
src/services/firebase/       Firebase JS SDK configuration
src/services/                Auth, sync, notifications, AI, CSV, errors
functions/                   Protected Firebase callable functions
firebase-hosting/public/     Invitation landing page
firestore.rules              Firestore authorization rules
firestore.indexes.json       Required composite indexes
design-review/               Interactive HTML design reference
```
