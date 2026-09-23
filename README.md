# WalletWise

WalletWise is a local-first money tracker for Android and iOS. It supports precise manual and reviewed voice entries, monthly budgets, category charts, separate savings tracking, and a standalone Splits ledger for equal expenses, loans, friend balances, settlements, WhatsApp invitations, and push notifications.

SQLite is the immediate source of truth. An account is optional. Firebase Authentication, Firestore backup/synchronization, callable Cloud Functions, Google Sign-In, and cloud-assisted Gemini parsing are enabled only when configured.

## Current status

The v2 source is implemented and locally verified. It preserves the existing Android application ID (`com.spendspeak.app`), EAS project/slug, and SQLite filename so an installed SpendSpeak build can upgrade without losing local data. The visible product name, theme, icon, splash, and copy are WalletWise.

The repository is connected to Firebase project `budgetwise-f90a8`. Email/Password and Google Authentication, the protected Firestore database/rules/indexes, and the invitation Hosting site are live. Cloud Functions, Gemini, FCM v1, and physical device-to-device verification remain pending because the project is intentionally staying on Firebase's Spark plan.

The signed WalletWise **v2.0.0** Android preview APK (version code **5**) completed successfully on **2026-09-23**. It is retained locally at `releases/WalletWise-v2.0.0-build5.apk` and is also available from the [EAS artifact](https://expo.dev/artifacts/eas/aEga2DcFlev0-7gX-wjXnhwfvwWp4V6ZH1XSDy_Siis.apk). SHA-256: `42D202BA3481EABFC7DBDE1D8B38630C7EE667375F015FB3E72A3F3143822ACC`.

## Features

- Expense and income creation, editing, soft deletion, undo, search, filters, monthly navigation, grouped history, and CSV export.
- Integer-minor-unit money storage; no floating-point financial calculations.
- Reviewed voice capture using the platform recognizer. Audio is never retained.
- Deterministic English parser first; authenticated Gemini fallback is optional and Zod-validated.
- Monthly overall and category budgets, automatic same-name matching, explicit alternate budget assignment, no-budget exclusion, and transaction drill-down.
- Savings contributions tracked in their own SQLite table. Savings never change income, spending, account balances, or budgets.
- Splits stored independently from the finance ledger: equal splits with exact remainder allocation, loans, local or connected friends, debts, settlements, and history.
- Firebase friend invitations through WhatsApp and server-generated invite tokens.
- Push notification to connected participants when a new shared split is created.
- Purple light/dark design tokens, dashboard donut charts, accessible labels, and large touch targets.
- About 70 category icons.

## Requirements

- Node.js 22.13 or newer.
- npm.
- Android Studio/JDK for local Android builds, or an Expo/EAS account for cloud builds.
- A development build. Expo Go is not supported because speech recognition and Google Sign-In use native modules.
- Optional: Firebase CLI access and a Firebase project for accounts, backup, collaboration, notifications, and Gemini parsing.

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

If any required Firebase web value is missing, WalletWise shows a local-only state and all local tracking remains available. Legacy `EXPO_PUBLIC_SUPABASE_*` variables are ignored and may be removed from your private `.env`.

Keep `EXPO_PUBLIC_FIREBASE_FUNCTIONS_ENABLED=false` on the Spark plan. Authentication and private Firestore backup continue to work, while connected invitations, shared split uploads, push registration, and Gemini are visibly disabled. Local Splits remain fully usable and separate from the finance ledger. Change the flag to `true` only after all callable Functions have deployed successfully, then rebuild the native app.

## Firebase project setup

For a new environment:

1. Create a Firebase project and register a Web app. Copy its six public values into `.env.local`.
2. In Authentication, enable Email/Password and Google.
3. Create Firestore in the region appropriate for your users.
4. Copy `.firebaserc.example` to `.firebaserc` and replace the project ID, or run `npm run firebase:use -- --add`.
5. Authenticate the project-scoped CLI with `npm run firebase:login`.
6. Deploy rules and indexes with `npm run firebase:deploy:rules`.
7. Deploy Authentication with `npm run firebase:deploy:auth`, then deploy Functions and Hosting as described below.

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

### WhatsApp invitations and Hosting

Firebase Dynamic Links is not used. Invitations are short-lived server tokens sent as an HTTPS Firebase Hosting URL. The landing page opens `walletwise://invite/{token}` in the installed app.

Set `EXPO_PUBLIC_INVITE_BASE_URL` to the deployed Hosting origin, then deploy:

```powershell
& "C:\Program Files\nodejs\node.exe" "node_modules/firebase-tools/lib/bin/firebase.js" deploy --only hosting
```

If the HTTPS origin is omitted, WalletWise shares the custom-scheme URL directly. On devices without WhatsApp, the system share sheet is used.

### Push notifications

WalletWise obtains an Expo Push Token on a physical signed-in device and sends it to an authenticated callable function. New-split notifications are sent server-side, so no messaging or Admin secret is included in the mobile bundle.

Configure Android FCM v1 credentials for the EAS project before testing push delivery. Notification testing requires a physical device and a development/preview build; simulators and Expo Go are not sufficient for the complete path.

## Local data and synchronization

`src/db/database.ts` migrates SQLite through schema version 4. Savings, split contacts, splits, participants, and settlements use dedicated tables. They are not queried by transaction, income, account, or budget summaries.

Authenticated private records are mirrored under `users/{uid}`. Shared splits live under `splits/{id}` and include participant UIDs. The durable SQLite outbox retries by device-generated UUID, so retries are idempotent. Reconnection triggers a sync; latest valid `updated_at` wins for the MVP. Signing out never disables local functionality or erases local data.

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

Before a public release, verify on physical Android and iOS devices: speech permissions and live transcription, Google sign-in with each signing certificate, offline-to-online sync, two-account Firestore isolation, connection acceptance, cross-device split delivery, notification taps, invitation links, account deletion, and migration from the last released APK.

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
