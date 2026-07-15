# Future Session Notes

GemSprout is now post-launch. v1 remains the public app in the repo root. v2 is being built in parallel under `v2/`.

## Current Direction

The user wants to prioritize starting v2 over patching the current v1 bug list. Do not drift back into v1 bug fixing unless the user explicitly asks for a production hotfix.

The chosen strategy is a controlled architecture rewrite, not a blank-page product rewrite. v2 must clone GemSprout v1 customer-facing functionality and appearance 100%. Preserve v1 flows, copy, visual assets, screen behavior, and business rules unless the change is explicitly a bug fix, safety/trustworthiness improvement, or functional accuracy fix. The desired changes are internal code cleanup, organization, sync safety, persistence safety, and correctness.

## V2 Goals And Guardrails

1. Copy v1's visual design and feature set.
   v2 should look, feel, and behave like the real GemSprout app. V1 remains the source of truth for flows, copy, visual details, family-code behavior, native expectations, and feature coverage unless the user explicitly approves a product change.

2. Fix the v1 code organization problems that made bugs likely.
   V2 exists to replace the root `app.js` sprawl with maintainable TypeScript modules. Keep domain rules, platform adapters, sync/persistence, app orchestration, and feature views separated. `v2/src/app/main.ts` should coordinate; it should not become a new v1-style catch-all.

3. Build the real app path, not test scaffolding.
   No special test-family URL, fake default family, local-lab route, or "test scenario" behavior should become part of the app path. Seeded data is just Firestore data. A family is selected by onboarding, returning sign-in, or kid family-code join.

4. Prove the foundations before chasing polish.
   Before spending time on UI cleanup bugs, verify the basics: iOS native build path, Google/Apple auth, Firestore reads/writes, onboarding creates a real family, returning sign-in finds that family, kid join works by family code, close/reopen restores the correct state, and push/native diagnostics are trustworthy.

5. Protect organization while fixing bugs.
   App responsiveness is already much better in v2, but it only matters if the code stays maintainable. Each fix should land in the right feature/platform/domain/sync module, with small commits and clear verification. If a change wants to grow `main.ts`, pause and decide where the responsibility belongs.

6. Plan the v1-to-v2 replacement deliberately.
   Do not build anything that blocks the eventual switch where v2 replaces v1. Keep migration, rollback, Firebase project/auth alignment, TestFlight/App Store build selection, family data shape, and production rules in view. The app path we test now should be compatible with the path we intend to ship.

7. Keep v1 production stable until the switch.
   V1 remains the public app. Do not patch v1 unless the user explicitly asks for a production hotfix. V2 should learn from v1 and preserve user-facing behavior, but not destabilize the launched app.

## Collaboration Notes

- Keep chat quieter during GemSprout work. Do not send mid-edit status updates unless there is a blocker, a risky choice, or the user asks for progress. Make the edits, then report when done with a concise summary.
- Do not run automated tests/typecheck by default for now. The current priority is real-world/manual testing unless the user explicitly asks for tests or a command is needed to answer a specific question.
- At the start of each GemSprout session, spin up the v2 test server so it is available if needed. The server path still needs a cleanup pass to remove lab/alternate URL behavior; handle that separately before relying on it as a true app-path mirror.

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

Last known good v2 app-code checkpoint for Build 109-era testing is `e5b374f` (`revcat bypass`). Later commits on `main` may update documentation only; do not move the app-code baseline unless app code changes are intentionally accepted. The July 14 device-debug commits were backed up on `origin/codex/pre-revert-device-pass-backup` and should not be treated as the active baseline.

Next work should start with the readiness pass documented in `v2/docs/v2-readiness-audit.md` and `v2/docs/iphone-test-plan.md`:

1. Add real-time Firestore subscription/foreground refresh and native app badge sync.
2. Port RevenueCat/paywall/restore/manage subscription behavior.
3. Port durable photo storage.
4. Verify and adjust iOS/Capacitor build wiring for v2.
5. Finish QR scanner/invite delivery/maintenance mode, then run the full iPhone test plan.

Continue using v1 as the visual and functional source of truth. The user reviews in the browser and prefers concise end summaries over ongoing status chatter. For this phase, do not run backend-heavy tests unless requested; `npm run typecheck:v2` has been the lightweight safety check after edits.

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
