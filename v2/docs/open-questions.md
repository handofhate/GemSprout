# Remaining Release Decisions

The app structure, Firebase provider, and testing approach are settled. Remaining items are verification work:

- The production rules are emulator-tested and deployed. Confirm V1 and V2 family access on real devices. A six-character code still acts as the kid's shared access key.
- The Firebase Auth deletion cleanup trigger is deployed; verify it only with a disposable family/account.
- Complete the RevenueCat iPhone sandbox purchase/restore test; the production build does not include a bypass.
- Complete iPhone checks for QR, badge clearing, push tap routing, camera/photo lifecycle, offline recovery, and two-device refresh.
- Keep the six-character family code as the shared kid-access credential for V1 compatibility; it is not resistant to someone who obtains or systematically guesses a code. Plan a stronger server-verified join only as a deliberate product change.
- Post-launch follow-up: move family role membership to a server-owned source and enforce parent-versus-kid permissions in Firestore rules. The current app blocks kid-to-parent switching in its UI, but family-scoped database access is not role-aware; a determined family member could bypass the UI and change family data such as balances, approvals, or settings. This is an integrity protection, not a claim that the current family chores data is highly sensitive. Do not enable the stronger rules until V1 compatibility and the deployed app version are accounted for.
- Confirm App Store metadata and screenshots are current when moving from internal TestFlight to public submission.
