# Firebase Platform

Firestore, Cloud Functions, and Firebase SDK setup.

Keep SDK-specific types and error translation here.

The first Firestore adapter should implement the transaction contract from `src/sync/firestore-transaction-plan.ts` rather than embedding business rules in Firebase code.

`firestore-gateway.ts` defines the SDK-free boundary that both fake and real Firestore adapters must satisfy.

`fake-firestore.ts` is an in-memory adapter for testing the contract before real Firebase SDK work. It is intentionally path-based so tests exercise the same document layout planned for production.

`compat-firestore-gateway.ts` is the first real-adapter skeleton for the browser Firebase compat SDK used by v1. It is intentionally thin and should not gain business rules.

Live testing should use the Firebase Emulator Suite or a separate Firebase project. Do not point v2 write-path tests at production.

Current fake coverage:

- commits a request approval to operation, request, member, completion, and history docs,
- replays an applied operation without rewriting domain docs,
- records failed operations while leaving unresolved requests pending.
