# GemSprout v2

Parallel rebuild workspace for GemSprout.

The public app remains in the root v1 files while v2 is built and verified in isolation. The goal is not a blank-page product rewrite; it is a staged architecture rewrite that keeps proven behavior, copy, visual assets, and tests while replacing the fragile parts of the implementation.

## Priorities

1. Make state transitions explicit and testable.
2. Keep Firestore writes small, transactional, and recoverable.
3. Separate domain rules from UI rendering.
4. Treat notifications, auth, subscriptions, and native integrations as adapters.
5. Preserve existing user-facing behavior unless a v2 decision document says otherwise.

## Layout

- `docs/` - rewrite decisions, migration notes, architecture records.
- `src/app/` - app bootstrap, routing, shell-level state.
- `src/domain/` - pure business rules for chores, prizes, savings, history, members, settings, and subscriptions.
- `src/features/` - user-facing feature modules that compose domain rules and UI.
- `src/platform/` - browser, Capacitor, Firebase, RevenueCat, notification, and storage adapters.
- `src/state/` - client state orchestration and optimistic action handling.
- `src/sync/` - Firestore document model, operation model, transactions, migrations, and conflict handling.
- `src/ui/` - reusable UI primitives and shared presentation utilities.
- `src/utils/` - small framework-neutral helpers.
- `tests/` - v2 fixtures, domain tests, integration tests, and migrated e2e coverage.

## Local Development

Run:

```powershell
npm run dev:v2
```

Use the dev Firestore data for current visual/functionality testing:

```text
http://127.0.0.1:4273/?source=firestore
```

This reads and writes the isolated `gemsprout-v2-dev` project, not production. The current imported preview family is `families/migration-preview`.

Local fake-data testing is still available at:

```text
http://127.0.0.1:4273/
```

The original approval lab is hidden behind:

```text
http://127.0.0.1:4273/?lab=1
```

## Current App State

Parent dashboard visuals, landing/login/onboarding, regular kid dashboard, little kid mode, main settings behavior, account/security settings, notification settings, Week in Review, and kid in-app notification modals are mostly migrated for the current dev path. Current next step is the readiness pass: real-time sync/refresh, RevenueCat/paywall, durable photo storage, QR/invite/maintenance behavior, iOS build wiring, and full on-device verification.

For browser review work, prefer targeted UI changes plus `npm run typecheck:v2`. Avoid broad rewrites and preserve v1 behavior/visuals unless the user explicitly approves a change.

See `docs/v2-readiness-audit.md` and `docs/iphone-test-plan.md` for the current go-forward checklist.

## Current Rule

Do not point production users at v2 until:

- v1 data can migrate forward safely.
- critical v1 workflows have parity tests.
- auth, account deletion, push registration, and subscription boundaries are verified on device.
- rollback behavior is documented.
