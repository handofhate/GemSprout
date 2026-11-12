# Testing Environments

## Real App Testing

- Codemagic workflow `ios-v2-testflight` builds against production Firebase project `gemsprout1`.
- The local Vite server defaults to `gemsprout-v2-dev`. It is for browser iteration, not proof that the production iOS build works.
- Use a TestFlight build on an iPhone for Google/Apple auth, StoreKit, camera, push, app badge, and native QR behavior.
- Use COLLUM only for non-destructive parent/kid read checks. Use ABC123 for test writes. Create a separate throwaway family/account for destructive reset or account-deletion checks.
- Do not rerun a production migration to test an app build. The migrated family documents already exist in `gemsprout1`.

## Automated Checks

- `npm run typecheck:v2` checks the TypeScript contracts.
- `npm run test:v2` clears stale compiled tests before running the current suite.
- `npm run test:rules:v2` runs production Firestore rules against the local emulator. It never connects to production.
- `npm run build:v2:app` checks the web bundle produced for Capacitor.

Automated checks supplement real-device testing; they do not replace it. There is no fake-family URL or local fake-Firestore app lane.
