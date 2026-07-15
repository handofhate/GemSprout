# Future Session Notes

GemSprout is now post-launch. v1 remains the public app in the repo root. v2 is being built in parallel under `v2/`.

## Current Direction

The user wants to prioritize starting v2 over patching the current v1 bug list. Do not drift back into v1 bug fixing unless the user explicitly asks for a production hotfix.

The chosen strategy is a controlled architecture rewrite, not a blank-page product rewrite. v2 must clone GemSprout v1 customer-facing functionality and appearance 100%. Preserve v1 flows, copy, visual assets, screen behavior, and business rules unless the change is explicitly a bug fix, safety/trustworthiness improvement, or functional accuracy fix. The desired changes are internal code cleanup, organization, sync safety, persistence safety, and correctness.

## Why v2 Exists

v1 reached launch, but core behavior is concentrated in a very large `app.js`. Sync, rendering, optimistic actions, history IDs, Firestore persistence, native behavior, and diagnostics are tightly coupled. That makes post-launch fixes risky and hard to reason about.

v2 should make the app easier to maintain by:

- using explicit domain modules,
- using deterministic operation and history IDs,
- keeping Firestore writes smaller and transactional,
- isolating platform adapters,
- making tests the behavioral contract.

## Current Status as of 2026-07-10

v2 has moved beyond the initial contracts/lab stage. It now has:

- A real dev Firestore path using copied v1 data in `gemsprout-v2-dev`, especially `families/migration-preview`.
- A parent dashboard with most visuals and settings panes migrated.
- A regular kid dashboard with Tasks, Gems, Shop, Team, Stats, settings, badge holo cards, savings/history/spend flows, prize redemption/request flows, photo submission, time-slot selection, daily combos, TTS where v1 used it, and the GemSprout easter-egg rain behavior.
- A little kid mode keyed by legacy-compatible `displayMode: 'tiny'` / `mode: 'tiny'`, with clearer v2 code naming around "little kid" where safe. Little kid Tasks, Gems, Shop, Team, and Stats have been migrated with large simplified visuals and TTS.
- Landing, returning sign-in, kid join/profile picker, onboarding/setup panes, edit family, join different family, and profile routing are in place for the current dev path.
- Main settings behavior, levels, streaks, Daily Combo, base/task badges, savings banking, split household home/away, notification settings, account/security settings, Week in Review, and kid in-app reward/approval/denial modals have been migrated far enough for focused parity verification.
- The v1 loading screen has been migrated into a reusable v2 `renderLoadingScreen()` helper on `screen-auth`.

Important current behavior:

- Parent inbox approve/deny rows disappear optimistically.
- Recent Activity, Family Control Center totals, and Family Snapshot cards update from optimistic state without a full parent dashboard redraw.
- Parent overview approve/deny and undo writes are queued narrowly through the parent overview Firestore queue, so rapid clicks serialize in the background while UI remains responsive.
- Undo now restores the linked completion state well enough for newly created approvals to be undone and re-approved. Some older history entries created before the fix may still be stale; the user accepted this as good enough for now.
- Family Snapshot cards should show kids only, not parent profiles.

## Current Working Point

Next work should start with the readiness pass documented in `v2/docs/v2-readiness-audit.md` and `v2/docs/iphone-test-plan.md`:

1. Add real-time Firestore subscription/foreground refresh and native app badge sync.
2. Port RevenueCat/paywall/restore/manage subscription behavior.
3. Port durable photo storage.
4. Verify and adjust iOS/Capacitor build wiring for v2.
5. Finish QR scanner/invite delivery/maintenance mode, then run the full iPhone test plan.

Continue using v1 as the visual and functional source of truth. The user reviews in the browser and prefers concise end summaries over ongoing status chatter. For this phase, do not run backend-heavy tests unless requested; `npm run typecheck:v2` has been the lightweight safety check after edits.

## iPhone/iPad Device Pass - 2026-07-15

The first numbered device pass produced a broad bug list in `v2/docs/iphone-test-plan.md`. Start future follow-up there before re-testing. The highest-value remaining threads are:

- Give device testers a clean leave/reset-family path so front door, returning sign-in, kid join/profile picker, settings account/security, and migration can be tested without getting trapped in seeded data.
- Use the ported hidden push diagnostics in v2 before chasing notification failures; unlock it by tapping `GemSprout v2` seven times at the bottom of Settings. v2 now saves native FCM tokens to `users/<authUid>.fcmTokens` during parent push registration and exposes permission/token/auth/family diagnostics on device.
- Continue reducing kid-dashboard redraws/scroll jumps, especially after approvals, undo, not-listening updates, savings, and prize actions.
- Finish native readiness checks: app lock on background/reopen, app badge count, local savings-interest notification, offline recovery, and subscriptions.
- Tune iPad holo badge card proportions and remove overlapping badge-earned modals.

## v1 Bug List From Pre-v2 Review

These are known issues, but current direction is to hold v1 fixes unless needed as production hotfixes:

- Account deletion can clear local data even if Firebase Auth deletion fails due to recent-login requirements.
- Prize approval can mark a failed approval as denied.
- Firebase Functions source is not present in the repo even though notification callables are referenced.
- Full e2e run showed slow-project flakes that passed in isolation.
- Savings approval and denial history IDs are not deterministic inside `runFamilyAction()`.
- Processed action ledger records logical failures as processed.
- Push test notification payload does not mirror production notification routing fields.

## Working Rule

When future Codex sessions start v2 work, read this file, `v2/README.md`, and the docs in `v2/docs/` before editing. Keep production v1 stable unless the user explicitly changes priority.
