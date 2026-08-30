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

## 14. Execution status

All eight implementation slices are complete in the repository. Strict TypeScript, ESLint, 34 automated unit/integration tests, Expo SDK dependency validation, npm production dependency audit, public Expo configuration resolution, native permission prebuild inspection, and an Android Hermes production export pass as of 2026-08-30.

The remaining acceptance work depends on external infrastructure rather than placeholder code: install a development build on physical iOS and Android devices to exercise each platform speech recognizer, and deploy the committed migration/Edge Functions to a configured Supabase project to run two-user RLS and live synchronization checks. Missing credentials keep the corresponding cloud features in their documented disabled state while all local features remain available.
