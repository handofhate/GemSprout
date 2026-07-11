# Sync

Firestore sync contracts, transactions, operations, migrations, conflict handling, and idempotency.

v2 should make sync boring: explicit operation IDs, deterministic history IDs, and small records.

First implemented slice:

- `operation-model.ts` defines retryable operation records.
- `operation-executor.ts` applies request approve/deny operations through pure domain functions.
- `firestore-transaction-plan.ts` defines the Firestore read/write contract produced after an operation executes.
- Applied operations are idempotent: replaying the same applied operation returns a duplicate result without producing new history, events, or balance changes.

## Request Operation Transaction Contract

For a request approve/deny operation, the Firestore adapter should:

1. Read `families/{familyId}/operations/{operationId}` to check idempotency.
2. Read `families/{familyId}/requests/{requestId}` to load the current request.
3. Execute the operation through the pure domain executor.
4. Write the operation record.
5. Write only touched records: request, member, completion, prize, and generated history records.

The adapter should not write a broad family document.
