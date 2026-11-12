# GemSprout V2 Handoff

Last reviewed: 2026-11-12

## Product Direction

- V1 remains the live App Store app until V2 has passed TestFlight and App Store review.
- V2 is the production replacement, not a lab or a local-route test harness. Preserve V1's customer-facing behavior unless a fix is explicitly intended.
- Use V1 as the source of truth when diagnosing a regression. Improve the implementation without changing the user flow unnecessarily.
- Keep the local V2 server running when it is started for Ty to test. Keep progress updates quiet; report blockers and the concise result.

## Current Release Path

- Build workflow: `ios-v2-testflight` in `codemagic.yaml`.
- It targets production Firebase project `gemsprout1`, uses marketing version 1.1, increments the build number, and uploads the IPA to App Store Connect. `submit_to_testflight` and `submit_to_app_store` are both false: Codemagic does not run the separate beta-review submission step.
- `ios-release` is the V1 workflow; do not select it for V2.
- The local Vite server defaults to `gemsprout-v2-dev`; it is not the production TestFlight build.
- The full V1 family data migration to the V2 structure was previously completed in `gemsprout1`. Keep V1 data and the Cloud Storage export intact. Never rerun the migration to test a build.

## Current Release State

- Codemagic build 1.1 (129), source commit `6c23f2f`, uploaded successfully to App Store Connect and finished without the prior post-processing failure. Apple processing and TestFlight availability are still unverified. [View build](https://codemagic.io/app/69b8903edf292c5ec8a27216/build/6af64fed10a05158d812310a).
- Recent app changes: Week in Review's Stats-card shortcut follows the existing UI-hints toggle; startup, subscription-check, and initial-load screens use the generic `Loading...` text, while purchase restore remains `Restoring...`.
- Validation at app source commit `bc8cbf9`: `npm run typecheck:v2`, all 33 `npm run test:v2` tests, and a production-target `npm run build:v2:web` passed.
- Production Firestore rules and the Auth deletion trigger are deployed. Family-code lookup remains compatible with V1; parent deletion cleanup waits until no linked parent account remains.
- The paywall bypass is only present in development builds. TestFlight must verify real RevenueCat purchase/restore behavior.
- Two local `all-families-*-preview.json` files contain private family data. Never commit or attach them.

## Next Steps

1. Wait for Apple to finish processing build 129; then confirm it appears in TestFlight and is assigned to the internal tester group if needed.
2. Install version 1.1 (129) on iPhone and complete the focused device pass in `iphone-test-plan.md`.
3. Use `ABC123` for non-destructive test writes. Use a newly created throwaway family/account for data reset or account deletion; never delete COLLUM or ABC123.
4. Complete the remaining device checks for RevenueCat, photo proof and undo, QR, badge counts, push routing, offline recovery, and maintenance/update gates before App Store release.

## After TestFlight

- Keep the V1 source/build available, but use the verified Firestore export for data rollback; the old V1 app may not interpret the migrated V2 document layout.
