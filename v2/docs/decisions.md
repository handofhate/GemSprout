# Decisions

## 2026-07-08: v2 Uses TypeScript

v2 source should be TypeScript by default.

Why:

- approval, sync, and migration code need stronger contracts than v1 had,
- type errors are cheaper than post-launch data bugs,
- domain modules can stay readable while still catching null, status, and shape mistakes early.

Current shape:

- source lives in `v2/src/**/*.ts`,
- tests live in `v2/tests/**/*.ts`,
- compiled output goes to `v2/dist/`,
- `npm run typecheck:v2` validates types,
- `npm run test:v2` builds v2 and runs compiled tests.

## 2026-07-08: Family Codes Stay User-Facing

Human-friendly family codes remain part of v2.

Direction:

- users keep using short family codes for adding kid devices and joining families,
- v2 may still use stable internal `familyId` values for records and migration safety,
- the join code should be treated as a lookup/invite surface, not necessarily the primary database identity forever.

## 2026-07-08: History Uses First-Class Records

v2 stores first-class history records for launch.

Why:

- v1 users expect a durable activity feed,
- v1 migration needs to preserve existing history,
- first-class records are simple to display and search,
- deterministic IDs still prevent duplicate history on retries.

Direction:

- each history row links back to the request and later operation that created it,
- operation records remain the source of idempotency,
- future analytical views can be derived from operations if useful.

## 2026-11-12: Production Family Paths Use The Family Code

Production family documents are keyed by their six-character code.

Why:

- V1 already uses `families/{familyCode}`.
- V2 family-code joining can use a direct document lookup instead of listing/querying every family.
- Family-scoped rules can map the authenticated device to the family without exposing a family collection query.

The code remains a shared bearer credential for kid access, not a strong private identity. Keep it out of public channels. A stronger join credential would require a separately planned V1-compatible flow.

Pure domain tests are useful, but there is no fake-Firestore app lane. Firestore rules are tested in the emulator and app behavior is verified on the real TestFlight build.
