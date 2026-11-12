# GemSprout V2 Handoff

Last reviewed: 2026-11-12

## Product Direction

- V1 remains the live App Store app until V2 has passed TestFlight and App Store review.
- V2 is the production replacement, not a lab or a local-route test harness. Preserve V1's customer-facing behavior unless a fix is explicitly intended.
- Use V1 as the source of truth when diagnosing a regression. Improve the implementation without changing the user flow unnecessarily.
- Keep the local V2 server running when it is started for Ty to test. Keep progress updates quiet; report blockers and the concise result.

## Current Release Path

- Build workflow: `ios-v2-testflight` in `codemagic.yaml`.
- It targets production Firebase project `gemsprout1`, uses marketing version 1.1, increments the build number, and submits to TestFlight.
- `ios-release` is the V1 workflow; do not select it for V2.
- The local Vite server defaults to `gemsprout-v2-dev`; it is not the production TestFlight build.
- The full V1 family data migration to the V2 structure was previously completed in `gemsprout1`. Keep V1 data and the Cloud Storage export intact. Never rerun the migration to test a build.

## Current Work

- Production Firestore rules are being narrowed to a family's code-linked records while preserving V1's code-based kid join behavior.
- V2 family documents are being keyed by their six-character family code so direct join does not need a collection-wide family query.
- Parent account deletion requires fresh Google/Apple reauthentication. A server-side Auth deletion trigger removes the associated family data only after Firebase confirms the account deletion.
- The paywall bypass is only present in development builds. TestFlight must verify real RevenueCat purchase/restore behavior.
- Two local `all-families-*-preview.json` files contain private family data. Never commit or attach them.

## Before TestFlight

1. Run typecheck, the current V2 tests, Firestore rules emulator tests, and the app build.
2. Deploy and verify the production rules and Auth deletion function in `gemsprout1`.
3. Commit and push the intended app changes without local data exports.
4. Run `ios-v2-testflight` from `main`, install that exact build on iPhone, and complete the focused device pass in `iphone-test-plan.md`.

## After TestFlight

- Test login, migrated family lookup, kid code join, role switching/auth guard, and persistence after relaunch.
- Use `ABC123` for non-destructive test writes. Use a newly created throwaway family/account for data reset or account deletion; never delete COLLUM or ABC123.
- Finish checks for RevenueCat, photo proof and undo, QR, badge counts, push routing, offline recovery, and maintenance/update gates before App Store release.
- Keep the V1 source/build available, but use the verified Firestore export for data rollback; the old V1 app may not interpret the migrated V2 document layout.
