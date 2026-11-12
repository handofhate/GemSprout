# Tests

v2 test workspace.

Suggested folders:

- `domain/` - fast pure tests for business rules.
- `sync/` - transaction, migration, and conflict fixtures.
- `integration/` - platform boundary tests that do not impersonate live Firebase behavior.
- `e2e/` - migrated Playwright coverage for release parity.
- `fixtures/` - sanitized v1 family snapshots and generated v2 records.

Production Firestore security rules are tested separately with `npm run test:rules:v2` against the local emulator. Auth, StoreKit, push, QR camera access, and data migration acceptance are verified with the actual iPhone TestFlight build.
