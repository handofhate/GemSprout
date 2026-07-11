# iPhone Test Plan

Use this as the manual release-style pass once the P0 gaps in `v2-readiness-audit.md` are closed. Test with one parent iPhone and one kid iPhone when possible. If only one iPhone is available, repeat the role-switching steps after fully leaving/rejoining the family.

## Setup

- Install a v2 build that points at the dev Firebase project, not production.
- Use a fresh dev family and keep the family code visible for kid-device joins.
- Sign in as a real parent with Apple and/or Google. Use the temporary dev bypass only when testing non-auth UI.
- Enable parent notifications on the parent iPhone. Do not enable push on the kid device.
- Set family timezone to a known value and note the local date/time before testing streak and "today" behavior.

## Front Door And Onboarding

1. Open the app with no local family.
2. Confirm the main landing page matches v1.
3. Tap Get Started.
4. Try Next before signing in and confirm "Please sign in first" appears.
5. Sign in with Apple, then repeat in a separate run with Google.
6. Confirm onboarding panes slide forward/back correctly and preserve scroll position.
7. Confirm only one kid field is ready by default.
8. Fill parent, kid, PIN, settings, and setup panes.
9. Back out before "Let's go" in one run and confirm no orphaned family is usable.
10. Complete setup in another run and confirm the generated family code is unique and the parent lands in the dashboard.

## Returning Sign-In

1. From the landing page tap Sign In.
2. Try Next before auth and confirm the sign-in warning.
3. Sign in with the linked provider.
4. Confirm matching family/profile routing.
5. Confirm a wrong/unlinked account shows the not-found pane and can return to landing.

## Kid Join And Profile Picker

1. On the kid iPhone tap "I'm a Kid."
2. Enter the family code manually.
3. Confirm profile picker copy says "Choose your profile to open your dashboard."
4. Confirm avatars show on all profile cards.
5. Select a regular kid and confirm kid dashboard loads.
6. Use kid settings "Leave This Device" and confirm parent PIN is required.
7. Rejoin and select a little kid profile; confirm little kid mode and TTS behavior.

## Parent Dashboard

1. Confirm header says the parent name and `The [Family Name] Family`.
2. Edit family from the profile picker and confirm the new family name persists after reload.
3. Add/edit/delete a kid and confirm dashboard/profile picker update.
4. Add/edit/delete tasks, prizes, and team goals.
5. Use snapshot slideout cards and home/away toggles; confirm toggles do not reveal slideout content or redraw the home page.
6. Use quick actions for bonus gems, subtract gems, savings deposit, and you're-not-listening.
7. Confirm recent activity rows and undo behavior.

## Tasks And Approvals

1. Kid completes a normal task.
2. Parent receives pending approval and, if enabled, a push notification.
3. Approve the task and confirm kid gems, parent activity, and kid approval modal.
4. Deny another task and confirm kid denial modal.
5. Enable auto-approve tasks and confirm a new kid completion awards immediately.
6. Disable auto-approve and confirm approval is required again.
7. Test unavailable/later tasks with hide unavailable tasks both on and off.
8. Test a time-slot task and confirm only the correct slot is actionable.
9. Test before/after photo task with camera/photo picker and parent photo preview.

## Prizes, Team, And Savings

1. Redeem an affordable instant prize and confirm gems/history.
2. Request a parent-approved prize and approve/deny from parent inbox.
3. Confirm kid approval/denial modals.
4. Redeem a recurring prize, then confirm "hide redeemed recurring prizes" hides only already-redeemed recurring prizes.
5. Contribute to a team goal and confirm totals/history.
6. Enable savings banking and set conversion/matching/interest.
7. Deposit savings, request spend, approve/deny spend, and confirm balances/history/modals.
8. Disable savings banking and confirm related kid/parent surfaces hide correctly.

## Levels, Streaks, Combos, Badges

1. Change level thresholds/icons and confirm kid level display updates.
2. Confirm level deletion is allowed consistently, including the first two levels.
3. Change streak bonus gems and confirm reward amounts.
4. Complete all Daily Combo tasks and confirm combo bonus/history.
5. Toggle base badges and task badges off/on and confirm kid badge sections follow.
6. Edit base badge icons/text and task badge tiers/secrets.
7. Trigger base, streak, level, and task badges and confirm kid badge pop-up plus badge card.

## Week In Review

1. Seed or create completed tasks, gems, savings, and badges in the last fully completed Monday-Sunday week.
2. Open parent Stats and launch Week in Review.
3. Confirm cover, conditional slides, finale, quiet-week behavior, audio, progress, pause/hold, and navigation.
4. Confirm it appears automatically only once per family day.

## Settings

1. Main settings: currency, timezone, UI hints, auto-approve, hide unavailable tasks, hide redeemed recurring prizes, split household, savings, levels, Daily Combo, badges, you're-not-listening.
2. Split household configure: set labels and confirm home/away labels propagate to dashboard slideouts.
3. Notifications: task approval, savings spend, and interest-day notification toggles persist and affect behavior.
4. Account/security: provider link/switch/unlink, PIN setup/reset/remove, biometric setup/remove, lock on background, join different family, reset family data, delete account.
5. Delete account: confirm subscription warning copy, typed `delete`, reauth if required, and safe stop on failure.

## Native/iOS

1. Cold launch, background, foreground, and lock/unlock.
2. App lock with PIN and biometric.
3. Camera/photo permission prompt and denied-permission recovery.
4. Parent push token registration and notification tap routing.
5. Native app badge count for pending parent inbox.
6. Local notification for savings interest day.
7. Offline or bad-network action, recovery, and no duplicate rewards.
8. App Store subscription purchase, restore, manage subscription, and paywall sign-out/privacy links.

## Migration

1. Import a current v1 backup into the dev v2 project.
2. Confirm family code/name, parent profiles, kid profiles, display mode, balances, savings, tasks, prizes, team goals, settings, badges, history, pending approvals, and completed tasks.
3. Run the parent and kid smoke tests on the imported family.
