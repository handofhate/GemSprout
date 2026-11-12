# V1 Functional Parity

This is a device-verification checklist, not a statement that every workflow has passed. V1 remains the behavioral reference; V2 may use a better internal implementation.

## Parent

- Sign in with Google and Apple; find the correct linked family and parent profile.
- Create/edit family settings, parent and kid profiles, chores, prizes, team goals, and schedules.
- Review and approve/deny chore, prize, and savings requests.
- Confirm recent activity, undo, balances, family snapshot, and stats stay consistent after writes and relaunch.
- Verify settings, parent PIN/app lock, provider linking, sign out, and family switch.

## Kid

- Join with the six-character family code or generated QR; choose the right kid profile.
- Complete normal, scheduled, and photo-proof chores; verify approval, denial, and undo behavior.
- Redeem prizes, contribute to team goals, and request savings spending.
- Verify regular/little-kid modes, TTS, badges, levels, streaks, Daily Combo, and Week in Review.
- Confirm a kid session cannot switch to a parent dashboard without parent authentication.

## System And Native Behavior

- Two devices refresh each other's changes without duplicate rewards or history.
- App badge exactly matches pending parent items and clears after the corresponding in-app items are cleared.
- Push taps open the relevant parent inbox state; parent push remains parent-only.
- QR scan/generation works on iPhone, with manual code entry still available.
- Photo proof survives approval/denial/undo and app relaunch; camera/photo permissions recover cleanly.
- RevenueCat purchase, restore, manage-subscription, and paywall sign-out work without a development bypass.
- Maintenance and minimum-supported-build screens match production Remote Config values.
- Offline or failed writes explain the problem and recover without duplicate rewards or silent data loss.
- Account deletion requires fresh provider authentication and performs server-side cleanup only after Auth deletion succeeds.

## Data And Rollback

- Use COLLUM for non-destructive reads and ABC123 for test writes. Use a disposable family for destructive checks.
- Do not rerun migration during device testing. Keep the V1 export and old V1 build; restoring the export is required for a data rollback.
- After production rules change, verify V1 and V2 family-code entry and existing parent sign-in before broad distribution. Because the live data now uses the V2 document layout, restoring the pre-migration V1 backup is part of a data rollback.
