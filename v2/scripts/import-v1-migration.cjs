const fs = require('node:fs');
const path = require('node:path');
const { applicationDefault, cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { migrateV1FamilySnapshot, assertSafeMigrationTarget } = require('../dist/src/migration');

function readArgs(argv) {
  const args = {
    input: '6.10backup.json',
    familyId: '',
    projectId: '',
    databaseId: '(default)',
    emulatorHost: process.env.FIRESTORE_EMULATOR_HOST || '',
    serviceAccount: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    write: false,
    allowProductionProject: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--input') args.input = next, index += 1;
    else if (arg === '--family-id') args.familyId = next, index += 1;
    else if (arg === '--project') args.projectId = next, index += 1;
    else if (arg === '--database') args.databaseId = next, index += 1;
    else if (arg === '--emulator-host') args.emulatorHost = next, index += 1;
    else if (arg === '--service-account') args.serviceAccount = next, index += 1;
    else if (arg === '--write') args.write = true;
    else if (arg === '--allow-production-project') args.allowProductionProject = true;
    else if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage:
  node v2/scripts/import-v1-migration.cjs --input 6.10backup.json --family-id copied-family --project gemsprout-v2-dev --database "(default)"
  node v2/scripts/import-v1-migration.cjs --input 6.10backup.json --family-id copied-family --project gemsprout-v2-dev --database "(default)" --write

Defaults to dry-run. Add --write to write batches.
Requires Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS.
Optionally pass --service-account path\\to\\dev-service-account.json.
Refuses production project "gemsprout1" unless the script is changed deliberately.
`);
}

async function commitWrites(db, writes) {
  const chunkSize = 450;
  let committed = 0;
  for (let offset = 0; offset < writes.length; offset += chunkSize) {
    const chunk = writes.slice(offset, offset + chunkSize);
    const batch = db.batch();
    for (const write of chunk) {
      batch.set(db.doc(write.path), write.data, { merge: true });
    }
    await batch.commit();
    committed += chunk.length;
    console.log(`Committed ${committed}/${writes.length} docs`);
  }
}

async function main() {
  const args = readArgs(process.argv);
  if (!args.familyId) throw new Error('Missing required --family-id.');
  if (!args.projectId) throw new Error('Missing required --project.');
  assertSafeMigrationTarget({
    projectId: args.projectId,
    databaseId: args.databaseId,
    emulatorHost: args.emulatorHost,
    allowProductionProject: args.allowProductionProject,
  });

  const inputPath = path.resolve(process.cwd(), args.input);
  const snapshot = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const result = migrateV1FamilySnapshot(snapshot, { familyId: args.familyId, migratedAt: Date.now() });
  const preview = {
    input: inputPath,
    projectId: args.projectId,
    databaseId: args.databaseId,
    emulatorHost: args.emulatorHost || null,
    familyId: args.familyId,
    write: args.write,
    summary: result.summary,
    warningCount: result.warnings.length,
    warnings: result.warnings.slice(0, 20),
    samplePaths: result.writes.slice(0, 20).map(write => write.path),
  };
  console.log(JSON.stringify(preview, null, 2));

  if (!args.write) {
    console.log('Dry run only. Add --write to commit these docs to the guarded target.');
    return;
  }

  const credential = args.serviceAccount
    ? cert(JSON.parse(fs.readFileSync(path.resolve(process.cwd(), args.serviceAccount), 'utf8')))
    : applicationDefault();
  const app = initializeApp({
    projectId: args.projectId,
    credential,
  }, `migration-${Date.now()}`);
  const db = args.databaseId && args.databaseId !== '(default)'
    ? getFirestore(app, args.databaseId)
    : getFirestore(app);
  await commitWrites(db, result.writes);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
