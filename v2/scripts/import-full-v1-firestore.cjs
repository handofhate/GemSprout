const fs = require('node:fs');
const path = require('node:path');
const { applicationDefault, cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { assertSafeMigrationTarget } = require('../dist/src/migration');

function readArgs(argv) {
  const args = {
    input: 'all-families-v2-migration-preview.json',
    projectId: '',
    databaseId: '',
    serviceAccount: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    write: false,
    allowProductionProject: false,
    confirmProductionWrite: '',
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--input') args.input = next, index += 1;
    else if (arg === '--project') args.projectId = next, index += 1;
    else if (arg === '--database') args.databaseId = next, index += 1;
    else if (arg === '--service-account') args.serviceAccount = next, index += 1;
    else if (arg === '--write') args.write = true;
    else if (arg === '--allow-production-project') args.allowProductionProject = true;
    else if (arg === '--confirm-production-write') args.confirmProductionWrite = next, index += 1;
    else if (arg === '--help') {
      console.log('Usage: node v2/scripts/import-full-v1-firestore.cjs --project PROJECT --database DATABASE [--write]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function commitWrites(db, writes) {
  const chunkSize = 450;
  let committed = 0;
  for (let offset = 0; offset < writes.length; offset += chunkSize) {
    const batch = db.batch();
    for (const write of writes.slice(offset, offset + chunkSize)) {
      batch.set(db.doc(write.path), write.data, { merge: true });
    }
    await batch.commit();
    committed += Math.min(chunkSize, writes.length - offset);
    console.log(`Committed ${committed}/${writes.length} documents`);
  }
}

async function main() {
  const args = readArgs(process.argv);
  if (!args.projectId) throw new Error('Provide an explicit --project target.');
  if (!args.databaseId) throw new Error('Provide an explicit --database target.');
  if (args.projectId === 'gemsprout1' && args.write && args.confirmProductionWrite !== 'gemsprout1') {
    throw new Error('Production writes also require --confirm-production-write gemsprout1.');
  }
  if (args.projectId !== 'gemsprout1' && args.confirmProductionWrite) {
    throw new Error('--confirm-production-write is only valid for gemsprout1.');
  }
  assertSafeMigrationTarget({
    projectId: args.projectId,
    databaseId: args.databaseId,
    allowProductionProject: args.allowProductionProject,
  });

  const inputPath = path.resolve(process.cwd(), args.input);
  const report = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const writes = report.writes;
  if (!Array.isArray(writes) || !Array.isArray(report.source?.rootCollections)) {
    throw new Error('Input is not a full Firestore migration preview report.');
  }
  if (report.source.project !== 'gemsprout-v2-dev' || report.source.database !== 'v1-restore') {
    throw new Error('This importer only accepts the reviewed v1-restore copy from gemsprout-v2-dev.');
  }
  if (args.projectId === 'gemsprout1') {
    const excludedFamilyIds = new Set((report.source.excludedFamilies || []).map(family => String(family.familyId || '').toUpperCase()));
    const includesTestFamily = writes.some(write => write.path.startsWith('families/975ZLK/')) || writes.some(write => write.path === 'families/975ZLK');
    if (!excludedFamilyIds.has('975ZLK') || includesTestFamily) {
      throw new Error('Production migration requires a preview that excludes test family 975ZLK.');
    }
  }
  if (args.projectId === report.source.project && args.databaseId === report.source.database) {
    throw new Error('Refusing to write into the source restore database. Choose a separate target database.');
  }
  const userWrites = writes.filter(write => write.path.startsWith('users/'));
  if (userWrites.length) throw new Error(`Refusing migration plan containing ${userWrites.length} users writes.`);
  const duplicatePaths = writes.map(write => write.path).filter((documentPath, index, paths) => paths.indexOf(documentPath) !== index);
  if (duplicatePaths.length) throw new Error(`Refusing migration plan containing ${duplicatePaths.length} duplicate document paths.`);

  console.log(JSON.stringify({
    source: report.source,
    target: { projectId: args.projectId, databaseId: args.databaseId },
    write: args.write,
    documentWrites: writes.length,
    userDocumentsChanged: 0,
    deletes: 0,
    reviewFlags: report.migration.reviewFlags,
    note: 'Writes merge migrated family documents only. Existing users and all other documents are left untouched.',
  }, null, 2));
  if (!args.write) {
    console.log('Dry run only. No Firestore connection or writes were made.');
    return;
  }

  const credential = args.serviceAccount
    ? cert(JSON.parse(fs.readFileSync(path.resolve(process.cwd(), args.serviceAccount), 'utf8')))
    : applicationDefault();
  const app = initializeApp({ projectId: args.projectId, credential }, `full-migration-${Date.now()}`);
  const db = args.databaseId === '(default)'
    ? getFirestore(app)
    : getFirestore(app, args.databaseId);
  await commitWrites(db, writes);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
