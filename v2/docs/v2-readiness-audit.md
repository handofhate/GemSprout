# v2 Readiness Audit

Date: 2026-07-10

This audit is the working map for taking v2 from "mostly migrated surfaces" to "safe to test like the real app." The acceptance bar is v1 visual and functional parity, with cleaner internals and fixes for known v1 jank.

## Current Shape

Likely ready for focused manual verification:

- Main landing page, returning sign-in, kid family-code entry, profile picker, join different family, onboarding/setup panes, edit family, and routing into parent/kid dashboards.
- Parent dashboard overview, inbox review, recent activity, undo, snapshot cards, quick actions, dashboard slideout controls, task/prize/team-goal editors, family stats, settings main pane, notification settings, account/security visuals and flows.
- Kid regular and little kid dashboards across Tasks, Gems, Shop, Team, Stats, settings, prize/savings requests, photo submission UI, time-slot tasks, Daily Combo, badge cards, and in-app approval/denial/reward modals.
- Levels, streaks, Daily Combo, base badges, task badges, savings banking, split household, home/away, auto-approve tasks, hide unavailable tasks, hide redeemed recurring prizes, UI hints, timezone setting, and "You're Not Listening" setting.
- Week in Review story experience, including conditional slides and v1 audio assets.

## Gaps To Close

### P0 Before Full iPhone Parity Pass

- Real app entry/auth/family selection: the default v2 path must behave like the replacement app, not a seeded review lane. Landing, sign-in, onboarding, returning family lookup, kid join, stored viewer selection, and leave-device behavior need to be production-shaped before the v1 swap.
- Real-time Firestore refresh/subscription: the Firestore-backed app path mostly reloads snapshots after local actions. Cross-device actions, parent approvals triggering kid pop-up modals, and notification badge counts need live subscription or a deliberate foreground/visibility refresh strategy.
- RevenueCat/paywall/restore/manage subscription flow: the first v2 adapter and paywall/account settings wiring are now in place, modeled on v1. It still needs iPhone/App Store sandbox verification and the later Remote Config beta/fail-open decision.
- Photo proof storage: v2 now follows the v1 cost-saving pattern rather than Firebase Storage. Photos are compressed client-side into small inline data URLs, kept on pending/recently undoable completion records, and cleaned after the related history row is no longer undoable. This still needs manual approval/undo verification on dev Firestore.
- iOS build wiring for v2: root Capacitor config still points at `webDir: "www"`. We need confirm the v2 build output is copied/synced into the native app, and verify GoogleService, bundle id, associated auth providers, camera strings, push entitlements, and plugins on a device.
- Account delete reauthentication: v2 matches the v1 copy/confirm shape, but Firebase Auth `deleteUser()` can fail if the login is stale. Before release, reauth must happen before destructive family/user deletion or the flow must stop safely.

### P1 For Functional Parity

- Push notification routing: v2 registers parent push tokens and binds foreground/action callbacks, but tap routing to the right screen/state still needs a concrete route handler and iPhone verification.
- App badge counts: v1 updates the native badge from pending parent inbox count. v2 has notification settings and push registration, but badge sync needs to be ported or explicitly redesigned.
- Pull-to-refresh/foreground refresh: v1 has pull-to-refresh and foreground refresh behavior. v2 should restore this because it is the simplest visible recovery path for stale data.
- QR scanner and generated QR: v2 currently keeps manual family-code entry and placeholder/native-adapter copy. Real scan/generate behavior needs to be implemented or intentionally deferred behind clear UI.
- Parent invite delivery: v2 writes invite records in dev Firestore, but email/function delivery is not confirmed. This needs either the existing v1 backend path or a cleaned v2 invite service.
- Offline/write failure recovery: optimistic writes exist in important paths, but there is no app-wide pending write/retry surface yet.
- Remote Config/maintenance mode: v1 has maintenance/Remote Config behavior and preview. v2 needs the release behavior ported.

### P2 Polish And Regression Sweep

- Changelog/What's New behavior should be checked against v1 copy and version storage.
- Native biometric/app-lock is wired directly through Capacitor plugins in v2 app code; it works enough for manual testing but should move behind a platform adapter.
- Notification settings should be verified for disabled dependencies and persistence after reload/sign out/sign in.
- Timezone should be tested against task availability, streaks, Daily Combo, and Week in Review boundaries, not only setting persistence.
- Data migration should be re-run from a current v1 export after the remaining schema decisions settle.

## Recommended Order

1. Make the default v2 route production-shaped: real landing, auth, onboarding, returning sign-in, kid join, persisted viewer/family selection, and no fake-data default.
2. Finish verifying real-time Firestore subscription/refresh and app badge sync on two devices. The first v2 implementation is now in place for the Firestore-backed app path.
3. Verify RevenueCat/paywall/restore/manage behavior on iPhone with App Store sandbox.
4. Verify photo proof approval/denial/undo cleanup on dev Firestore, including before/after photo tasks.
5. Verify and adjust iOS/Capacitor build wiring for v2, then run a first device smoke test.
6. Finish QR scanner/invite delivery/maintenance mode.
7. Run the full iPhone test plan and fix findings feature by feature.

## Data And Sync Safety Checklist

- Family creation does not commit family code/data until setup completion.
- Deterministic history/request/completion IDs are used for replayable actions.
- Main family document remains small; high-volume history/completions/requests stay in subcollections.
- Failed Auth deletion cannot delete family data first.
- Parent approval/denial cannot double-award, double-deny, or lose pending state after retry.
- Kid reward/denial modals mark only seen notification IDs and do not hide new remote events.
- Streak/task "today" calculations use the family timezone consistently.
- Migration preserves member ids, display modes, balances, savings buckets, badges, history, requests, prizes, tasks, settings, and family name/code.
