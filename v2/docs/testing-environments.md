# Testing Environments

v2 can continue using pure unit tests and the fake Firestore adapter without a second Firebase project.

Before live SDK integration tests or device testing, use one of these non-production targets:

1. Firebase Emulator Suite for local transaction/rules tests.
2. A separate Firebase project, for example `gemsprout-v2-dev`, for device, push, auth, and Cloud Functions testing.
3. A named Firestore database only after guardrails are in place, because it still lives near production project resources.

Do not run v2 migration or write-path tests against the production `gemsprout1` project until the migration plan, rollback plan, and test fixtures are complete.

## Why

- v2 uses a different document layout from v1.
- Operation tests need to retry and fail safely.
- Account deletion, auth, push tokens, and Cloud Functions need realistic testing without touching public families.
- Firestore security rules will need their own validation pass.

## Near-Term Recommendation

Keep building against the fake adapter for UI/domain work. Start migration rehearsal with a local snapshot preview, then a second Firebase project or emulator before implementing the real live transaction runner.

The current local browser lab runs through Vite on port `4273` and uses the fake adapter only.

See `live-migration-runway.md` for the step-by-step data-copy plan.
