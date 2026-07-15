# Live Migration Runway

v2 should rehearse against copied data before it touches production families.

## Recommendation

Use a separate Firebase project first, for example `gemsprout-v2-dev`.

Firestore supports multiple databases in one project, but a separate project is safer for the first rehearsal because v2 will also need realistic Auth, Cloud Functions, rules, push-token, and account-deletion testing. A named database inside `gemsprout1` is useful later, but it is easier to accidentally mix production and test resources.

## Safe Order

1. Create a non-production Firebase project.
2. Enable Firestore in Native mode in the same region as production if possible.
3. Export or clone production Firestore into the non-production target.
4. Run `npm run migration:v2:preview` locally against a v1 family snapshot.
5. Compare preview counts with the source family.
6. Add a dev-only importer that refuses to run unless the target project/database is explicitly non-production.
7. Run v2 against the copied target and validate approval, prize, savings, history, auth lookup, and account deletion flows.

## Local Preview

The current local mapper does not connect to Firebase and does not write anything.

```powershell
npm run migration:v2:preview
```

That command compiles v2, reads `6.10backup.json`, and prints:

- v2 document counts,
- warning count,
- the first sample paths that would be written.

The mapper lives at `v2/src/migration/v1-to-v2.ts`.

## Guarded Importer

The importer is dry-run by default:

```powershell
npm run migration:v2:import:dry
```

To write after the dev Firebase project exists and credentials are configured:

```powershell
npm run migration:v2:import:write:dev
```

Do not add a production override for `gemsprout1` until rollback and validation are complete.

## Current Dev Project

The first dev project has been created:

- Project ID: `gemsprout-v2-dev`
- Firebase console: https://console.firebase.google.com/project/gemsprout-v2-dev/overview
- Local Firebase alias: `v2dev`
- Firestore database: `(default)` in `nam5`
- Imported preview family: `families/migration-preview`

The imported data can be viewed locally with:

```powershell
npm run dev:v2
```

Then open:

```text
http://127.0.0.1:4273/
```

This view uses the dev Firestore database and should act like the replacement app path. It allows dev approval/denial transactions while preserving the real landing, sign-in, onboarding, kid join, and family routing flow.

The dev Firestore rules are intentionally open for the isolated dev project while we test browser transactions. They live at `v2/firestore.dev.rules` and must not be reused for production.

The local fake adapter lab and URL test lane have been removed. Use the default app entry path against the isolated dev Firebase project for live review.

## Cloud Copy Options

For a full Firestore copy, use the managed Firestore export/import path through Cloud Storage. This requires billing/Blaze and the needed Firestore plus Storage permissions. Firebase documents this at https://firebase.google.com/docs/firestore/manage-data/export-import.

For a same-project named database rehearsal, create a named database such as `v2-dev` and import into that database. Keep this behind explicit environment variables so local code cannot default to production. Firebase documents multiple databases at https://firebase.google.com/docs/firestore/manage-databases.

For a separate-project rehearsal, export from `gemsprout1` to a Cloud Storage bucket and import into the dev project/database.

## Guardrails Before Any Importer Writes

- Require an explicit target project ID.
- Reject `gemsprout1` unless a separate, deliberate override is added later.
- Require an explicit database ID or emulator host.
- Print a dry-run summary before writes.
- Batch writes in small chunks.
- Never migrate from the public app runtime.
- Keep v1 production data untouched until we have a rollback plan.

The first guard is already in `v2/src/migration/target-guard.ts`; importers should call it before constructing any Firestore client.
