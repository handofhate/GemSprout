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

## Replacement App Development

Run:

```powershell
npm run dev:v2
```

The default V2 entry path is the real app: landing, sign-in, kid join, onboarding, and Firestore-backed family state.

```text
http://127.0.0.1:4273/
```

The local Vite server reads and writes the isolated `gemsprout-v2-dev` project. The Codemagic `ios-v2-testflight` workflow is configured for production `gemsprout1`. Do not use local-browser success as proof that the production iOS build works.

## Current App State

The V1 family data migration to the V2 Firestore document layout is complete in `gemsprout1`. Parent and kid sign-in, family-code join, family dashboards, onboarding, settings, approvals, rewards, savings, badges, Week in Review, QR generation/scanning, app badge handling, and Remote Config gates are implemented. Source checks pass locally; production rules/function deployment and the iPhone verification pass are still required before release.

For browser review work, prefer targeted UI changes plus `npm run typecheck:v2`. Avoid broad rewrites and preserve v1 behavior/visuals unless the user explicitly approves a change.

See `docs/v2-readiness-audit.md` and `docs/iphone-test-plan.md` for the current go-forward checklist.

## Current Rule

Do not release V2 publicly until:

- production Firestore rules and account-deletion cleanup are deployed and verified.
- critical v1 workflows have parity tests.
- auth, account deletion, push registration, and subscription boundaries are verified on device.
- rollback behavior is documented.
