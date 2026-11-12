# V2 TestFlight Readiness

Last reviewed: 2026-11-12

## Current State

- The V2 TestFlight workflow is `ios-v2-testflight` in `codemagic.yaml`. It builds against production Firebase project `gemsprout1` and submits to TestFlight. `ios-release` is the V1 workflow.
- The V1 family data migration to the V2 document layout was previously completed in `gemsprout1`. Do not rerun the importer as part of a build. Keep the Cloud Storage export and the older app JSON backup as rollback references.
- V2 source changes are currently local until committed and pushed. Codemagic cannot build unpushed changes.
- The scoped production Firestore rules are deployed to `gemsprout1`. Direct family-code lookup remains available for V1 compatibility; a linked user record is required for family writes. The six-character code is a shared kid-access key, not a strong user credential.
- The Firebase Auth deletion trigger is deployed. It preserves a family's data when another parent auth remains linked and removes the family only after the last linked parent account is deleted.
- The paywall bypass is development-only and is absent from the production-target TestFlight build. RevenueCat purchase and restore still require iPhone sandbox verification.

## Must Pass Before TestFlight

1. Run `npm run typecheck:v2`, `npm run test:v2`, `npm run test:rules:v2`, and `npm run build:v2:app`.
2. Commit and push the intended source changes only. Never include local family migration preview/export JSON files.
3. Build with Codemagic workflow `ios-v2-testflight` from `main`, then install that exact build from TestFlight.
4. On iPhone, verify parent Google/Apple sign-in, COLLUM lookup, ABC123 test-family read/write, kid code join, role switching and parent-auth guard, and app relaunch.
5. Verify RevenueCat purchase/restore, photo proof and approval/undo, QR scan/generation, badge clearing, push tap routing, maintenance/update gates, and account deletion. Use a newly created disposable family/account for destructive deletion checks; do not delete COLLUM or ABC123.

## Must Pass Before App Store Release

- Complete the full iPhone parity checklist, including offline recovery, camera permissions, two-device refresh, subscriptions, and account deletion.
- Confirm the V1 App Store build still reads and writes the migrated production families after the rules update.
- Remove or explicitly resolve any development-only UI, outstanding RevenueCat issues, bundle warnings that affect launch, and App Store metadata/screenshots.
- Keep the V1 source/build available, but note that the V1 app may not understand the migrated V2 Firestore layout. A data rollback means restoring the verified Firestore export, not simply reinstalling the old app.

## Known Limits

- The family code is a shared bearer credential. Anyone who obtains a family's code can join that family; codes should not be posted publicly. A PIN/server-verified join would be stronger but changes the existing V1 access flow.
- Typecheck and web build success do not prove native sign-in, StoreKit, push, camera, or App Store Connect delivery. Those require the actual TestFlight build on an iPhone.
- The local Vite server defaults to the development Firebase project. It is not the production release candidate; the Codemagic V2 workflow is production-targeted.
