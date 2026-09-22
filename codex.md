# SpendSpeak MVP Implementation Plan

## 1. Objective and delivery standard

Build a production-quality, local-first personal finance mobile application using React Native, TypeScript, and the latest stable Expo SDK selected at implementation time. The application must remain fully useful without an account, store financial records locally in SQLite, support reviewed voice entry through native speech recognition, and optionally provide Supabase authentication, backup, synchronization, and protected Gemini-assisted parsing.

The implementation will proceed in eight vertical slices. A slice is complete only when its user flow works end to end, TypeScript passes in strict mode, relevant automated tests pass, and failure/disabled states are handled visibly. No placeholder controls or silently mocked production paths will be left in the completed MVP.

## 2. Product invariants

These constraints apply to every slice:

- SQLite is the primary runtime data source and all normal writes update local state first.
- Local-only users retain manual entry, deterministic voice parsing, budgets, search, filtering, and export.
- Voice recognition begins only after an explicit tap, never runs in the background, and no audio is retained.
- A voice-created transaction is never persisted before the user reviews and explicitly confirms it.
- Money is stored and calculated as integer minor units. Decimal strings are converted with currency-specific precision; JavaScript floating-point arithmetic is not used for financial calculations.
- Device-generated UUIDs are used locally and remotely to make retries idempotent.
- Dates are stored as ISO 8601 instants and interpreted/displayed using the configured locale and timezone.
- Cloud AI is opt-in, requires an authenticated session, can be disabled in Settings, and is never required for ordinary app use.
- Raw AI output is untrusted. It must pass a strict Zod schema before it can populate a review draft.
- Secrets stay server-side. The mobile app may contain only public Expo configuration and a Supabase publishable key protected by RLS.
- User-data tables use soft deletion and synchronization metadata. Destructive reset/deletion actions require confirmation.
- Accessibility, light/dark themes, large touch targets, explicit empty/loading/offline/error states, and centralized error handling are part of each feature rather than a final retrofit.

## 3. Design direction

Design SpendSpeak as a clean, minimal, modern, and trustworthy personal-finance application for iOS and Android. The interface should feel calm and effortless rather than dense, corporate, or overly playful. Prioritize clarity, generous spacing, strong visual hierarchy, and fast one-handed entry.

### Visual style

- Use a warm off-white background in light mode and a deep charcoal background in dark mode.
- Use a restrained emerald green as the primary brand and positive-finance color.
- Use amber, coral, blue, and violet only as subtle category accents.
- Avoid excessive gradients, glass effects, shadows, borders, and decorative illustrations.
- Prefer softly rounded cards with approximately 16-20 px corner radii.
- Use subtle borders or tonal differences to separate surfaces.
- Keep shadows soft and limited to floating controls such as the voice button.
- Use one consistent outline icon family.
- Give important numbers more emphasis than labels or decorative elements.

### Typography

Use a modern system-native sans-serif typeface for excellent readability and platform familiarity.

- Make monthly totals large, confident, and easy to scan.
- Keep section headings compact and semibold.
- Use muted colors for supporting labels without reducing readability.
- Use tabular numerals where available so financial values align correctly.
- Format currencies and dates according to the user's locale.
- Never hard-code a currency symbol.

### Layout

Use an 8-point spacing system with generous page margins and consistent alignment.

- Keep primary information near the top of each screen.
- Avoid overcrowding dashboards with unnecessary statistics.
- Reveal secondary information progressively.
- Keep the most common actions reachable with one hand.
- Use touch targets of at least 44 x 44 points.
- Respect device safe areas and platform navigation conventions.

### Home screen

The Home screen should feel useful within one glance and include:

- A friendly but restrained greeting.
- Current-month spending as the main visual focus.
- Income and remaining budget as secondary information.
- One simple category-spending visualization with accessible labels and a readable text alternative.
- A short recent-transactions list.
- A highly visible floating microphone button.
- A secondary manual-entry action.

Do not display too many charts. Prefer one useful visualization over multiple decorative charts.

### Transactions

Transaction rows should be compact but easy to understand. Each row should show:

- A category icon in a softly colored circular container.
- Merchant or transaction title.
- Category and date as secondary information.
- A right-aligned amount.
- Different but accessible treatment for expenses and income that does not rely on color alone.

Group transactions by date and provide clean search and filter controls. Avoid placing every possible action directly in each row; reveal secondary actions progressively.

### Voice experience

Make voice entry the application's signature interaction. The microphone button should be prominent, inviting, and immediately understandable.

Provide visually distinct states for:

- Ready.
- Requesting permission.
- Listening.
- Processing.
- Needs clarification.
- Ready for review.
- Error.

While listening:

- Display the live transcript prominently.
- Use a subtle pulse or waveform animation around the microphone.
- Provide clear Stop and Cancel actions.
- Avoid distracting full-screen animation.
- Never save automatically.

After interpretation, show a clean review card containing amount, category, merchant, account, and date. Highlight missing or uncertain fields gently and explain them clearly. Make Confirm Entry the dominant action.

### Forms

Forms should feel lightweight rather than administrative.

- Use clear labels that remain visible while typing.
- Choose appropriate numeric, date, and text keyboards.
- Show the currency beside the amount field.
- Use category and account selection sheets instead of long dropdowns.
- Place the primary save action consistently.
- Validate fields near the relevant input.
- Preserve entered information when validation fails.

### Motion and feedback

Use motion only to explain state changes.

- Use short, subtle transitions.
- Animate totals only when it improves comprehension.
- Provide gentle haptic feedback when recording begins, stops, or an entry is confirmed.
- Respect reduced-motion accessibility settings.
- Avoid looping animation outside the active listening state.

### Accessibility

- Meet WCAG AA color contrast where applicable.
- Do not communicate meaning through color alone.
- Support dynamic text sizing.
- Add descriptive accessibility labels to icons and microphone states.
- Keep touch targets at least 44 x 44 points.
- Ensure charts have readable text alternatives.
- Support light and dark themes from the first implementation.

### Design consistency

Create reusable design tokens for:

- Colors.
- Typography.
- Spacing.
- Corner radii.
- Borders.
- Shadows.
- Motion durations.

Create reusable components for:

- Screen container.
- Financial summary card.
- Transaction row.
- Category icon.
- Amount input.
- Primary and secondary buttons.
- Empty state.
- Error state.
- Filter chip.
- Voice button.
- Voice status panel.
- Review field.
- Confirmation sheet.

Do not introduce one-off colors, spacing values, or button styles when an existing token or component can be reused.

### Design process

Before implementing the full application:

1. Define the design tokens.
2. Create representative mockups for Home, Transactions, Manual Entry, Voice Listening, and Voice Review.
3. Check layouts at small and large mobile screen sizes.
4. Verify light mode, dark mode, dynamic text, empty states, errors, and long merchant names.
5. Establish the approved components in a reusable design system.
6. Implement the application using those components.
7. Compare running screens against the approved direction and iterate until they are visually consistent.

The final result should feel polished and distinctive without looking busy. Favor clarity, speed, trust, and ease of use over decoration.

## 4. Proposed architecture

### Application layers

- `app/`: Expo Router routes and route-level layouts only.
- `src/components/`: reusable visual components, form fields, feedback states, and accessibility wrappers.
- `src/design/`: color, spacing, typography, radius, elevation, and theme tokens consumed through `StyleSheet`.
- `src/features/`: feature modules for onboarding, transactions, home, voice, budgets, settings, authentication, export, and sync.
- `src/db/`: SQLite connection, migrations, repositories, seed data, and transaction boundaries.
- `src/domain/`: domain types, Zod schemas, money/date utilities, validation, and pure calculations.
- `src/services/`: speech adapter, Supabase client, connectivity, CSV sharing, and centralized logging/error reporting.
- `src/sync/`: durable outbox, pull/push coordinator, conflict resolution, and sync status.
- `src/state/`: small Zustand stores for session-independent UI/application state; persisted finance records do not live primarily in Zustand.
- `src/i18n/`: locale configuration and English parser lexicon with extension points for future languages.
- `supabase/migrations/`: cloud schema, triggers, indexes, and RLS policies.
- `supabase/functions/parse-transcript/`: authenticated Edge Function for optional Gemini structured parsing.
- `tests/`: shared fixtures, database helpers, integration tests, and test setup.

### State and data flow

1. UI submits a validated command to a feature service.
2. The service writes to SQLite in a database transaction and adds/updates an outbox record when cloud sync is applicable.
3. Queries re-read local SQLite and update the UI immediately.
4. When authenticated and online, the sync coordinator pushes idempotent changes and pulls remote changes.
5. Conflict resolution accepts the latest valid `updated_at`, preserves soft deletions, and records sync errors for retry rather than blocking local work.

Zustand will hold ephemeral state such as onboarding progress, selected filters, voice-session state, theme preference, and sync UI state. SQLite remains authoritative for accounts, categories, transactions, budgets, and the local profile.

### Money representation

- Persist `amount_minor` and balances as integers safe for the supported storage range.
- Maintain a currency metadata table/map containing ISO code and minor-unit digits.
- Accept decimal strings at boundaries, normalize locale separators conservatively, and convert using string arithmetic or a decimal-safe routine.
- Format values with `Intl.NumberFormat` using the user currency and locale; never concatenate a hard-coded currency symbol.
- Reject excess fractional digits or require explicit correction rather than rounding silently.

### Local identity

Local-only rows need a stable ownership namespace before a Supabase user exists. The local database will store a generated installation/profile UUID as `local_owner_id`. Domain repositories will expose ownership without pretending this is an authenticated Supabase UUID. On first sign-in, an explicit adoption/link step will associate eligible local rows with `auth.uid()` and enqueue them for upload without changing their primary IDs.

## 5. Database design

### Local tables

Create versioned SQLite migrations for:

- `local_profile`: local owner ID, default currency, locale, timezone, onboarding state, cloud AI preference, theme preference, timestamps.
- `accounts`: requested account fields plus `local_owner_id`, nullable `user_id`, `sync_status`, `local_updated_at`, and `last_synced_at`.
- `categories`: requested category fields plus ownership and synchronization metadata.
- `transactions`: requested transaction fields plus ownership and synchronization metadata.
- `budgets`: requested budget fields plus ownership and synchronization metadata.
- `sync_outbox`: operation ID, entity type, entity ID, operation/upsert intent, payload/version metadata, attempt count, next retry time, last error code, and timestamps.
- `sync_state`: per-user/per-table cursor or last successful pull timestamp and current status.
- `app_meta`: schema version and migration metadata if not fully covered by SQLite facilities.

Use foreign keys, indexes for common filters and ordering, and constraints for enums and non-negative amounts. Store nullable deleted timestamps rather than removing synchronized records. Repository queries exclude soft-deleted rows by default.

### Cloud tables

Create Supabase equivalents for `profiles`, `accounts`, `categories`, `transactions`, and `budgets` with:

- UUID primary keys where applicable.
- `user_id uuid not null` referencing `auth.users` with an intentional deletion strategy.
- `bigint` for minor-unit monetary values.
- `timestamptz` for event and audit timestamps.
- Enum/check constraints matching validated client domain values.
- Indexes on `user_id`, `updated_at`, `deleted_at`, and transaction query dimensions.
- An `updated_at` trigger controlled by the database, while allowing synchronization conflict comparisons.
- RLS enabled on every table and explicit select/insert/update/delete policies requiring `user_id = auth.uid()`; inserts also enforce ownership with `WITH CHECK`.

Deletion of remote records will normally be represented by `deleted_at` so all devices observe the tombstone. Account deletion will use a protected server-side flow that removes user data and then the auth identity.

## 6. Voice parsing pipeline

The voice feature will be implemented as a state machine:

`idle -> requestingPermission -> listening -> processingTranscript -> interpreting -> needsClarification | readyForReview | error`

Cancel returns safely to idle without preserving audio. Stop finalizes the available transcript. A silence timeout stops recognition after a documented, configurable interval.

Parsing order:

1. Normalize transcript text without destroying the original transcript.
2. Split likely multi-transaction utterances while preserving shared context such as date, account, and currency.
3. Extract transaction intent, decimal amount strings, currency words/codes, account phrases, merchants, category terms, and temporal phrases.
4. Resolve `today`, `yesterday`, weekday names, and explicit dates in the configured timezone.
5. Map category synonyms through a locale-specific English lexicon.
6. Produce one or more typed draft transactions with per-field confidence and missing-field metadata.
7. If drafts are incomplete and cloud AI is enabled, authenticated, and online, offer/use the Edge Function according to the documented preference and privacy UI.
8. Validate AI JSON, merge only safe fields into drafts, and show the review screen.
9. If interpretation fails, retain the transcript in memory/on the draft route and open editable manual fields. Do not write a transaction until confirmation.

Deletion commands such as “Delete the coffee expense I added a minute ago” are treated as a separate reviewed action: resolve a likely local candidate, show the exact transaction and confidence, require confirmation, then soft-delete with undo support. Ambiguous matches require the user to select a transaction.

## 7. Edge Function contract and protections

The `parse-transcript` Edge Function will:

- Require and verify a valid Supabase bearer session.
- Reject unsupported methods, malformed JSON, and requests above a small documented byte limit.
- Validate request fields such as transcript, locale, timezone, allowed currencies, accounts, and categories with Zod.
- Apply basic per-user rate limiting using a durable server-side store or database table/RPC suitable for Supabase Edge Functions.
- Read the Gemini API key and configurable Flash model name only from Edge Function secrets.
- Request structured JSON matching the specified transaction contract.
- Instruct the model never to invent amounts, dates, merchants, currencies, accounts, or categories and to return `null` for unknown values.
- Validate and normalize the model response before returning it; reject extra/invalid structures.
- Return `needsConfirmation: true` in all successful parse responses.
- Avoid production logs containing full transcripts or financial payloads; log only request IDs, timing, result category, and redacted errors.

The client independently validates the response with the same contract and converts accepted decimal strings to integer minor units only during review validation.

## 8. Vertical implementation slices

### Slice 1: Project setup, design system, navigation, and SQLite

Deliverables:

- Initialize the latest stable Expo TypeScript project compatible with required native modules and record selected versions in the lockfile and README.
- Enable strict TypeScript and linting/formatting with scripts suitable for CI.
- Configure Expo Router with onboarding routes and bottom tabs: Home, Transactions, Add, Budgets, Settings.
- Configure a custom Expo development build; do not present Expo Go as a supported speech workflow.
- Add iOS speech-recognition and microphone usage descriptions and Android microphone permission/plugin configuration required by the selected maintained native recognition package.
- Establish design tokens, theme provider, safe-area layout, reusable buttons/cards/feedback components, and accessible touch target conventions.
- Create and review representative mockups for Home, Transactions, Manual Entry, Voice Listening, and Voice Review at small and large mobile sizes before expanding feature implementation.
- Verify the foundational design system in light/dark mode, with dynamic text, long content, reduced motion, and representative empty/error states.
- Create SQLite bootstrap, transactional versioned migrations, repositories, UUID generation, and seeded default accounts/categories.
- Implement onboarding for currency, locale, timezone, local-only continuation, and the explanation of backup/sync benefits.
- Add an application error boundary, async error normalization, and friendly database initialization failure UI.

Acceptance checks:

- A fresh install completes onboarding and creates Cash, Bank, and all requested categories using the selected currency.
- Relaunch preserves settings and does not duplicate seed records.
- Tabs are usable in light and dark themes with screen readers and large touch targets.
- Representative screens follow the approved visual direction and reuse tokens/components without one-off styling.
- Typecheck, lint, migration tests, and onboarding/repository tests pass.

### Slice 2: Manual transaction entry and transaction list

Deliverables:

- Build a validated manual form for expense/income, decimal amount, currency, category, merchant, account, date/time, and note.
- Convert amounts to minor units at the boundary and reject invalid currency precision.
- Create a searchable transaction list with daily/monthly grouping and filters for date, category, account, and type.
- Add edit, soft-delete, and time-limited undo flows.
- Display `manual` or `voice` source visibly and accessibly.
- Implement query empty/loading/error states and efficient indexed SQLite queries.

Acceptance checks:

- Create, edit, delete, restore, search, and filter work after relaunch.
- Invalid forms never write partial rows.
- Unit tests cover money conversion/formatting; integration tests cover create/edit/delete/undo.
- Typecheck, lint, and relevant tests pass.

### Slice 3: Home dashboard and calculations

Deliverables:

- Query month-to-date expense and income totals using the configured timezone.
- Display remaining overall monthly budget when configured.
- Display recent transactions and spending by category with accessible labels and a non-chart fallback/list.
- Add prominent microphone and quick manual expense actions wired to real routes.
- Add skeleton/loading, empty, offline, and recoverable error states.

Acceptance checks:

- Totals exclude soft-deleted records and handle month/timezone boundaries correctly.
- Calculations use integer minor units throughout.
- Dashboard query/calculation tests and UI state tests pass with typecheck and lint.

### Slice 4: Native speech recognition and transcript review

Deliverables:

- Select and configure a maintained Expo-compatible native speech package backed by iOS `SFSpeechRecognizer` and Android `SpeechRecognizer`.
- Add a speech adapter so platform APIs are isolated and testable.
- Implement the explicit-tap voice state machine, permission request, interim transcript, recording indicator, Stop/Cancel, silence timeout, and cleanup on navigation/backgrounding.
- Provide graceful screens/actions for denied, restricted, and unavailable recognition states.
- Implement review UI for one or multiple drafts, allowing all requested fields to be edited and low-confidence/missing fields to be highlighted.
- Add an accessible microphone state announcement.

Acceptance checks:

- Native development builds request correct platform permissions and can capture interim/final transcripts on supported devices.
- Cancel never creates a record; final transcription always enters review before save.
- Lifecycle, permission, state-machine, and review-confirmation tests pass.
- Typecheck, native configuration validation, and relevant tests pass.

### Slice 5: Deterministic local voice parser

Deliverables:

- Implement an English parser with locale-extensible lexicons and pure parsing stages.
- Recognize common expense/income phrases, decimal and grouped amounts, ISO currency codes/currency names, merchants, categories, accounts, relative/explicit dates, and shared context.
- Support multiple transactions in one utterance.
- Calculate per-field confidence and missing fields.
- Resolve deletion commands against recent local records and require reviewed confirmation.
- Preserve the original transcript only as the nullable transaction field after user confirmation; never store audio.

Acceptance checks:

- The five example commands produce correct drafts/actions for an appropriate configured PK locale/currency while remaining configuration-driven.
- Tests cover amount parsing, currency precision, relative dates/timezones, weekdays, explicit dates, category mapping, income/expense intent, multi-transaction splitting, ambiguity, and deletion candidate selection.
- Typecheck, lint, and the full parser suite pass.

### Slice 6: Optional Gemini parsing through a Supabase Edge Function

Deliverables:

- Define shared-equivalent strict Zod request/response schemas for the stated AI contract.
- Implement the authenticated Edge Function, structured Gemini JSON request, non-invention prompt, response validation, redacted logging, size limit, timeout, rate limit, and stable error codes.
- Add client invocation only for incomplete local results when cloud AI is enabled and a valid session/network are available.
- Merge validated suggestions into review drafts without overwriting higher-confidence deterministic fields unexpectedly.
- Provide explicit disabled/signed-out/offline/rate-limited states and a manual completion path.

Acceptance checks:

- Invalid or adversarial model output cannot reach SQLite.
- No API secret is present in the bundle or committed configuration.
- Tests cover AI schema acceptance/rejection, null unknowns, request limits, auth rejection, merge policy, and graceful fallback.
- Typecheck, Edge Function checks/tests, and client tests pass.

### Slice 7: Supabase authentication, RLS, and synchronization

Deliverables:

- Add optional sign-up/sign-in/session handling with secure token persistence appropriate to Expo.
- Implement local-data adoption on first sign-in and retain a clear local-only path.
- Add cloud migrations, constraints, indexes, triggers, complete RLS policies, and policy verification tests.
- Implement durable outbox push, incremental pull, idempotent upserts by device UUID, network-triggered/manual sync, exponential backoff with jitter, and retry-safe tombstones.
- Implement latest-valid-`updated_at`-wins conflict handling with clock/validation safeguards and deterministic tie behavior.
- Expose sync status and actionable errors in Settings without blocking local writes.

Acceptance checks:

- Local writes succeed offline and enqueue once; retries do not duplicate transactions.
- Reconnection synchronizes creates, edits, and deletions across test clients.
- A user cannot read or mutate another user’s rows under RLS.
- Signing out leaves local functionality intact and does not leak a prior user’s cloud data into another session.
- Integration tests cover offline queue, retries, adoption, conflicts, sync, session transitions, and RLS.
- Typecheck, lint, migrations, and relevant tests pass.

### Slice 8: Budgets, CSV export, settings, tests, and polish

Deliverables:

- Add overall and per-category monthly budgets with create/edit/soft-delete and currency validation.
- Add CSV export for filtered/all transactions with stable headings, correct escaping, locale-independent machine-readable values, and native share/save handling.
- Complete Settings for currency/locale/timezone, theme, cloud AI toggle, authentication, sync status/manual retry, privacy information, local reset, and account/data deletion.
- Ensure changing defaults does not silently reinterpret historical transaction currency or instants.
- Complete accessibility audit, keyboard/form behavior, error/empty/loading/offline polish, performance checks, and production-safe logging.
- Add README instructions for prerequisites, environment variables, development builds, native permissions, migrations, RLS, Edge Function secrets/deployment, testing, release builds, and privacy decisions.
- Add CI for install, typecheck, lint, unit/integration tests, and migration/schema validation.

Acceptance checks:

- Budgets affect Home accurately and survive offline/sync flows.
- CSV output opens correctly and contains no soft-deleted rows unless explicitly requested by a documented recovery export.
- Local reset and account deletion require explicit confirmation and have clear consequences.
- All required unit/integration suites pass, the app builds as a native development build, and no placeholder actions remain.

## 9. Test strategy

### Unit tests

- Decimal string to minor-unit conversion across zero-, two-, and three-decimal currencies.
- Locale-aware input normalization without ambiguous silent conversions.
- Relative dates, weekdays, explicit dates, DST/timezone boundaries.
- Category/account synonym mapping and confidence scoring.
- Expense/income intent and multi-transaction parsing.
- AI response Zod validation, including unknown keys, invalid enums, unsafe numbers, malformed dates, and out-of-range confidence.
- Dashboard totals, budgets, conflict comparison, CSV escaping, and redaction utilities.

### Component tests

- Manual and review form validation.
- Voice state and accessibility announcements.
- Empty/loading/offline/error states.
- Filters, deletion confirmation, undo, and sync status.

### Integration tests

- SQLite migration and idempotent seeding.
- Create, edit, soft-delete, and restore transactions.
- Durable outbox behavior across simulated restarts.
- Offline writes, reconnect, retry, and duplicate prevention.
- Pull/push conflicts and tombstones.
- Authentication transitions and local-data adoption.
- RLS isolation using two test users in a dedicated test project or local Supabase stack.

### Device verification

- iOS and Android native development builds.
- Permission grant, denial, restricted/unavailable recognition, interruption, and silence timeout.
- No background listening and no retained audio.
- Voice review on small/large screens, light/dark mode, and screen reader.
- Offline cold start, manual operation, and deterministic parsing.

## 10. Configuration and secrets

Document and validate environment variables at startup/build time. Expected categories include:

- Public mobile configuration: Supabase URL and publishable key, plus non-secret feature flags.
- Edge Function secrets: Gemini API key, configurable Gemini Flash model identifier, and rate-limit configuration.
- Test-only configuration: local Supabase/test project endpoints and disposable test credentials where required.

Commit an example environment file containing names and safe placeholders only. Missing Supabase configuration must put the app into a clearly labeled local-only mode. Missing Gemini configuration must disable cloud parsing with an actionable server/client error while deterministic parsing continues to work.

## 11. Privacy and security review checklist

- Confirm no service-role or Gemini key appears in the mobile source, bundle, repository history added by this work, logs, or tests.
- Confirm all cloud user tables have RLS enabled and policies cover select, insert, update, and delete ownership.
- Confirm Edge Function authentication, input limits, rate limiting, schema validation, timeouts, and redacted logging.
- Confirm microphone access is tap-initiated, visually indicated, cancellable, and stopped on lifecycle changes.
- Confirm no audio files/blobs are created or retained.
- Confirm transcript persistence occurs only with a confirmed voice-created transaction and can be removed through edit/delete/reset/account deletion flows.
- Confirm exports are user-initiated and communicate that exported files leave app-controlled storage.
- Confirm reset/account deletion has destructive-action confirmation and reports completion/failure accurately.

## 12. Execution protocol for each slice

For every slice:

1. Inspect the current worktree and preserve unrelated user changes.
2. Select compatible stable dependency versions and record material choices.
3. Implement the smallest end-to-end usable increment, including failure states.
4. Add or update automated tests alongside behavior.
5. Run formatting/linting, strict typecheck, and targeted tests.
6. Run the broader regression suite when shared domain/database code changes.
7. Verify the user-visible flow in the appropriate runtime; native speech changes require development-build/device verification.
8. Update README/setup notes and this plan if implementation discoveries change a material decision.
9. Report files changed, verification performed, and any credential/device-dependent verification still required.

## 13. Definition of done

The MVP is complete when all eight slices meet their acceptance checks; local-only use works end to end without credentials; both manual and voice entries require valid reviewed data; optional authenticated AI and synchronization fail safely; migrations and RLS are reproducible; native development builds are documented; required automated tests pass; privacy/security checks are satisfied; and the README enables another developer to configure, test, and deploy the project without undocumented steps.

## 14. Current implementation status

Status updated: **2026-08-31**

All eight vertical slices are implemented in the repository. SpendSpeak is usable as a local-only application without Supabase credentials. Cloud authentication, backup, synchronization, and Gemini parsing are implemented behind documented environment configuration and fail into explicit disabled/local-only states when credentials are absent.

### Slice completion record

| Slice                             | Status                                              | Implemented result                                                                                                                                                                                                                                  |
| --------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Foundation                     | Complete                                            | Expo SDK 57, strict TypeScript, Expo Router, light/dark design tokens, reusable UI, SQLite migrations, onboarding, configurable currency/locale/timezone, seeded Cash/Bank accounts, and default categories.                                        |
| 2. Transactions                   | Complete                                            | Manual expense/income creation, editing, soft deletion, undo, search, filters, date grouping, source labels, and validated precise-money entry.                                                                                                     |
| 3. Home                           | Complete                                            | Month expense/income totals, remaining overall budget, recent transactions, category spending, quick manual entry, microphone entry, and empty/loading/offline/error handling.                                                                      |
| 4. Native voice                   | Complete in code; device verification ongoing       | Native `SFSpeechRecognizer`/Android `SpeechRecognizer`, development-build configuration, permission handling, interim transcript, recording controls, silence handling, lifecycle cleanup, processing states, and mandatory review.                 |
| 5. Local parser                   | Complete                                            | English expense/income commands, digit and spoken-number amounts, currencies, accounts, merchants, categories, multiple transactions, reviewed delete commands, relative dates, weekdays, ordinal dates, month names, and validated explicit dates. |
| 6. Optional AI                    | Complete in code; deployment verification pending   | Authenticated Supabase Edge Function, Gemini structured JSON, non-invention prompt, Zod validation, request limit, rate limiting, redacted logging, timeout/error handling, and safe client fallback.                                               |
| 7. Auth and sync                  | Complete in code; live project verification pending | Optional email/password and Google PKCE auth, secure session storage, SQLite outbox, offline writes, retry-safe UUID upserts, incremental pulls, tombstones, timestamp conflict handling, manual/reconnect sync, RLS migration, and sync state UI.  |
| 8. Budgets/settings/export/polish | Complete                                            | Overall and per-category budgets, category budget dashboard, CSV export/share, theme and privacy settings, local reset/account deletion confirmations, custom categories, tests, and setup/privacy documentation.                                   |

### Implemented user flows

- Onboarding collects default currency, locale, and timezone, seeds initial accounts/categories, and permits local-only continuation.
- Bottom navigation provides Home, Transactions, Add, Budgets, and Settings.
- Transactions can be created, edited, searched, filtered, soft-deleted, restored, and exported without an account.
- Home calculations use integer minor units and exclude soft-deleted records.
- Voice capture starts only after a tap, never continuously listens, never stores audio, and never writes before an editable review and explicit confirmation.
- Deterministic parsing runs first. Optional cloud parsing is used only when enabled and available.
- SQLite remains authoritative for immediate UI behavior. Eligible remote writes use a durable outbox and device-generated UUIDs.
- Missing cloud credentials do not disable local transaction, budget, parser, category, or export features.

### Post-MVP improvements and fixes

- Fixed the Android runtime crash caused by passing `BigInt` to `Intl.NumberFormat.formatToParts`; money remains stored/calculated in integer minor units while formatting uses a compatible exact-parts path.
- Hardened native transcript finalization so recognition no longer remains indefinitely on **Processing transcription** when Android delivers delayed or partial end events.
- Improved transcript assembly and speech-session cleanup for more reliable interim/final text. Recognition accuracy still depends on the operating system recognizer, microphone, accent, and ambient noise.
- Added parsing for phrases such as “on the first of this month,” ordinal day expressions, month-name dates, and validated specific dates in the configured timezone.
- Added spoken-number handling and expanded parser coverage without making cloud AI mandatory.
- Added a dedicated monthly budget dashboard showing overall and per-category limits, spent amounts, remaining amounts, progress, and over-budget states.
- Added user-created expense and income categories with validation, duplicate prevention, SQLite persistence, and sync outbox support.
- Kept category management intentionally located at **Settings → Categories → New**. Custom categories become available in transaction forms, budget selection, and direct-name voice matching.
- Made transaction category/account data refresh after repository changes so new categories appear without restarting the app.
- Added Google sign-in through Supabase OAuth using a secure browser session, the existing `spendspeak://auth` callback, PKCE code exchange, strict callback-address validation, cancellation handling, and the same local-ledger adoption/cloud-restore safeguards used by email authentication.
- Kept Google limited to identity scopes. Financial data continues to live in SQLite first and in per-user RLS-protected Supabase rows when synchronization is enabled; no Google Drive scope or storage path is used.

### Current verification snapshot

The following checks passed on **2026-08-31**:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- **14 of 14 test suites passed**
- **74 of 74 tests passed**
- Expo SDK dependency/configuration validation completed during implementation.
- Android Hermes production export completed after the Google OAuth integration.
- Native Android development-build testing reached onboarding, Home, and speech-recognition flows; issues found during that testing are recorded in the fixes above.

Automated coverage currently includes money parsing/formatting, relative and explicit dates, timezone month bounds, spoken numbers, category mapping, multiple voice transactions, deletion intent, speech-result handling, AI schema validation, budget calculations, CSV escaping, repository create/edit/delete/undo/category behavior, email and Google authentication transitions, OAuth callback/redirect validation, cancellation, local-ledger adoption, outbox retries, incremental sync, cloud restoration, and stale-write conflict prevention.

## 15. External verification still required

These items require a physical device, platform toolchain, or configured external service and should remain open until tested:

- Complete an Android device regression pass covering manual create/edit/delete/undo, custom category creation, category budgets, CSV sharing, permission denial, silence timeout, voice review, dark mode, offline restart, and local reset.
- Test native voice recognition and permission states on a physical iOS device using a development build.
- Rebuild the native development client whenever speech permission/plugin configuration changes.
- Deploy `supabase/migrations/202608300001_initial_schema.sql` to a non-production Supabase project.
- Configure the Google Auth Platform consent screen and OAuth web client, enable Google in Supabase Auth, and allow the exact `spendspeak://auth` mobile redirect.
- Test Google sign-in, cancellation, sign-out, repeat sign-in, local-ledger adoption, and cloud restore on Android and iOS development builds with configured test accounts.
- Deploy and configure `parse-transcript` and `delete-account` Edge Functions with server-side secrets.
- Verify live Gemini structured parsing with malformed-output and rate-limit cases.
- Run two-user RLS isolation checks for select, insert, update, and delete operations.
- Test cross-device synchronization, offline retries, tombstones, sign-out/sign-in, and conflict resolution against the deployed project.
- Run final EAS Android/iOS release builds and complete store-oriented signing/release checks.

Failures found during this testing should be added below before code changes begin so the reproduction, fix, and verification remain traceable.

## 16. Ongoing testing and improvement log

Use this section as the handoff record for future sessions. Add one entry per reported issue or requested enhancement.

### Entry template

```text
Date:
Platform/build:
Area:
Observed behavior:
Expected behavior:
Reproduction steps:
Status: Reported | Reproduced | In progress | Fixed | Verified
Files changed:
Verification performed:
Follow-up:
```

### Recorded device-testing findings

1. **Money formatting crash after local-only onboarding — Fixed**
   - Android raised `TypeError: Cannot convert BigInt to number` from `formatMoney` on Home.
   - Formatting was changed to avoid unsupported React Native/Hermes `Intl` BigInt behavior.
   - Money persistence and arithmetic continue to use precise integer minor units.

2. **Voice flow stuck on Processing transcription — Fixed in code and re-tested by the user**
   - Android recognition could finish without the event sequence originally expected by the UI.
   - Speech result finalization and timeout/cleanup handling were hardened.

3. **Live transcription quality — Improved; continue device evaluation**
   - Interim/final transcript handling and spoken-number normalization were improved.
   - Further accuracy is constrained by the native platform recognizer; future tuning should use concrete failing utterances and resulting transcripts.

4. **Specific and ordinal date commands — Implemented and covered by tests**
   - Added support for commands including “I paid 60000 on the first of this month” and other explicit-date forms.

5. **Custom categories — Implemented and covered by repository/parser tests**
   - Users can add categories at **Settings → Categories → New**.
   - This Settings-only management location is the current approved product behavior.

6. **Per-category budget dashboard — Implemented and covered by tests**
   - Budgets now show category-specific budget, spending, remaining/over amount, and progress separately from the Home overall-budget summary.

7. **Google authentication and synchronized storage — Implemented and covered by tests; console/device verification pending**
   - Added **Continue with Google** to Backup & sync while preserving email/password and local-only choices.
   - Added Supabase PKCE OAuth, a secure native browser session, callback validation, code exchange, secure session persistence, cancellation behavior, and ownership-conflict protection.
   - Successful Google sessions reuse the existing SQLite-first outbox, RLS, cloud restore, synchronization, and account-deletion paths.
   - Google is an identity provider only; no Drive, contacts, or financial-data scope is requested.
   - README documents the required Google Cloud and Supabase Dashboard configuration without placing private credentials in the app.
   - A device using an older development APK initially reported a missing `ExpoWebBrowser` native module. The import is now deferred so route registration and non-Google features remain usable, with an actionable rebuild message if Google sign-in is tapped. A newly built APK is still required because Metro cannot add native code to an existing binary.

8. **Supabase project tooling and environment preparation — Implemented; hosted deployment pending**
   - Installed and pinned the official project-scoped Supabase CLI and added scripts for login, linking, migration deployment, local stack lifecycle, status, reset, and individual Edge Function deployment.
   - Corrected dashboard-provided `NEXT_PUBLIC_` environment variable names to Expo-compatible `EXPO_PUBLIC_` names without displaying or changing their values.
   - Added a redacted connectivity check for the configured project URL, publishable key, and Auth endpoint.
   - Added foreground/background Supabase session auto-refresh lifecycle handling in the application provider.
   - Verified that the configured URL and publishable key are accepted and that the hosted Supabase Auth endpoint is reachable.
   - The local CLI is not authenticated yet. Repository linking, migration deployment, Google provider configuration, and Edge Function deployment remain pending until the user completes `npm run supabase:login`.

9. **Google sign-in HTTP 400 — Diagnosed; external configuration required**
   - The redacted hosted Auth diagnostic confirmed that the Supabase URL and publishable key are valid and the Auth service is reachable.
   - Supabase reports the Google provider as disabled, which causes the OAuth browser request to return HTTP 400 before authentication reaches the app callback.
   - Resolution requires creating/configuring the Google OAuth web client, enabling Google in Supabase Authentication Providers, and allowing `spendspeak://auth` in Supabase Redirect URLs. The Google client secret must remain in Supabase and must not be added to the mobile `.env` file.

10. **Recurring refresh and historical month browsing — Fixed and built in v1.0.1**
    - Android network callbacks were starting synchronization and incrementing the global database revision even when the reported connectivity state had not changed. Repeated identical events are now ignored, while the initial state and genuine online/offline transitions still update correctly.
    - Background database revision reloads now preserve rendered data instead of replacing screens with a loading state. Explicit retries still show loading feedback.
    - Transactions open on the current month and share accessible previous/next/current-month navigation. An explicit All dates option remains available.
    - Budgets use the same month navigation and load only budget rows whose `start_date` exactly matches the selected month. Older budgets no longer appear in the current month.
    - Creating a budget while viewing a historical month assigns it to that selected month. Overall and category spending calculations use that month's timezone-correct boundaries.
    - The Home overall-budget query now requires an exact current-month `start_date`, preventing an old budget from silently carrying forward.
    - Verification on 2026-09-07: strict TypeScript, ESLint, all **15 test suites**, all **79 tests**, and a clean Android Hermes production export passed.
    - These changes were made after the v1.0.0 APK in Section 18. The replacement was released as **v1.0.1 (Android version code 2)** so it can update the first APK without reusing its version code. Device verification remains pending.

## 17. Definition of done status

The code-level MVP is implemented, the local automated quality gate passes, and the first signed Android preview APK is available. Final production sign-off remains conditional on the external verification in Section 15, especially physical iOS testing, a full Android regression pass, deployed Supabase RLS/synchronization checks, live Edge Function validation, and store-oriented production builds. Until those checks pass, describe the application as **feature-complete MVP code undergoing device and cloud verification**, not as fully production-certified.

## 18. First Android APK release

SpendSpeak **v1.0.0 (Android version code 1)** was built successfully on **2026-09-07** using Expo SDK 57 and the EAS `preview` profile.

- Build ID: `ee412d80-c00f-4ca1-9c18-9b774e845e9e`
- Status: `FINISHED`
- Package: `com.spendspeak.app`
- Distribution: internal
- Artifact type: signed, directly installable APK
- Completed: `2026-09-07T10:54:53.320Z`
- Build page: <https://expo.dev/accounts/iamm.ahmed/projects/spendspeak/builds/ee412d80-c00f-4ca1-9c18-9b774e845e9e>
- Direct APK: <https://expo.dev/artifacts/eas/7KV6gVInDAJ3HIWR2bQzv3zSaQzcJUFaxfrIvr3DcuI.apk>
- EAS artifact expiration: `2026-09-21T10:32:35.458Z`
- Retained local artifact: `releases/SpendSpeak-v1.0.0.apk` (`109465314` bytes / 104.39 MB)
- SHA-256: `0723E59EA4928A85B1DAC45523EFA5493D6F8CD8BB95F059BA5E49E74A037735`

Release preparation completed before submission:

- Set `app.json` Android `versionCode` to `1`.
- Set `eas.json` preview distribution to `internal` and Android build type to `apk`.
- Configured the preview EAS environment with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as sensitive values; no service-role or Gemini secret was uploaded to the mobile build environment.
- Updated Expo SDK 57 packages to the compatible patch versions selected by `expo install --fix`.
- Confirmed `expo install --check` reports that dependencies are up to date.
- Passed strict TypeScript checking, ESLint, all **14 test suites**, and all **74 tests**.
- Passed a clean Android Hermes production export before the cloud build.
- Submitted with a clean EAS build cache and the existing remote Android keystore.

Known release considerations:

- This APK is intended for direct testing and is not a Google Play production artifact. A Play release should use a production `.aab` and complete the store release checks.
- Local-only tracking remains available without Supabase. Google authentication, synchronization, AI parsing, and remote deletion still depend on completing the external Supabase/provider/migration/Edge Function tasks in Section 15.
- `npm audit --omit=dev` currently reports a moderate denial-of-service advisory in the Expo Router transitive chain (`query-string` / `decode-uri-component`). npm's forced remediation proposes an incompatible Expo Router downgrade, so it was not applied. Track the Expo-compatible upstream update and do not use `npm audit fix --force` for this issue.
- Installing over a compatible EAS-signed build should preserve SQLite data. Uninstalling any build deletes its local-only data, so export or synchronize important data first.

## 19. Android v1.0.1 testing release

SpendSpeak **v1.0.1 (Android version code 2)** was built successfully on **2026-09-07** after the refresh fix and historical-month work.

- Build ID: `e54ee811-b648-4271-b915-4f3bc8f3c47f`
- Status: `FINISHED`
- Package: `com.spendspeak.app`
- Distribution: internal
- Artifact type: signed, directly installable APK
- Completed: `2026-09-07T11:40:22.513Z`
- Build page: <https://expo.dev/accounts/iamm.ahmed/projects/spendspeak/builds/e54ee811-b648-4271-b915-4f3bc8f3c47f>
- Direct APK: <https://expo.dev/artifacts/eas/QICcTlOiU7ZA3cmVL69Rdzu0Jk1oLVibJxmo09r4eJk.apk>
- EAS artifact expiration: `2026-09-21T11:23:30.295Z`
- Retained local artifact: `releases/SpendSpeak-v1.0.1.apk` (`109470078` bytes / 104.40 MB)
- SHA-256: `4FE48515CE5F70A2FBCCEF14A7EC6FB0E29F14938545E8A47CCFC45A35F519A5`

This build passed strict TypeScript, ESLint, all **15 test suites**, all **79 tests**, Expo SDK 57 dependency validation, a clean Android Hermes production export, EAS signing, and the EAS Android build. Physical-device verification should confirm that screens no longer refresh every few seconds, previous/current month navigation works on Transactions and Budgets, prior-month budgets remain isolated, new historical budgets save to the viewed month, and v1.0.1 updates v1.0.0 without losing local data.

## 20. Budget-category architecture, drill-down, voice budgets, and branding (v1.1.0 source)

Implemented on **2026-09-18**. The source version is **v1.1.0** with Android `versionCode` **3**. A signed internal-distribution APK was produced after the final verification described below.

### Product behavior completed

- Added a first-class `budget_categories` model independent from transaction `categories`.
- Every existing/default expense category is migrated to a stable linked budget category. Creating a new expense category also creates its linked default budget category with the same device UUID.
- Budget category name, icon, and color can be edited separately at **Settings → Budget categories**. Independent budget categories can also be created and soft-deleted.
- Expense entry and voice review now offer **Automatic**, **No budget**, or a specific budget category. Automatic follows the transaction category's stable mapping; a specific selection supports combinations such as transaction category `Food` and budget category `Eating Out`.
- Transactions persist an optional `budget_category_id`. Budget progress aggregates this field rather than assuming the transaction category and budget category are identical.
- The deterministic parser recognizes commands such as `Expense 600 spent on Food in Eating Out budget`. When no budget is spoken, the reviewed save uses local automatic mapping. The protected AI contract now includes a nullable validated `budget` field and receives the allowed budget-category names.
- Category budget cards are actionable and open a month-scoped list of every expense assigned to that budget. Transaction rows also display their budget assignment.
- Successful creation clears the transaction form state, including amount, merchant, note, date/time, errors, and budget selection. Edit forms retain their normal navigation behavior.
- CSV export now includes `budget_category`.

### Structure and cleanup

- Expo Router category and budget routes are thin route modules; feature implementations now live under `src/features/categories` and `src/features/budgets`.
- Extracted reusable category appearance fields and shared icon/color options for transaction and budget category editors.
- Extracted reusable budget modal and budget progress card components.
- Removed the two obsolete v1 icon files after the new assets were configured. They were replaced, not recoverably moved, by versioned v2 source/icon/adaptive/splash assets.
- Added deterministic brand-asset generation at `scripts/generate-brand-assets.ps1`.

### Local and cloud schema

- SQLite schema version **2** creates `budget_categories`, adds optional budget-category foreign keys to transactions and budgets, migrates historical relationships, expands the durable outbox entity constraint, and adds indexes.
- Added `supabase/migrations/202609180001_budget_categories.sql` with the cloud equivalent, historical migration, ownership validation, indexes, updated-at trigger, and select/insert/update/delete RLS policies.
- Synchronization now includes budget categories and orders pushes by dependency: profile, accounts, transaction categories, budget categories, transactions, then budgets.
- The hosted migration must be applied with `npm run supabase:push` before signed-in v1.1 clients synchronize these records. The updated `parse-transcript` Edge Function must also be redeployed before cloud AI can return budget fields.

### New visual identity

- Replaced the busy speech-bubble/coin artwork with a simpler deep-emerald SpendSpeak `S`, centered coin, and symmetric audio-wave mark.
- Added `assets/spendspeak-brand-source-v2.png`, `spendspeak-mark-v2.png`, `spendspeak-icon-v2.png`, `spendspeak-adaptive-foreground-v2.png`, and `spendspeak-splash-v2.png`.
- Added the Expo SDK 57 `expo-splash-screen` config plugin with matching light/dark backgrounds and updated the application icon, adaptive icon, and web favicon.
- The native branding changes require a fresh development or preview build; Metro reloads cannot update installed icons or splash screens.

### Verification performed

- `npm run check`: strict TypeScript, ESLint, **15 of 15 suites**, **83 of 83 tests** passed.
- Focused budget/parser/repository validation: **6 suites**, **31 tests** passed.
- `npx expo install --check`: dependencies are up to date for Expo SDK 57 after `expo install --fix`.
- `npx expo config --type public`: resolved v1.1.0 config contains the new splash plugin, icon paths, Android version code 3, native speech permissions, and SDK 57.
- Android Hermes production export completed successfully against the final splash-enabled source: **1,605 modules**, 4.9 MB `.hbc` bundle. The temporary export directory was deleted after verification.
- The configured Supabase Auth connectivity check currently returns `fetch failed` because the configured project hostname does not resolve in DNS. No URL or key was printed or modified. Confirm that `EXPO_PUBLIC_SUPABASE_URL` exactly matches the active project's **Settings → API** URL (and that the project is not deleted or unavailable), then re-run `npm run supabase:check` before cloud deployment.

### Device/cloud verification still required

- Install the v1.1.0 preview APK and verify the v2 icon plus light/dark native splash.
- Confirm an existing v1.0.1 SQLite database migrates in place without losing transactions or budgets.
- Test automatic mapping, an explicit different budget, **No budget**, voice budget syntax, form clearing, category-budget drill-down, and month isolation on Android.
- Apply both Supabase migrations, redeploy `parse-transcript`, and test cross-device sync/RLS for `budget_categories` and transaction/budget foreign keys.

## 21. Android v1.1.0 testing release

SpendSpeak **v1.1.0 (Android version code 3)** was built successfully on **2026-09-18** after the budget-category, drill-down, voice-budget, form-reset, refactor, and branding work.

- Build ID: `166240e2-bd50-414d-8a6d-e2b7b8f4d79b`
- Status: `FINISHED`
- Package: `com.spendspeak.app`
- Distribution: internal
- Artifact type: signed, directly installable APK
- Completed: `2026-09-18T04:35:08.911Z`
- Build page: <https://expo.dev/accounts/iamm.ahmed/projects/spendspeak/builds/166240e2-bd50-414d-8a6d-e2b7b8f4d79b>
- Direct APK: <https://expo.dev/artifacts/eas/90nAEg_BkaO-0GFHLe12C3NFZrarQNx4kxP9S2hCp7c.apk>
- EAS artifact expiration: `2026-10-02T04:21:06.461Z`
- Retained local artifact: `releases/SpendSpeak-v1.1.0.apk` (`109472964` bytes / 104.40 MB)
- SHA-256: `B109383EDE159BE8E9BE025EFE09358993013FEA7927FAFF902ED29BA0CA7A32`

The build used the existing remote Android keystore and the EAS preview environment's public Supabase URL/publishable key. It contains no service-role or Gemini secret. Code verification before submission passed strict TypeScript, ESLint, all **15 test suites**, all **83 tests**, Expo SDK 57 dependency validation, resolved Expo native config, and a clean Android Hermes production export. Physical-device and hosted Supabase migration/sync verification remain required.

## 22. Many-to-many automatic budget membership (v1.2.0 source)

Implemented on **2026-09-18**. The current source version is **v1.2.0** with Android `versionCode` **4**. The latest retained APK remains v1.1.0; no EAS build has yet been requested or produced from this v1.2.0 source.

### Product behavior completed

- A budget category can include zero, one, or many expense transaction categories. The editor at **Settings → Budget categories** exposes accessible multi-select checkboxes and displays the included category names in the list.
- One transaction category can belong to several budget categories. For example, `Food` can remain in the matching `Food` budget and also be included in `Household`; one automatic Food expense then contributes to both budget totals without duplicating the transaction.
- Existing same-name category/budget relationships are migrated into the initial membership list, so the previous Food-to-Food behavior continues.
- Transaction budget behavior is now explicit and lossless:
  - **Automatic** counts the expense in every active budget category containing its transaction category.
  - Selecting a named budget is an **explicit override** and counts only in that budget.
  - **No budget** excludes the expense from category-budget totals.
  - The overall monthly budget continues to include every expense, including expenses excluded from category budgets.
- Budget drill-down uses the same membership rules as progress calculations, so each card shows the exact transactions responsible for its total.
- Transaction rows and CSV export can represent multiple automatic budget names.

### Schema and synchronization

- SQLite schema version **3** adds `budget_categories.category_ids_json` and `transactions.budget_assignment_mode`. The migration converts old source mappings to membership arrays and distinguishes prior automatic, explicit, and excluded assignments where possible.
- Added `supabase/migrations/202609180002_budget_category_memberships.sql` with the equivalent `uuid[]` membership field, assignment constraints, GIN/query indexes, same-user active-expense validation, and migration of existing data.
- Sync serializes the local JSON membership list to a validated Supabase UUID array and converts pulled arrays back to local JSON. Membership edits reuse the budget category's existing durable outbox record.
- The new migration must be deployed with `npm run supabase:push` before a signed-in v1.2 client synchronizes. The configured local Supabase hostname still does not resolve, so hosted verification remains pending.

### Verification performed

- Updated Expo SDK 57 packages to the versions prescribed by `expo install --fix`: Expo `57.0.24`, Expo Constants `57.0.19`, Expo Router `57.0.22`, and Expo Sharing `57.0.21`.
- `npx expo install --check`: dependencies are up to date.
- `npm run check`: strict TypeScript, ESLint, **15 of 15 suites**, and **84 of 84 tests** passed after the dependency update.
- Tests cover one Food category contributing automatically to both Food and Household, explicit override, No budget, membership persistence, cloud payload conversion, and category-budget progress.
- Final Android Hermes production export succeeded: **1,605 modules** and a 4.9 MB `.hbc` bundle. The temporary export directory was verified inside the workspace and removed afterward.
- `npm audit` reports three moderate advisories in Expo Router's transitive `query-string` / `decode-uri-component` chain. npm proposes an incompatible Expo Router major downgrade, so no forced dependency change was applied; there are no high or critical advisories.

### Device/cloud verification still required

- On Android, create a `Household` budget category containing `Food` and `Groceries`, leave the matching Food budget containing Food, and verify an Automatic Food expense appears in both cards and both drill-downs.
- Verify that explicitly choosing Household counts only there and choosing No budget counts in neither category budget.
- Apply all Supabase migrations in timestamp order and verify membership edits and automatic transactions synchronize across two authenticated devices under RLS.
