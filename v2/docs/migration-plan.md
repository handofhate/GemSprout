# Migration Plan

v2 will be built in parallel with v1.

## Phases

1. Define v2 data contracts and pure domain tests.
2. Build v1-to-v2 import from a cloned v1 family snapshot.
3. Build v2 state and sync using the new data contracts.
4. Port high-risk flows first: approvals, history, notifications, account deletion.
5. Port user-facing screens after the state contracts are stable.
6. Run v1 parity fixtures through v2.
7. Test on device with real auth, push, and subscription boundaries.

## Release Shape

v1 remains public. v2 should be hidden behind a separate local entry point until data migration and rollback are safe.
