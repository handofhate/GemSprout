const fs = require('node:fs');
const path = require('node:path');
const { migrateV1FamilySnapshot } = require('../dist/src/migration');

const [, , inputPath = '6.10backup.json', familyId = 'migration-preview'] = process.argv;
const absoluteInput = path.resolve(process.cwd(), inputPath);
const snapshot = JSON.parse(fs.readFileSync(absoluteInput, 'utf8'));
const result = migrateV1FamilySnapshot(snapshot, { familyId, migratedAt: Date.now() });

console.log(JSON.stringify({
  input: absoluteInput,
  familyId,
  summary: result.summary,
  warningCount: result.warnings.length,
  warnings: result.warnings.slice(0, 20),
  samplePaths: result.writes.slice(0, 20).map(write => write.path),
}, null, 2));
