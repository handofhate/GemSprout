# Live Migration Record

## Completed

- A Firestore export of the V1 `gemsprout1` database was saved to Cloud Storage before the production data adjustment.
- A full V1-to-V2 document preview was reviewed, excluding the rejected duplicate test family `975ZLK` and retaining `ABC123`.
- The V2-shaped family, member, task, prize, request, completion, history, and user-link documents were imported into the production `(default)` Firestore database with merge writes and no deletes.
- V1 root family documents were retained alongside the V2 collections. This does not guarantee the old V1 app can read the migrated V2 layout; restoring the pre-migration export is the data rollback path.
- Local preview/export JSON files contain private family data. They are workspace-only and must not be committed or attached to a release.

## Current Data Safety Rules

- Do not rerun a migration as part of a TestFlight build or device test.
- Do not overwrite or delete the Cloud Storage export.
- Do not modify family records to make a test pass. Use `ABC123` for ordinary test writes or create a disposable family.
- V1 and V2 share `gemsprout1`; their document layouts are not synchronized bidirectionally. Keep the old V1 build, but use the verified Firestore export for data rollback.
- Run `npm run test:rules:v2` and verify V1 family-code entry before deploying production rules.

## Migration Tools

These scripts are for explicit recovery or migration operations only:

- `v2/scripts/preview-full-v1-firestore-migration.cjs`
- `v2/scripts/import-full-v1-firestore.cjs`

Production imports require the explicit `--allow-production-project` override. Do not use that override for normal TestFlight testing.
