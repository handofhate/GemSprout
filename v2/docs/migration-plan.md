# V1 To V2 Data Migration

## Completed Production Migration

The V1 `gemsprout1` Firestore data was exported, reviewed, transformed into the V2 family/subcollection layout, and imported into the same production project. The import merged V2 documents without deleting the original V1 family documents. The duplicate test family `975ZLK` was excluded; `ABC123` was retained.

The Cloud Storage export and older app JSON backup are rollback references. Local migration previews contain private family data and are excluded from source control.

## Release Rules

- Do not rerun the import for TestFlight or for ordinary bug fixes.
- Do not delete or overwrite the V1 root documents while V1 remains the public App Store build.
- Test using the migrated production records, but keep destructive checks on a disposable family/account.
- Before production Firestore rules change, run emulator rule tests and confirm the existing V1 code-based join and linked-parent sign-in still work.
- V1 and V2 do not synchronize their distinct document layouts bidirectionally. The old V1 build is not a data rollback by itself; restoring the verified Firestore export is required to return to the old schema.
