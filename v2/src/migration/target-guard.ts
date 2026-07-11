export type MigrationTarget = {
  projectId: string;
  databaseId?: string;
  emulatorHost?: string;
  allowProductionProject?: boolean;
};

const PRODUCTION_PROJECT_IDS = new Set(['gemsprout1']);

export function assertSafeMigrationTarget(target: MigrationTarget): void {
  const projectId = target.projectId.trim();
  const databaseId = (target.databaseId || '').trim();
  const emulatorHost = (target.emulatorHost || '').trim();
  if (!projectId) throw new Error('Migration target requires an explicit projectId.');
  if (!databaseId && !emulatorHost) throw new Error('Migration target requires an explicit databaseId or emulatorHost.');
  if (PRODUCTION_PROJECT_IDS.has(projectId) && !target.allowProductionProject) {
    throw new Error(`Refusing to run migration writes against production project "${projectId}". Use a dev project or emulator.`);
  }
  if (PRODUCTION_PROJECT_IDS.has(projectId) && databaseId === '(default)' && !target.allowProductionProject) {
    throw new Error('Refusing to run migration writes against the production default database.');
  }
}
