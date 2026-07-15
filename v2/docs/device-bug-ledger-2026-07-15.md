# Device Bug Ledger - 2026-07-15

This is the clean ledger from the first iPhone/iPad v2 device pass and follow-up investigation. It intentionally excludes bugs that were only created by later attempted fixes during the same day.

## Original On-Device Test Pass

### Two-Device Live Sync

- Kid task/photo submission can create duplicate parent inbox rows for one submit gesture. First run produced four rows; retest produced three.
- Pending prize review needs a clear disabled/pending state on the child device.
- Swipe/bounce hints should not replay on same-tab partial updates such as approve, deny, undo, add task, add prize, or add team prize.

### Front Door, Onboarding, Returning Sign-In, Kid Join, Profile Picker

- Could not complete these sections while locked into the seeded/test family.
- App needs a real-family path: no special test family default; use onboarding, returning sign-in, or family-code join like v1.

### Parent Dashboard

- Edit Family -> Finish has a save gap that feels stuck; use the standard loading screen.
- Edit Family from Settings has the same save-gap/loading issue.
- Editor screens show raw `ph-icon-name` text instead of rendering the icon.
- Add Task modal reanimates when selecting icon or color.
- Deleted children still appear as task assignees.
- Task icon preview color does not update to match selected color.
- Dashboard overview task-completion counts can show all tasks complete while kid dashboard still has available tasks.
- Add Prize and Add Team Prize icon previews need to use the selected color.
- Add Task/Prize/Team Prize should not retrigger same-tab swipe-hint bounce.
- Quick Action modals show deleted children.
- Quick Action modals show raw `ph-icon-name` text instead of rendering the icon.
- Not Listening counter is missing the v1 alarm sound.
- If a kid is on Stats and Not Listening time is applied, the Stats tab redraws/snaps to top instead of updating in place.

### Tasks And Approvals

- Push notifications were not received on device.
- Need v1-style hidden push diagnostics in v2 for permission/token/auth/family debugging.
- Kid dashboard works functionally but reanimates slideouts and redraws the full tab after actions.
- Hide Unavailable Tasks hides an entire task when one slot is unavailable and one slot is available. It should show the task if any slot is currently available, and only hide fully unavailable tasks.

### Prizes, Team, Savings

- Redeemed recurring prize hid even when "hide redeemed recurring prize" was disabled.
- Parent dashboard needs undo/reset path for recurring prize redemptions.
- Kid tab redraws and scrolls back to top after some prize/team/savings actions.

### Levels, Streaks, Combos, Badges

- If base badges and chore/task badges are both disabled, the kid Gems badges section should hide entirely.
- Holo badge cards look good on phone but need iPad layout/sizing/proportion tuning.
- Earning one badge can trigger two different new-badge modals.

### Week In Review

- Need seeded Week In Review data for testing.

### Settings

- Could not fully test family switching/account flows while locked into the seeded/test family.

### Native/iOS

- App did not require PIN or Face ID after close/reopen.
- Push notification behavior remains unverified/failing.
- Native app badge, local savings-interest notification, offline recovery, and subscription/paywall restore still need focused device verification.

### Migration

- Migration could not be tested in the seeded/test-family configuration.

## Follow-Up Findings While Investigating

- Native Google and Apple sign-in failed during onboarding.
- v1 native auth and web auth use the same Firebase project (`gemsprout1`); v2 was attempting to use native auth credentials with the separate v2 dev Firebase project. This mismatch needs to be resolved deliberately.
- Onboarding should not prefill the first kid as Avery.
- Final onboarding `Let's go` needs the standard full-screen `Saving...` state and clear failure feedback.
- Kid avatar easter-egg rain renders raw `ph-name` text instead of the actual icon.
- Family selection should match v1: Firestore is the app data path, and the selected family comes from onboarding, returning auth lookup, or a 6-character family code. No special URL should imply seeded test data.
- Returning sign-in should look up `users/<uid>.familyCode`, with email fallback, like v1.
- Kid join should load the family by the entered/scanned 6-character family code.
- Firestore family doc ids should be the 6-character family code, matching v1, unless we explicitly choose and migrate to a different live model later.

## Do Not Carry Forward

- Do not keep bugs caused only by the attempted locked-rules experiment.
- Do not keep bugs caused only by special browser URL/test-family routing experiments.
- Do not treat local-lab or fake-data behavior as a release target.
